// npm run film  [-- --stills]  [-- --only=tbm,home]
// Records output/megastructures-tv-screen.mp4: 1920x1080, 30 fps, frame stepped through window.__film
// (never a live screen grab). Every remote press goes through the same bridge the Fire OS shell uses
// (window.MegaTV.key), and every answer is a real Amazon Bedrock response recorded earlier through the
// real UI (npm run record:answers), replayed here so the film is deterministic. Needs `npm run dev`.
// --stills writes only the poster stills (output/stills) and skips the video.
import { launch } from './browser.mjs'
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname
const BASE = process.env.BASE || 'http://127.0.0.1:5302/'
const FPS = 30
const STILLS = process.argv.includes('--stills')
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean)
const OUT = ROOT + 'output/megastructures-tv-screen.mp4'
mkdirSync(ROOT + 'output/stills', { recursive: true })

const rec = (sim, q) => {
  const f = `${ROOT}server/recordings/${sim}--${q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}.json`
  if (!existsSync(f)) throw new Error(`missing recording ${f}: run npm run record:answers`)
  return JSON.parse(readFileSync(f, 'utf8'))
}

// an ask: Menu, the words arriving as the recogniser hears them, thinking for the real Bedrock latency, the answer
function ask(at, sim, question) {
  const r = rec(sim, question)
  const words = question.split(' ')
  const ev = [[at, 'key', 'menu']]
  const t0 = at + 0.6, t1 = t0 + Math.max(0.9, words.length * 0.24)
  words.forEach((_, i) => ev.push([t0 + ((t1 - t0) * i) / words.length, 'partial', words.slice(0, i + 1).join(' ')]))
  ev.push([t1 + 0.2, 'final', question])
  const think = (r.response.latencyMs || 3000) / 1000
  ev.push([t1 + 0.2 + think, 'answer', r.response])
  return ev
}
const keys = (list) => list.map(([t, k]) => [t, 'key', k])

const SEGMENTS = [
  { id: 'tbm', url: 'tbm.html?film=1', chapter: 0, dur: 25, stills: [[3.0, '01-tbm-street-above'], [8.0, '02-ask-listening'], [19.0, '03-street-sinks']],
    events: ask(5.0, 'tbm', 'What happens if the screw turns faster?') },
  { id: 'home', url: 'index.html?film=1&focus=tbm', dur: 13, stills: [[5.5, '04-home-row']],
    events: keys([[1.6, 'right'], [3.2, 'right'], [4.8, 'right'], [6.2, 'select'], [7.8, 'left'], [9.4, 'left'], [11.2, 'select']]) },
  { id: 'starship', url: 'starship.html?film=1', chapter: 0, dur: 38, stills: [[7.5, '05-starship-cutaway'], [32.0, '06-hot-staging']],
    events: [...keys([[4.0, 'right'], [9.0, 'right'], [14.0, 'right']]), ...ask(18.5, 'starship', 'When does the top part come off?')] },
  { id: 'tsunami', url: 'tsunami.html?film=1', chapter: 5, dur: 32, stills: [[4.5, '07-tsunami-city'], [17.0, '08-sea-wall-holds'], [26.0, '09-drawer']],
    events: [...ask(5.5, 'tsunami', 'Can a wall stop it?'), ...keys([[21.5, 'select'], [22.6, 'down'], [23.4, 'left'], [23.9, 'left'], [24.4, 'left'], [24.9, 'left'], [25.4, 'left'], [25.9, 'left'], [29.5, 'back']])] },
  { id: 'arch', url: 'card.html?film=1&card=arch', dur: 13, stills: [[8, '10-architecture']], events: [] },
  { id: 'perf', url: 'card.html?film=1&card=perf', dur: 10, stills: [[6, '11-performance']], events: [] },
  { id: 'built', url: 'card.html?film=1&card=built', dur: 3.5, stills: [[2.8, '12-built-during-hackathon']], events: [] },
  { id: 'end', url: 'index.html?film=1&focus=tbm&remote=0', dur: 7, stills: [], events: [] },
].filter(s => !ONLY.length || ONLY.includes(s.id))

const b = await launch()
const ff = STILLS ? null : spawn('/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', 'pipe:0',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT])
let total = 0
for (const seg of SEGMENTS) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  p.on('pageerror', e => console.log('ERR', seg.id, e.message))
  await p.goto(BASE + seg.url)
  await p.waitForFunction(() => window.__film?.ready, null, { timeout: 90000 })
  await p.waitForTimeout(1500)
  // a black layer for the cut between segments
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'film-fade'; d.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;pointer-events:none;opacity:1'; document.body.appendChild(d) })
  if (seg.chapter !== undefined) {
    // warm every chapter off camera so shaders compile before the first real frame
    const n = await p.evaluate(() => window.__film.chapters.length)
    for (let i = 0; i < n; i++) await p.evaluate(i => { window.__film.goto(i); window.__film.step(1 / 30, 6) }, i)
    await p.evaluate(c => window.__film.goto(c, false), seg.chapter)
  }
  const frames = Math.round(seg.dur * FPS)
  const events = [...seg.events].sort((a, b) => a[0] - b[0])
  const stills = [...seg.stills]
  let e = 0
  for (let i = 0; i < frames; i++) {
    const t = i / FPS
    while (e < events.length && events[e][0] <= t) {
      const [, type, arg] = events[e++]
      await p.evaluate(([type, arg]) => {
        if (type === 'key') window.MegaTV.key(arg)
        else if (type === 'partial') window.__tv.setTranscript(arg)
        else if (type === 'final') { window.__tv.setTranscript(arg, true); window.__tv.thinking() }
        else if (type === 'answer') window.__tv.answer(arg)
      }, [type, arg])
    }
    const fade = Math.min(1, t / 0.4, (seg.dur - t) / 0.4)
    await p.evaluate(([dt, o]) => { window.__film.step(dt); document.getElementById('film-fade').style.opacity = String(1 - o) }, [i ? 1 / FPS : 0, Math.max(0, fade)])
    const still = stills.length && stills[0][0] <= t ? stills.shift() : null
    if (ff) {
      const jpg = await p.screenshot({ type: 'jpeg', quality: 92 })
      if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r))
    }
    if (still) { await p.screenshot({ path: `${ROOT}output/stills/${still[1]}.jpg`, type: 'jpeg', quality: 85 }); console.log('still', still[1]) }
    if (i % 150 === 0) console.log(seg.id, 'frame', i, '/', frames)
  }
  total += frames
  await p.close()
}
await b.close()
if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('done', OUT, (total / FPS).toFixed(1), 's') }
