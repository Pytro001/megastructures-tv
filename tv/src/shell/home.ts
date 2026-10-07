import { onRemote } from 'megastructures-engine/tv/remote'
import { FocusEngine } from 'megastructures-engine/tv/focus'
import catalog from '../catalog.json'
import { FILM, TV_MODE, DEBUG, SHOW_REMOTE, params, link, store, stepCssAnimations, native } from './env'
import { RemoteOverlay } from './remote-overlay'
import './tv.css'
import './home.css'

/**
 * The home row. Left and Right pick a film, the backdrop and the copy follow
 * the focus, Select opens it. Down reaches the settings row, so every setting
 * is reachable with the five D-pad buttons.
 */

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
if (FILM) document.body.classList.add('tv-film')

const sims = catalog.sims
const tiles = $('.h-tiles')
tiles.innerHTML = sims.map(s => `
  <button class="h-tile ${s.live ? '' : 'soon'}" data-focus data-id="${s.id}">
    <span class="h-poster" ${s.poster ? `style="background-image:url('${s.poster}')"` : ''}></span>
    ${s.live ? '' : `<span class="h-art h-art-${s.id}"></span><em>Coming soon</em>`}
    <strong>${esc(s.title)}</strong>
  </button>`).join('')

let remoteOn = SHOW_REMOTE
let debugOn = DEBUG
const settings = [
  { id: 'tv', label: () => `TV performance mode: ${TV_MODE ? 'On' : 'Off'}`, run: () => { store('tv', TV_MODE ? '0' : '1'); location.href = link('index.html', { tv: TV_MODE ? '0' : '1', focus: 'tv-set' }) } },
  { id: 'fps', label: () => `Frame rate overlay: ${debugOn ? 'On' : 'Off'}`, run: () => { debugOn = !debugOn; store('debug', debugOn ? '1' : '0') } },
  { id: 'remote', label: () => `Remote on screen: ${remoteOn ? 'On' : 'Off'}`, run: () => { remoteOn = !remoteOn; remote.el.style.display = remoteOn ? '' : 'none' } },
]
const setRow = $('.h-settings')
function renderSettings() { setRow.innerHTML = settings.map(s => `<button class="h-set" data-focus data-set="${s.id}">${esc(s.label())}</button>`).join('') }
renderSettings()

const hero = { over: $('.h-over'), title: $('.h-title'), blurb: $('.h-blurb'), meta: $('.h-meta') }
const imgs = [$('.h-img.a'), $('.h-img.b')]
let front = 0
let shown = ''

function showSim(id: string) {
  const s = sims.find(x => x.id === id)
  if (!s || id === shown) return
  shown = id
  hero.over.textContent = s.over
  hero.title.textContent = s.title
  hero.blurb.textContent = s.blurb
  hero.meta.textContent = s.meta
  const sec = $('.h-hero')
  sec.classList.remove('in'); void sec.offsetWidth; sec.classList.add('in')
  // crossfade the backdrop
  const next = imgs[1 - front]
  next.style.backgroundImage = s.poster ? `url('${s.poster}')` : 'none'
  next.className = `h-img ${front ? 'a' : 'b'} on ${s.poster ? '' : 'h-art h-art-' + s.id}`
  imgs[front].classList.remove('on')
  front = 1 - front
}

/** keep the focused tile on screen: the row slides, the focus ring does not jump off the edge */
function scrollRow(el: HTMLElement) {
  const track = $('.h-track')
  const tw = track.clientWidth
  const x = el.offsetLeft, w = el.offsetWidth
  const cur = -parseFloat(tiles.style.getPropertyValue('--x') || '0')
  let nx = cur
  if (x - cur < 0) nx = x
  else if (x + w - cur > tw) nx = x + w - tw
  tiles.style.setProperty('--x', `${-nx}px`)
}

const focus = new FocusEngine(document.querySelector('.h-safe') as HTMLElement, {
  initial: `[data-id="${params.get('focus') ?? 'tbm'}"]`,
  wrap: true,
  onFocus: el => {
    if (el.dataset.id) { showSim(el.dataset.id); scrollRow(el) }
    document.body.classList.toggle('h-in-settings', !!el.dataset.set)
  },
  onSelect: el => {
    if (el.dataset.set) { settings.find(s => s.id === el.dataset.set)!.run(); const id = el.dataset.set; renderSettings(); focus.refresh(`[data-set="${id}"]`); return }
    const s = sims.find(x => x.id === el.dataset.id)!
    if (!s.live || !('page' in s)) { toast(`${s.title} is coming to TV next`); return }
    el.classList.add('opening')
    if (FILM) return // the film recorder cuts to the film page itself
    document.body.classList.add('leaving')
    setTimeout(() => { location.href = link((s as { page: string }).page) }, 380)
  },
})
if (params.get('focus') === 'tv-set') focus.refresh('[data-set="tv"]')
if (!focus.current?.dataset.id) showSim('tbm')

function toast(t: string) { const el = $('.h-toast'); el.textContent = t; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on') }

const remote = new RemoteOverlay(document.body)
remote.el.style.display = remoteOn ? '' : 'none'

onRemote(e => {
  const k = e.key
  if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { focus.move(k); return true }
  if (k === 'select') { focus.select(); return true }
  if (k === 'menu' || k === 'mic') { toast('Open a film, then press Menu to ask about it'); return true }
  if (k === 'back') {
    if (focus.current?.dataset.set) { focus.refresh('.h-tile'); return true }
    // on the home row Back leaves the app; the native shell does that when the page does not consume it
    native()?.exit?.()
    return false
  }
  return false
})

/* ---------------- loop and film ---------------- */
let last = performance.now()
function tick(dt: number) { remote.tick(dt); if (FILM) stepCssAnimations(dt) }
if (FILM) {
  stepCssAnimations(0)
  ;(window as unknown as { __film: unknown }).__film = { ready: true, step: (dt: number, n = 1) => { for (let i = 0; i < n; i++) tick(dt) } }
} else {
  const loop = (now: number) => { tick(Math.min(0.05, (now - last) / 1000)); last = now; requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
}
