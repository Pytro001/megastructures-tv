import * as THREE from 'three'
import { Pipeline } from 'megastructures-engine/render/dof'
import { studioEnvironment } from 'megastructures-engine/scene/studio-env'
import { Sim, TBM, headSpin } from './sim'
import { Machine } from './machine'
import { Tunnel } from './tunnel'
import { Ground } from './ground'
import { Lab, S, MODEL_OFF } from './lab'
import { HL, CUT_M } from './mats'
import { buildChapters, controls, applyState, Rig, State, type Control, type View, type World } from './chapters'
import { audio, sfx } from './sfx'
import '../roman.css'
import '../tbm.css'
import { mountShell } from '../../shell/sim-shell'
import { TV_MODE } from '../../shell/env'
import { TV, DESKTOP, setShadowMapSize, capLights } from 'megastructures-engine/tv/quality'

/**
 * How a tunnel boring machine works: a 1:30 model of a 12 m earth pressure
 * balance machine boring under a street, on a bench in a dark studio.
 * Cut it in half, change the ground, turn the head, play with the screw
 * conveyor and watch the street above sink or heave, build a ring.
 * Plays itself; touch to take over.
 */

const params = new URLSearchParams(location.search)
const FILM = params.has('film')
const canvas = document.getElementById('gl') as HTMLCanvasElement
const pipe = new Pipeline(canvas, FILM)
const renderer = pipe.renderer
const Q = TV_MODE ? { ...TV } : { ...DESKTOP }
if (Q.tv) { pipe.setSamples(Q.samples); pipe.scene.dof = false }
let tvScale = Q.maxScale

/* ---------------- scene ---------------- */
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050608)
scene.fog = new THREE.Fog(0x050608, 6, 16)
scene.environment = studioEnvironment(renderer)
scene.environmentIntensity = 0.32
const cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.02, 40)

const sim = new Sim()
const lab = new Lab()
scene.add(lab.root)
const model = new THREE.Group()
model.scale.setScalar(S)
model.position.copy(MODEL_OFF)
scene.add(model)
const machine = new Machine()
model.add(machine.root)
const tun = new Tunnel(machine)
model.add(tun.root)
tun.root.add(tun.sparkLight)
const ground = new Ground()
model.add(ground.root)
HL.clipX.value = MODEL_OFF.x + (TBM.X0 - 0.02) * S
// a warm light inside the tunnel and one at the face, fixed counts
for (const L of tun.lamps) L.intensity = 0
// TV performance mode: smaller shadow maps and a fixed, small light budget
if (Q.tv) { setShadowMapSize(scene, Q.shadowMap); capLights(scene, Q.lights) }

const rig = new Rig()
const state = new State()
const world: World = { sim, m: machine, tun, ground, lab, cam, rig, state }
const chapters = buildChapters(world)
const ctl = controls(world)
pipe.scene.scene = scene
pipe.scene.camera = cam

/* ---------------- HUD ---------------- */
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const hud = {
  kicker: $('#kicker'), stats: $('#stats'), text: $('#text'),
  controls: $('#controls'), tabs: $('#tabs'), labels: $('#labels'), play: $('#play'), auto: $('#auto'), sound: $('#sound'),
  cursor: $('#cursor'),
}

let idx = Math.max(0, chapters.findIndex(c => c.id === params.get('c')))
let auto = !params.has('manual')
let ct = 0
let fade = 0
let lastStats = '', lastText = ''

