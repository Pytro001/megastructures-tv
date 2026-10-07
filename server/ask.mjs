// The voice question loop: a question plus a snapshot of what is on screen goes in,
// a short spoken answer plus a list of validated simulation changes comes out.
// Three modes: ask (Amazon Bedrock, Claude, tool use), replay (answers recorded
// from earlier real Bedrock calls), mock (keyword rules, no network).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { converse } from './bedrock.mjs'

const here = new URL('.', import.meta.url).pathname
export const CATALOG = JSON.parse(readFileSync(new URL('../tv/src/catalog.json', import.meta.url), 'utf8'))
export const RECORDINGS = here + 'recordings/'

const simInfo = id => CATALOG.sims.find(s => s.id === id)

/** the three tools the model may call; the TV applies them in order */
export const TOOLS = [
  {
    toolSpec: {
      name: 'jumpToChapter',
      description: 'Jump the film on screen to one of its chapters. Each chapter has its own camera shot and starting settings. Call this before setParam, because jumping resets the chapter settings.',
      inputSchema: { json: { type: 'object', properties: {
        sim: { type: 'string', description: 'id of the simulation on screen' },
        chapter: { type: 'string', description: 'chapter id from the list in the system prompt' },
      }, required: ['sim', 'chapter'] } },
    },
  },
  {
    toolSpec: {
      name: 'setParam',
      description: 'Change one parameter of the live simulation on screen. Sliders take a number inside their range, choices take one of their option values, buttons take the value "run".',
      inputSchema: { json: { type: 'object', properties: {
        sim: { type: 'string', description: 'id of the simulation on screen' },
        param: { type: 'string', description: 'parameter id from the list in the system prompt' },
        value: { type: ['number', 'string'], description: 'number for sliders, option value for choices, "run" for buttons' },
      }, required: ['sim', 'param', 'value'] } },
    },
  },
  {
    toolSpec: {
      name: 'explain',
      description: 'The spoken answer, read aloud by the TV and shown as a caption. Call exactly once, after any other tools.',
      inputSchema: { json: { type: 'object', properties: {
        text: { type: 'string', description: 'one or two short sentences, under 40 words, plain spoken English' },
      }, required: ['text'] } },
    },
  },
]

const fmtControl = (c, hint) => {
  let range = ''
  if (c.kind === 'slider') range = `number from ${c.min} to ${c.max} (step ${c.step}), now ${round(c.value)}${c.display ? ` (${c.display})` : ''}`
  else if (c.kind === 'seg') range = `one of ${c.options.map(o => `"${o[0]}" (${o[1]})`).join(', ')}, now "${c.value}"`
  else range = 'button, value "run"'
  return `- ${c.id} [${c.label || c.id}]: ${range}.${hint ? ` Meaning: ${hint}` : ''}`
}
const round = v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)

/** the system prompt: who the model is, the rules, and exactly what is on screen right now */
export function systemPrompt(state) {
  const info = simInfo(state.sim) ?? { title: state.sim, about: '', params: {}, moves: [] }
  const others = CATALOG.sims.filter(s => s.id !== state.sim).map(s => `${s.title}${s.live ? '' : ' (coming soon)'}`).join(', ')
  return [
    'You are the voice of Megastructures TV, a living room app of interactive engineering films on Fire TV.',
    'A family is watching a live 3D simulation and just asked a question with the remote. Answer by CHANGING the simulation so they can see the answer happen, then explain it out loud.',
    '',
    'Rules:',
    '- Always call explain exactly once, as the last tool. Under 40 words, one or two sentences, plain words a 10 year old understands. No markdown, no lists, no emoji, no exclamation marks. Tell them what to watch on screen. Use real numbers from the readings when they help.',
    '- Use jumpToChapter when a different chapter shows the answer better. Call it before setParam, because a jump resets the chapter settings.',
    '- Use setParam to change the simulation. Only use the parameter ids and values listed below and stay inside the ranges. Pick values that make the effect clearly visible.',
    `- Only change the simulation on screen (sim id "${state.sim}"). If the question is about another film (${others}), say how to get there (press Back, then pick it) and change nothing.`,
    '- If the question is not about the film, answer briefly and kindly with explain only.',
    '- Never invent physics the model does not have. The simulations are simplified models built on public figures.',
    '',
    `On screen: ${info.over ?? ''} ${info.title} (sim id "${state.sim}").`,
    info.about,
    '',
    `Current chapter: "${state.chapter}".`,
    'Chapters (id: title, subtitle):',
    ...(state.chapters ?? []).map(c => `- ${c.id}: ${c.tab}, ${c.kicker}`),
    '',
    'Parameters (live values and ranges):',
    ...(state.controls ?? []).map(c => fmtControl(c, info.params?.[c.id])),
    '',
    state.stats?.length ? `Readings on screen now: ${state.stats.map(s => `${s.k} ${s.v}${s.u ? ' ' + s.u : ''}`).join(', ')}.` : '',
    info.moves?.length ? 'Good moves:\n' + info.moves.map(m => `- ${m}`).join('\n') : '',
  ].filter(x => x !== undefined).join('\n')
}

