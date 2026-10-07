// npm run record:answers: ask the demo questions through the real TV UI against the real API,
// with the API started as `RECORD=1 VOICE_MODE=ask npm run server`. Each Bedrock answer is saved to
// server/recordings/<sim>--<question>.json, and the film replays exactly those answers.
import { launch } from './browser.mjs'
import { existsSync } from 'node:fs'
const QUESTIONS = [
  ['tbm', 'lab', 'What happens if the screw turns faster?'],
  ['tbm', 'face', 'What if we dig through granite?'],
  ['starship', 'engines', 'When does the top part come off?'],
  ['starship', 'climb', "What's inside the rocket?"],
  ['tsunami', 'city', 'Can a wall stop it?'],
]
const b = await launch()
for (const [sim, ch, q] of QUESTIONS) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
  p.on('pageerror', e => console.log('ERR', e.message))
  await p.goto(`http://127.0.0.1:5302/${sim}.html?c=${ch}`)
  await p.waitForFunction(() => window.__tv, null, { timeout: 60000 })
  await p.waitForTimeout(3000)
  const a = await p.evaluate(async q => { window.__tv.openAsk(false); return window.__tv.ask(q) }, q)
  console.log(`${sim}: "${q}" -> ${a.source}, ${a.latencyMs} ms, ${a.actions.map(x => x.chapter ?? `${x.param}=${x.value}`).join(', ')}\n   "${a.say}"`)
  await p.close()
}
await b.close()
const key = (sim, q) => `${sim}--${q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`
for (const [sim, , q] of QUESTIONS) console.log(existsSync(new URL(`../server/recordings/${key(sim, q)}.json`, import.meta.url)) ? 'saved' : 'NOT SAVED (start the API with RECORD=1)', key(sim, q))
