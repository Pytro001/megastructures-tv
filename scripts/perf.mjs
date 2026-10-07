// npm run perf: measure each film with and without TV performance mode.
// Headless Chromium on this machine, 1920x1080, vsync and the 60 fps cap off so the numbers show headroom.
// Needs `npm run dev` running. Writes output/perf.json and prints a Markdown table.
import { launch } from './browser.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
const BASE = process.env.BASE || 'http://127.0.0.1:5302/'
const SHOTS = [['tbm', 'street'], ['starship', 'climb'], ['tsunami', 'city']]
const WARM = 5000, MEASURE = 10000
const b = await launch(['--disable-gpu-vsync', '--disable-frame-rate-limit'])
const rows = []
for (const [sim, ch] of SHOTS) {
  for (const tv of ['0', '1']) {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
    await p.goto(`${BASE}${sim}.html?tv=${tv}&c=${ch}`)
    await p.waitForFunction(() => typeof window.__perf === 'function', null, { timeout: 60000 })
    await p.waitForTimeout(WARM)
    // count frames in the page for MEASURE ms, and sample the meter
    const r = await p.evaluate(async ms => {
      const t0 = performance.now(); let n = 0; const dts = []; let last = t0
      await new Promise(res => { const f = now => { n++; dts.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
      dts.sort((a, b) => a - b)
      const s = window.__perf()
      return { fps: n / ((performance.now() - t0) / 1000), p95: dts[Math.floor(dts.length * 0.95)], calls: s.calls, tris: s.triangles, px: s.px, scale: s.scale }
    }, MEASURE)
    rows.push({ sim, chapter: ch, mode: tv === '1' ? 'TV mode' : 'desktop', ...r })
    console.log(sim, tv === '1' ? 'tv' : 'desktop', r.fps.toFixed(1), 'fps')
    await p.close()
  }
}
await b.close()
mkdirSync(new URL('../output/', import.meta.url), { recursive: true })
const result = JSON.stringify({ measuredAt: new Date().toISOString(), machine: 'Apple Silicon Mac, headless Chromium (ANGLE Metal), 1920x1080, vsync off', rows }, null, 2)
writeFileSync(new URL('../output/perf.json', import.meta.url), result)
// the performance card in the app reads the same numbers
writeFileSync(new URL('../tv/src/perf-results.json', import.meta.url), result)
console.log('\n| Film | Mode | fps | p95 frame ms | draw calls | triangles | render size |\n|---|---|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.sim} (${r.chapter}) | ${r.mode} | ${r.fps.toFixed(0)} | ${r.p95.toFixed(1)} | ${r.calls} | ${(r.tris / 1000).toFixed(0)}k | ${r.px} |`)
