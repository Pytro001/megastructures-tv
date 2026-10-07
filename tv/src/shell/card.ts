import { FILM, params, stepCssAnimations } from './env'
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

if (which === 'built') {
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
  ;(window as unknown as { __film: unknown }).__film = { ready: true, step: (dt: number, n = 1) => { for (let i = 0; i < n; i++) stepCssAnimations(dt) } }
}