/**
 * Check every tool call against the live snapshot. Unknown params and chapters are dropped,
 * numbers are clamped into range and snapped to the step, choices are matched by value or label.
 * Returns the actions the TV may apply, the spoken text, and notes on anything that was fixed.
 */
export function validate(state, calls) {
  const actions = []
  const notes = []
  let say = ''
  for (const call of calls) {
    const input = call.input ?? {}
    if (call.name === 'explain') { if (!say && typeof input.text === 'string') say = input.text.trim(); continue }
    if (input.sim && input.sim !== state.sim) { notes.push(`ignored ${call.name} for other sim ${input.sim}`); continue }
    if (call.name === 'jumpToChapter') {
      const want = String(input.chapter ?? '').toLowerCase()
      const ch = (state.chapters ?? []).find(c => c.id.toLowerCase() === want || c.tab.toLowerCase() === want)
      if (!ch) { notes.push(`unknown chapter ${input.chapter}`); continue }
      actions.push({ type: 'jumpToChapter', sim: state.sim, chapter: ch.id, label: ch.tab })
    } else if (call.name === 'setParam') {
      const c = (state.controls ?? []).find(x => x.id === input.param)
      if (!c) { notes.push(`unknown param ${input.param}`); continue }
      if (c.kind === 'slider') {
        let v = Number(input.value)
        if (!Number.isFinite(v)) { notes.push(`not a number for ${c.id}: ${input.value}`); continue }
        const clamped = Math.min(c.max, Math.max(c.min, v))
        if (clamped !== v) notes.push(`clamped ${c.id} ${v} to ${clamped}`)
        v = c.step ? Math.round((clamped - c.min) / c.step) * c.step + c.min : clamped
        v = Math.min(c.max, Math.max(c.min, Number(v.toFixed(6))))
        actions.push({ type: 'setParam', sim: state.sim, param: c.id, value: v, label: c.label })
      } else if (c.kind === 'seg') {
        const want = String(input.value).toLowerCase()
        const opt = c.options.find(o => o[0].toLowerCase() === want || o[1].toLowerCase() === want)
        if (!opt) { notes.push(`unknown option ${input.value} for ${c.id}`); continue }
        actions.push({ type: 'setParam', sim: state.sim, param: c.id, value: opt[0], label: c.label, display: opt[1] })
      } else {
        actions.push({ type: 'setParam', sim: state.sim, param: c.id, value: 'run', label: c.label || c.id })
      }
    }
  }
  return { actions, say, notes }
}

