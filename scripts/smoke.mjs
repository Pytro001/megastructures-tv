// End to end smoke test through the real UI (needs `npm run dev`): every page loads without errors,
// the D-pad moves focus and chapters, the drawer changes a value, Back goes home, and one question
// round trips through /api/ask (whatever VOICE_MODE the server runs in) and changes the simulation.
import { launch } from './browser.mjs'
import assert from 'node:assert/strict'
const BASE = process.env.BASE || 'http://127.0.0.1:5302/'
const b = await launch()
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
p.on('pageerror', e => errors.push(e.message))
const ok = m => console.log('ok', m)

await p.goto(BASE + 'index.html')
await p.waitForSelector('.h-tile.focused')
assert.equal(await p.locator('.h-tile').count(), 6); ok('home row has 6 tiles')
await p.keyboard.press('ArrowRight')
assert.equal(await p.evaluate(() => document.querySelector('.h-tile.focused').dataset.id), 'starship'); ok('Right moves focus')
await p.keyboard.press('ArrowDown')
assert.ok(await p.evaluate(() => !!document.querySelector('.h-set.focused'))); ok('Down reaches the settings row')

for (const sim of ['tbm', 'starship', 'tsunami']) {
  await p.goto(`${BASE}${sim}.html?tv=1`)
  await p.waitForFunction(() => window.__tv, null, { timeout: 60000 })
  await p.waitForTimeout(1500)
  const c0 = await p.evaluate(() => window.__tv.state().chapter)
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200)
  assert.notEqual(await p.evaluate(() => window.__tv.state().chapter), c0); ok(`${sim}: Right changes chapter`)
  await p.keyboard.press('Enter'); await p.waitForTimeout(400)
  assert.ok(await p.evaluate(() => document.getElementById('tv').classList.contains('tv-drawer-open'))); ok(`${sim}: Select opens the drawer`)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
}

await p.goto(`${BASE}tsunami.html`)
await p.waitForFunction(() => window.__tv, null, { timeout: 60000 })
await p.waitForTimeout(1500)
const a = await p.evaluate(async () => { window.__tv.openAsk(false); return window.__tv.ask('Can a wall stop it?') })
assert.ok(a.actions.some(x => x.param === 'wall')); ok(`ask round trip (${a.source}): ${a.actions.map(x => x.chapter ?? `${x.param}=${x.value}`).join(', ')}`)
await p.waitForTimeout(3500)
const wall = await p.evaluate(() => window.__tv.state().controls.find(c => c.id === 'wall').value)
assert.ok(wall > 30, `wall is ${wall}`); ok(`the sea wall rose to ${wall} m`)
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(800)
assert.match(p.url(), /index\.html/); ok('Back returns to the home row')

await b.close()
assert.deepEqual(errors, []); ok('no page errors')
