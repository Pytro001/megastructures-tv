// node scripts/posters.mjs: render the home row posters from the films themselves (needs npm run dev)
import { launch } from './browser.mjs'
import { mkdirSync } from 'node:fs'
const out = new URL('../tv/public/posters/', import.meta.url).pathname
mkdirSync(out, { recursive: true })
// sim, chapter index, seconds into the chapter
const SHOTS = (process.argv[2] ? JSON.parse(process.argv[2]) : [['tbm', 4, 3.0], ['starship', 0, 6.0], ['tsunami', 5, 4.5]])
const b = await launch()
for (const [sim, ch, sec] of SHOTS) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  p.on('pageerror', e => console.log('ERR', e.message))
  await p.goto(`http://127.0.0.1:5302/${sim}.html?film=1&clean=1`)
  await p.waitForFunction(() => window.__film?.ready, null, { timeout: 60000 })
  await p.waitForTimeout(1500)
  await p.evaluate(([ch, sec]) => { window.__film.goto(ch, true); window.__film.step(1 / 30, Math.round(sec * 30)) }, [ch, sec])
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${out}${sim}.jpg`, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1920, height: 1080 } })
  console.log('poster', sim)
  await p.close()
}
await b.close()