/** keyword rules for offline use and tests: the same action format, never presented as AI */
export function mockAnswer(state, question) {
  const q = question.toLowerCase()
  const calls = []
  const say = t => calls.push({ name: 'explain', input: { text: t } })
  const jump = c => calls.push({ name: 'jumpToChapter', input: { sim: state.sim, chapter: c } })
  const set = (p, v) => calls.push({ name: 'setParam', input: { sim: state.sim, param: p, value: v } })
  if (state.sim === 'tbm') {
    if (/screw|faster|fast/.test(q)) { jump('street'); set('screw', 1.9); say('The screw now pulls spoil out faster than the cutter digs, so the pressure at the face drops and the ground flows in. Watch the street sink.') }
    else if (/slow/.test(q)) { jump('street'); set('screw', 0.5); say('A slow screw leaves too much spoil in the chamber. The pressure climbs and pushes the street up.') }
    else if (/granite|rock|hard/.test(q)) { jump('face'); set('ground', 'granite'); say('Granite is hard, so the disc cutters crack it instead of scraping it. The machine slows right down.') }
    else if (/ring|segment|lining/.test(q)) { jump('ring'); say('Behind the cutter, a robot arm places eight concrete segments to build one ring of the tunnel wall.') }
    else say('This machine bores a tunnel under a street while holding the ground up with pressure.')
  } else if (state.sim === 'starship') {
    if (/inside|tank|fuel/.test(q)) { jump('tanks'); set('view', 'cut'); set('follow', 'lox'); say('Most of the rocket is two huge tanks. The blue one is liquid oxygen, the orange one is liquid methane.') }
    else if (/top|separat|stag|come off/.test(q)) { jump('staging'); say('Watch the top. The ship lights its own engines while still attached, then pushes away from the booster.') }
    else if (/engine/.test(q)) { jump('engines'); say('The booster has 33 Raptor engines and the ship has 6 more.') }
    else say('This is Starship, the biggest rocket ever flown, just above the clouds.')
  } else if (state.sim === 'tsunami') {
    if (/wall/.test(q)) { jump('wall'); set('wall', 45); say('At this earthquake the wave reaches the shore taller than a ten storey building. Watch the wall rise to 45 metres. Now it holds.') }
    else if (/small|weaker|less/.test(q)) { set('mw', 8); jump('city'); say('A magnitude 8 releases about thirty times less energy than 9.1. The wave is much smaller at the city.') }
    else if (/fast|speed/.test(q)) { jump('wave'); say('Over deep ocean the wave moves about as fast as a jet plane, and it is only a few metres high.') }
    else say('A tsunami starts when the sea floor jumps up in an earthquake and lifts the whole ocean above it.')
  }
  if (!calls.some(c => c.name === 'explain')) say('Ask me about what you see on screen.')
  return calls
}

export const recordingKey = (sim, question) => `${sim}--${question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`

export function readRecording(sim, question) {
  const f = RECORDINGS + recordingKey(sim, question) + '.json'
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
}

/** one question in, one validated answer out */
export async function ask(state, env = process.env) {
  const question = String(state.question ?? '').trim().slice(0, 400)
  if (!question) throw Object.assign(new Error('empty question'), { status: 400 })
  if (!simInfo(state.sim)) throw Object.assign(new Error(`unknown sim ${state.sim}`), { status: 400 })
  const mode = env.VOICE_MODE || (env.AWS_BEARER_TOKEN_BEDROCK ? 'ask' : 'mock')
  const t0 = Date.now()

  if (mode === 'replay') {
    const rec = readRecording(state.sim, question)
    if (rec) return { ...rec.response, source: 'replay', recordedAt: rec.recordedAt }
    if (!env.AWS_BEARER_TOKEN_BEDROCK) return finish('mock', mockAnswer(state, question))
  }
  if (mode === 'mock' || !env.AWS_BEARER_TOKEN_BEDROCK) return finish('mock', mockAnswer(state, question))

  const model = env.BEDROCK_CLAUDE_MODEL || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
  const res = await converse({
    region: env.AWS_REGION || 'us-east-1', token: env.AWS_BEARER_TOKEN_BEDROCK, model,
    system: [{ text: systemPrompt(state) }],
    messages: [{ role: 'user', content: [{ text: question }] }],
    toolConfig: { tools: TOOLS, toolChoice: { any: {} } },
    inferenceConfig: { maxTokens: 700, temperature: 0.2 },
  })
  const content = res.output?.message?.content ?? []
  const calls = content.filter(b => b.toolUse).map(b => ({ name: b.toolUse.name, input: b.toolUse.input }))
  const text = content.filter(b => b.text).map(b => b.text).join(' ').trim()
  const out = finish('bedrock', calls, { model, usage: res.usage, latencyMs: res.metrics?.latencyMs, fallbackText: text })
  if (env.RECORD === '1') {
    mkdirSync(RECORDINGS, { recursive: true })
    writeFileSync(RECORDINGS + recordingKey(state.sim, question) + '.json', JSON.stringify({ sim: state.sim, question, recordedAt: new Date().toISOString(), rawToolCalls: calls, response: out }, null, 2))
  }
  return out

  function finish(source, calls, extra = {}) {
    const v = validate(state, calls)
    const say = v.say || extra.fallbackText || 'I could not change the film for that one. Try asking about what you see.'
    return { source, question, say, actions: v.actions, notes: v.notes, ms: Date.now() - t0, model: extra.model, usage: extra.usage, latencyMs: extra.latencyMs }
  }
}
