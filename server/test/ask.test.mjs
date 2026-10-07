// node --test server/test/*.test.mjs   (no network: mock and replay modes only)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate, mockAnswer, systemPrompt, ask, recordingKey, TOOLS, CATALOG } from '../ask.mjs'
import { handler } from '../lambda.mjs'
import { route } from '../index.mjs'

const TBM = {
  sim: 'tbm', chapter: 'lab',
  chapters: [{ id: 'lab', tab: 'The machine', kicker: 'EPB shield' }, { id: 'street', tab: 'The street', kicker: 'Face pressure vs settlement' }, { id: 'ring', tab: 'Build a ring', kicker: '8 segments' }],
  controls: [
    { id: 'cut', kind: 'slider', label: 'Cut in half', min: 0, max: 1, step: 0.001, value: 0 },
    { id: 'ground', kind: 'seg', label: 'Ground', options: [['clay', 'Clay'], ['sand', 'Sand'], ['granite', 'Granite']], value: 'clay' },
    { id: 'screw', kind: 'slider', label: 'Screw conveyor', min: 0.3, max: 2.2, step: 0.01, value: 1 },
    { id: 'go', kind: 'button', label: 'Again' },
  ],
  stats: [{ k: 'Face', v: '1.80', u: 'bar' }],
}
const call = (name, input) => ({ name, input })

test('every catalog sim that is live has params, moves and suggestions', () => {
  for (const s of CATALOG.sims.filter(s => s.live)) {
    assert.ok(s.page && s.about && Object.keys(s.params).length >= 3 && s.moves.length && s.suggest.length === 3, s.id)
  }
})

test('the three tools are declared with JSON schemas', () => {
  assert.deepEqual(TOOLS.map(t => t.toolSpec.name), ['jumpToChapter', 'setParam', 'explain'])
  for (const t of TOOLS) assert.equal(t.toolSpec.inputSchema.json.type, 'object')
})

test('validate keeps good calls, clamps numbers, snaps to step and matches options by label', () => {
  const v = validate(TBM, [
    call('jumpToChapter', { sim: 'tbm', chapter: 'The street' }),
    call('setParam', { sim: 'tbm', param: 'screw', value: 9 }),
    call('setParam', { sim: 'tbm', param: 'ground', value: 'Granite' }),
    call('setParam', { sim: 'tbm', param: 'go', value: 'run' }),
    call('explain', { text: '  The street sinks.  ' }),
  ])
  assert.deepEqual(v.actions.map(a => [a.type, a.chapter ?? a.param, a.value]), [['jumpToChapter', 'street', undefined], ['setParam', 'screw', 2.2], ['setParam', 'ground', 'granite'], ['setParam', 'go', 'run']])
  assert.equal(v.say, 'The street sinks.')
  assert.ok(v.notes.some(n => n.includes('clamped screw 9 to 2.2')))
})

test('validate drops unknown params, unknown chapters, other sims and bad numbers', () => {
  const v = validate(TBM, [
    call('setParam', { sim: 'tbm', param: 'warp', value: 1 }),
    call('jumpToChapter', { sim: 'tbm', chapter: 'moon' }),
    call('setParam', { sim: 'starship', param: 'view', value: 'cut' }),
    call('setParam', { sim: 'tbm', param: 'screw', value: 'fast' }),
    call('setParam', { sim: 'tbm', param: 'ground', value: 'cheese' }),
  ])
  assert.equal(v.actions.length, 0)
  assert.equal(v.notes.length, 5)
})

test('step snapping stays inside the range', () => {
  const v = validate(TBM, [call('setParam', { sim: 'tbm', param: 'screw', value: 1.234567 })])
  assert.equal(v.actions[0].value, 1.23)
})

test('the system prompt carries the live ranges, the chapter list and the physical meaning', () => {
  const p = systemPrompt(TBM)
  assert.match(p, /screw \[Screw conveyor\]: number from 0\.3 to 2\.2/)
  assert.match(p, /street: The street/)
  assert.match(p, /street above SINKS/)
  assert.match(p, /Readings on screen now: Face 1\.80 bar/)
})

test('mock mode answers the three demo questions with the right actions', async () => {
  const env = { VOICE_MODE: 'mock' }
  const a = await ask({ ...TBM, question: 'What happens if the screw turns faster?' }, env)
  assert.equal(a.source, 'mock')
  assert.deepEqual(a.actions.map(x => x.chapter ?? `${x.param}=${x.value}`), ['street', 'screw=1.9'])
  const ts = { sim: 'tsunami', chapter: 'coast', chapters: [{ id: 'wall', tab: 'The wall', kicker: '' }, { id: 'city', tab: 'The city', kicker: '' }], controls: [{ id: 'wall', kind: 'slider', label: 'Sea wall', min: 0, max: 50, step: 0.5, value: 10 }] }
  const b = await ask({ ...ts, question: 'Can a wall stop it?' }, env)
  assert.deepEqual(b.actions.map(x => x.chapter ?? `${x.param}=${x.value}`), ['wall', 'wall=45'])
  const ss = { sim: 'starship', chapter: 'climb', chapters: [{ id: 'staging', tab: 'Hot staging', kicker: '' }, { id: 'tanks', tab: 'Tanks', kicker: '' }], controls: [{ id: 'view', kind: 'seg', label: 'Starship', options: [['whole', 'Whole'], ['cut', 'Cutaway']], value: 'whole' }, { id: 'follow', kind: 'seg', label: 'Follow', options: [['all', 'All'], ['lox', 'Oxygen']], value: 'all' }] }
  const c = await ask({ ...ss, question: 'When does the top part come off?' }, env)
  assert.deepEqual(c.actions.map(x => x.chapter), ['staging'])
})

test('replay mode answers from a recording when there is one, and says so', async () => {
  const a = await ask({ ...TBM, question: 'What happens if the screw turns faster?' }, { VOICE_MODE: 'replay' })
  assert.ok(['replay', 'mock'].includes(a.source))
})

test('bad input is a 400', async () => {
  await assert.rejects(ask({ sim: 'tbm', question: '' }, { VOICE_MODE: 'mock' }), e => e.status === 400)
  await assert.rejects(ask({ sim: 'nope', question: 'hi' }, { VOICE_MODE: 'mock' }), e => e.status === 400)
})

test('recording keys are stable file names', () => {
  assert.equal(recordingKey('tbm', 'What happens if the screw turns faster?'), 'tbm--what-happens-if-the-screw-turns-faster')
})

test('the Lambda handler serves the same routes as the local server', async () => {
  process.env.VOICE_MODE = 'mock'
  const r = await handler({ rawPath: '/api/ask', requestContext: { http: { method: 'POST' } }, body: JSON.stringify({ ...TBM, question: 'what if we dig through granite?' }) })
  assert.equal(r.statusCode, 200)
  const body = JSON.parse(r.body)
  assert.ok(body.actions.some(a => a.param === 'ground' && a.value === 'granite'))
  const h = await handler({ rawPath: '/api/health', requestContext: { http: { method: 'GET' } } })
  assert.equal(h.statusCode, 200)
  const tts = await route('POST', '/api/tts', JSON.stringify({ text: 'hi' }), { TTS_PROVIDER: 'browser' }).catch(e => e)
  assert.equal(tts.status, 404)
})
