import { FILM, params, stepCssAnimations } from './env'
import perf from '../perf-results.json'
import './tv.css'
import './card.css'

/**
 * Two explainer cards for the demo film and for anyone curious:
 *   card.html?card=arch   how a question becomes a change in the simulation
 *   card.html?card=built  what was built during the hackathon
 * Status badges are honest: "live" parts ran in the film, "code ready" parts are written but not deployed.
 */

const root = document.getElementById('card')!
const which = params.get('card') ?? 'arch'
if (FILM) document.body.classList.add('tv-film')

const LIVE = '<i class="b live">live</i>'
const READY = '<i class="b ready">code ready</i>'

if (which === 'perf') {
  // the numbers come from scripts/perf.mjs (output/perf.json), measured on a laptop GPU, not on a Fire TV Stick
  const names: Record<string, string> = { tbm: 'Tunnel Boring Machine', starship: 'Starship', tsunami: 'Tsunami' }
  const sims = [...new Set(perf.rows.map(r => r.sim))]
  const max = Math.max(...perf.rows.map(r => r.fps)) / 0.8
  root.className = 'c-perf'
  root.innerHTML = `<h1>TV performance mode</h1><p class="sub">No multisampling, smaller shadow maps, a fixed light budget, lower ray march steps and terrain detail, dynamic resolution</p>
    <div class="bars">${sims.map((s, i) => {
      const d = perf.rows.find(r => r.sim === s && r.mode === 'desktop')!, t = perf.rows.find(r => r.sim === s && r.mode === 'TV mode')!
      return `<div class="pr" style="--i:${i}"><div class="pn">${names[s] ?? s}</div>
        <div class="pb"><i class="d" style="--w:${(d.fps / max) * 100}%"></i><span>${d.fps.toFixed(0)} fps</span></div>
        <div class="pb"><i class="t" style="--w:${(t.fps / max) * 100}%"></i><span>${t.fps.toFixed(0)} fps</span></div></div>`
    }).join('')}</div>
    <div class="legend" style="--i:4"><i class="sw d"></i>desktop quality &nbsp;&nbsp; <i class="sw t"></i>TV mode &nbsp;&nbsp; measured at 1920x1080 on a laptop GPU, vsync off</div>`
} else if (which === 'built') {
  const items = ['Fire OS shell', 'D-pad UI', 'Voice to simulation', 'TV performance mode', 'Open source engine']
  root.className = 'c-built'
  root.innerHTML = `<h1>Built during the hackathon</h1><ul>${items.map((t, i) => `<li style="--i:${i}"><span class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>${t}</li>`).join('')}</ul>`
} else {
  root.className = 'c-arch'
  const node = (i: number, title: string, sub: string, badge: string) => `<div class="n" style="--i:${i}"><div class="nt">${title}${badge}</div><div class="ns">${sub}</div></div>`
  root.innerHTML = `
    <h1>How a question changes the film</h1>
    <div class="flow">
      ${node(0, 'Fire TV remote', 'D-pad for chapters and settings. Menu to ask.', '')}
      <span class="ar" style="--i:0.5"></span>
      ${node(1, 'Fire OS app', 'Kotlin WebView shell, Leanback launcher, key bridge, SpeechRecognizer', READY)}
      <span class="ar" style="--i:1.5"></span>
      ${node(2, 'Live 3D film', 'Three.js scene engine in TV performance mode', LIVE)}
      <span class="ar" style="--i:2.5"></span>
      ${node(3, 'Answer service', '/api/ask in Node today. Same handler for AWS Lambda and API Gateway.', LIVE)}
      <span class="ar" style="--i:3.5"></span>
      ${node(4, 'Amazon Bedrock', 'Claude Sonnet 4.5, Converse API, tool use', LIVE)}
    </div>
    <div class="back" style="--i:5">
      <div class="tools"><code>jumpToChapter</code><code>setParam</code><code>explain</code></div>
      <div class="bt">Tool calls come back, are checked against the live ranges on screen, and move the simulation. The answer is spoken and captioned.</div>
    </div>
    <div class="legend" style="--i:6">${LIVE} ran in this video &nbsp;&nbsp; ${READY} written, not deployed: Lambda, API Gateway, Amazon Polly, S3, Fire OS build</div>`
}

if (FILM) {
  stepCssAnimations(0)
  ;(window as unknown as { __film: unknown }).__film = { ready: true, step: (dt: number, n = 1) => { for (let i = 0; i < n; i++) stepCssAnimations(dt) } }
}