function buildTabs() {
  hud.tabs.innerHTML = chapters.map((c, i) => `<button data-i="${i}" class="tab${i === idx ? ' on' : ''}"><i></i>${c.tab}</button>`).join('')
  hud.tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { go(+b.getAttribute('data-i')!) }))
}
function controlHtml(c: Control) {
  if (c.kind === 'seg') return `<div class="row"><div class="lab">${c.label}</div><div class="seg" data-id="${c.id}">${c.options.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join('')}</div></div>`
  return `<div class="row"><div class="lab">${c.label}<span class="val" data-val="${c.id}"></span></div><input type="range" data-id="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}"></div>`
}
function buildControls() {
  hud.controls.innerHTML = ctl.map(controlHtml).join('') + '<div class="hint">Drag to look around · scroll to zoom</div>'
  for (const c of ctl) {
    if (c.kind === 'seg') hud.controls.querySelectorAll<HTMLButtonElement>(`.seg[data-id="${c.id}"] button`).forEach(b => b.addEventListener('click', () => { stopAuto(); c.set(b.dataset.v!); sfx('tick', { f: 1800, v: 0.15 }); syncControls() }))
    if (c.kind === 'slider') {
      const el = hud.controls.querySelector<HTMLInputElement>(`input[data-id="${c.id}"]`)!
      el.addEventListener('input', () => { stopAuto(); c.set(+el.value); if (c.id === 'cut' && +el.value > 0.01) cutSound(); syncControls() })
    }
  }
  syncControls()
}
let lastCutSnd = 0
function cutSound() { if (t - lastCutSnd > 1.2) { sfx('laser', { d: 1.2 }); lastCutSnd = t } }
function syncControls() {
  for (const c of ctl) {
    if (c.kind === 'seg') { const v = c.get(); hud.controls.querySelectorAll<HTMLButtonElement>(`.seg[data-id="${c.id}"] button`).forEach(b => b.classList.toggle('on', b.dataset.v === v)) }
    else {
      const el = hud.controls.querySelector<HTMLInputElement>(`input[data-id="${c.id}"]`)!
      if (document.activeElement !== el) el.value = String(c.get())
      const p = (c.get() - c.min) / (c.max - c.min); el.style.setProperty('--p', `${(p * 100).toFixed(1)}%`)
      hud.controls.querySelector<HTMLElement>(`[data-val="${c.id}"]`)!.textContent = c.fmt(c.get())
    }
  }
}
function go(i: number) {
  idx = (i + chapters.length) % chapters.length
  ct = 0; fade = 0
  chapters[idx].enter()
  hud.tabs.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === idx))
  hud.labels.innerHTML = ''
  labelEls.clear()
  if (!auto) chapters[idx].script(0.5, t)
  sfx('mood', { key: chapters[idx].mood })
  updateAutoUi()
}
function stopAuto() { if (auto) { auto = false; updateAutoUi() } }
function updateAutoUi() {
  hud.play.classList.toggle('playing', auto)
  hud.play.setAttribute('aria-label', auto ? 'Pause the tour' : 'Play the tour')
  hud.auto.textContent = auto ? 'plays itself' : 'your turn'
}
hud.play.addEventListener('click', () => { auto = !auto; if (auto) { ct = 0; chapters[idx].enter() } updateAutoUi() })

/* ---------------- sound ---------------- */
function syncSound() { hud.sound.classList.toggle('on', audio.on); hud.sound.setAttribute('aria-label', audio.on ? 'Mute' : 'Sound on') }
hud.sound.addEventListener('click', e => { e.stopPropagation(); audio.toggle(); setTimeout(syncSound, 60) })
const firstGesture = () => { if (!audio.on) { audio.start(); setTimeout(syncSound, 60) } removeEventListener('pointerdown', firstGesture, true); removeEventListener('keydown', firstGesture, true) }
if (!FILM) { addEventListener('pointerdown', firstGesture, true); addEventListener('keydown', firstGesture, true) }

/* ---------------- input ---------------- */
const pointer: View['pointer'] = { dx: 0, dy: 0, wheel: 0, down: false }
let px = 0, py = 0
canvas.addEventListener('pointerdown', e => { pointer.down = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); stopAuto() })
canvas.addEventListener('pointermove', e => { if (!pointer.down) return; pointer.dx += e.clientX - px; pointer.dy += e.clientY - py; px = e.clientX; py = e.clientY })
canvas.addEventListener('pointerup', () => { pointer.down = false })
canvas.addEventListener('pointercancel', () => { pointer.down = false })
canvas.addEventListener('wheel', e => { e.preventDefault(); pointer.wheel += e.deltaY; stopAuto() }, { passive: false })
// keys belong to the TV shell (see shell/sim-shell.ts)

/* ---------------- loop ---------------- */
let W = 1, H = 1
function resize() {
  W = FILM ? 1920 : innerWidth; H = FILM ? 1080 : innerHeight
  pipe.resize(W, H, FILM ? 1 : Q.tv ? tvScale : Math.min(devicePixelRatio, 2))
  cam.aspect = W / H; cam.updateProjectionMatrix()
}
addEventListener('resize', resize)

let t = 0
const labelEls = new Map<string, HTMLElement>()
let voiceT = 0, beepT = 0
let prevPhase = sim.phase
const curPos = { x: -100, y: -100, on: 0 }

function frame(dt: number) {
  t += dt
  const ch = chapters[idx]
  if (auto) {
    ct += dt
    if (ct >= ch.length) { go(idx + 1); return frame(0) }
    ch.script(ct / ch.length, t)
  }
  const v: View = { w: W, h: H, t, dt, auto, pointer }
  ch.update(v)
  pointer.dx = 0; pointer.dy = 0; pointer.wheel = 0
  // the process
  sim.update(dt)
  headSpin(sim, dt)
  if (sim.ev.includes('end')) { sim.reset() }
  machine.head.rotation.x = sim.head
  machine.root.position.x = sim.xf
  const flight = machine.screw.getObjectByName('flight')
  if (flight) flight.rotation.x -= dt * sim.screwRpm * 0.35
  machine.muckU.uSpin.value = sim.head
  machine.muckU.uChurn.value += dt * (sim.phase === 'bore' ? sim.rpm * 0.15 : 0.02)
  machine.muckU.uMuck.value.setHex(sim.ground === 'clay' ? 0x664a33 : sim.ground === 'sand' ? 0x9e7d4c : 0x6b6663)
  machine.pose(sim, t)
  tun.update(sim, dt, t)
  ground.update(sim, dt)
  ground.root.visible = state.earth > 0.5
  lab.update(sim, dt, t)
  applyState(world, dt)
  HL.time.value = t
  HL.face.value = MODEL_OFF.x + (sim.xf + 0.2) * S
  // tunnel lights only when someone can see in
  const inside = Math.max(state.cut, 0.6)
  for (const L of tun.lamps) L.intensity = 0.035 * inside
  // sounds of the process
  if (sim.phase !== prevPhase) { if (sim.phase === 'ring') sfx('hyd', { d: 1.2 }); else sfx('hyd', { d: 0.8, v: 0.7 }); prevPhase = sim.phase }
  if (sim.ev.includes('seg')) { sfx('clank', { v: 0.55 }); sfx('hyd', { d: 0.6, v: 0.6 }) }
  if (sim.ev.includes('ringDone')) sfx('impact', { v: 0.35 })
  if (sim.phase === 'ring' && t - beepT > 0.7) { sfx('beep', { v: 0.035 }); beepT = t }
  if (t - voiceT > 0.1) {
    voiceT = t
    audio.voice({ rpm: +sim.rpm.toFixed(2), bore: sim.phase === 'bore' && sim.running ? 1 : 0, ground: sim.ground === 'clay' ? 0 : sim.ground === 'sand' ? 1 : 2, screw: +sim.screw.toFixed(2), ring: sim.phase === 'ring' ? 1 : 0, vol: 0.8 })
  }

  rig.apply(cam)
  // focus on what the camera looks at; the shot sets how shallow
  pipe.scene.u.uFocus.value = rig.pos.distanceTo(rig.tgt)
  pipe.scene.u.uAperture.value = THREE.MathUtils.lerp(pipe.scene.u.uAperture.value, auto ? ch.dof : 0.2, Math.min(1, dt * 3))
  fade = Math.min(1, fade + dt / 0.4)
  const out = auto ? THREE.MathUtils.clamp((ch.length - ct) / 0.35, 0, 1) : 1
  pipe.lens.u.uFade.value = Math.min(idx === 0 && auto ? Math.min(1, ct / 1.0) : fade, idx === chapters.length - 1 && auto ? THREE.MathUtils.clamp((ch.length - ct) / 0.9, 0, 1) : out)
  renderer.toneMappingExposure = 1.0
  pipe.bloom.strength = 0.38
  pipe.bloom.radius = 0.5
  pipe.bloom.threshold = 1.4
  pipe.lens.u.uSunVis.value = 0
  pipe.lens.u.uTime.value = t
  pipe.render(dt)
  audio.tick()

  // HUD
  hud.kicker.textContent = ch.kicker
  const stats = ch.stats().map(x => `<div class="stat"><div class="k">${x.k}</div><div class="v ${x.c ?? ''}">${x.v}${x.u ? `<small>${x.u}</small>` : ''}</div></div>`).join('')
  if (stats !== lastStats) { hud.stats.innerHTML = stats; lastStats = stats }
  const text = ch.text()
  if (text !== lastText) { hud.text.innerHTML = text; lastText = text }
  const seen = new Set<string>()
  for (const l of ch.labels(v)) {
    seen.add(l.id)
    let el = labelEls.get(l.id)
    if (!el || !el.isConnected) { el = document.createElement('div'); el.className = 'pill'; hud.labels.appendChild(el); labelEls.set(l.id, el) }
    const html = `<i style="${l.dot ? `background:${l.dot};color:${l.dot}` : ''}"></i><b>${l.text}</b>${l.sub ? `<span>${l.sub}</span>` : ''}`
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html }
    el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`
    el.style.opacity = String(l.vis * pipe.lens.u.uFade.value * Math.min(1, ct / 0.6 + (auto ? 0 : 1)))
  }
  for (const [id, el] of labelEls) if (!seen.has(id)) { el.remove(); labelEls.delete(id) }
  shell.tick(dt)
  if (Math.floor(t * 8) !== Math.floor((t - dt) * 8) || auto) syncControls()
  ;($('#progress') as HTMLElement).style.width = `${auto ? (ct / ch.length) * 100 : 0}%`
  // the tour's cursor walks to the knob it is turning
  const c = auto ? ch.cursor(ct / ch.length) : null
  let tx = curPos.x, ty = curPos.y
  if (c) {
    const row = hud.controls.querySelector(`[data-id="${c.id}"]`) as HTMLElement | null
    if (row) {
      const r = row.getBoundingClientRect()
      if (row.tagName === 'INPUT') { const f = typeof c.v === 'number' ? c.v : 0; tx = r.left + 9 + f * (r.width - 18); ty = r.top + r.height / 2 }
      else { const b = row.querySelector(`button[data-v="${c.v}"]`) as HTMLElement | null; const rb = (b ?? row).getBoundingClientRect(); tx = rb.left + rb.width / 2; ty = rb.top + rb.height / 2 }
      if (curPos.on < 0.05) { curPos.x = tx + 140; curPos.y = ty + 160 }
    }
  }
  curPos.on = THREE.MathUtils.clamp(curPos.on + (c ? dt * 4 : -dt * 3), 0, 1)
  const k = 1 - Math.exp(-dt * 9)
  curPos.x += (tx - curPos.x) * k; curPos.y += (ty - curPos.y) * k
  hud.cursor.style.transform = `translate(${curPos.x.toFixed(1)}px, ${curPos.y.toFixed(1)}px) scale(${c?.press ? 0.86 : 1})`
  hud.cursor.style.opacity = String(curPos.on * pipe.lens.u.uFade.value)
  hud.cursor.classList.toggle('press', !!c?.press)
}

resize()
buildTabs()
buildControls()
document.body.classList.toggle('film', FILM)
void CUT_M

/* ---------------- the TV shell ---------------- */
const shell = mountShell({
  id: 'tbm', title: 'Tunnel Boring Machine',
  chapters: chapters.map(c => ({ id: c.id, tab: c.tab, kicker: c.kicker, length: c.length })),
  controls: ctl,
  index: () => idx,
  go: (i, manual) => { if (manual) stopAuto(); go(i) },
  isAuto: () => auto,
  setAuto: on => { if (on === auto) return; auto = on; if (auto) { ct = 0; chapters[idx].enter() } updateAutoUi() },
  progress: () => ct / chapters[idx].length,
  text: () => chapters[idx].text(), kicker: () => chapters[idx].kicker, stats: () => chapters[idx].stats(),
  renderer, quality: Q,
  setScale: s => { tvScale = s; resize() }, getScale: () => (FILM ? 1 : Q.tv ? tvScale : Math.min(devicePixelRatio, 2)),
  wake: () => { if (!FILM && !audio.on) { audio.start(); setTimeout(syncSound, 60) } },
})
if (FILM) {
  audio.film(() => t)
  go(idx)
  let t0 = 0
  ;(window as unknown as { __film: unknown }).__film = {
    step: (dt: number, n = 1) => { for (let i = 0; i < n; i++) frame(dt) },
    goto: (i: number, noFade = false) => { auto = true; go(i); ct = 0; if (noFade) fade = 1 },
    startAudio: () => { audio.filmReset(); t0 = t; sfx('mood', { key: chapters[idx].mood }) },
    audio: (duration: number) => audio.renderFilm(duration, t0),
    chapters: chapters.map(c => ({ id: c.id, length: c.length })),
    ready: true,
  }
} else {
  go(idx)
  let last = performance.now()
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    frame(dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
