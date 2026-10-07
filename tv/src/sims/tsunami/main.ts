import * as THREE from 'three'
import { Pipeline } from 'megastructures-engine/render/dof'
import { studioEnvironment } from 'megastructures-engine/scene/studio-env'
import { Lab, PT, S } from '../asteroid/lab'
import { Crater } from '../asteroid/crater'
import { Terrain, FX, HALF, setY0, TERRAIN_LOD } from '../asteroid/terrain'
import { Country, paintMap } from '../asteroid/world'
import { Heights, Tsunami, CITY, VEX, coastX } from '../asteroid/geo'
import { Rig, fmtT, type Control, type View, type Chapter, type Stat, type Label, type Cursor } from '../asteroid/chapters'
import { audio, sfx } from '../asteroid/sfx'
import { impact } from '../asteroid/sim'
import '../roman.css'
import '../asteroid.css'
import { mountShell } from '../../shell/sim-shell'
import { TV_MODE } from '../../shell/env'
import { TV, DESKTOP, setShadowMapSize, capLights } from 'megastructures-engine/tv/quality'

/**
 * How an earthquake makes a tsunami: a subduction zone off a 120 km coast,
 * the plates locked, the rupture lifting the sea floor, the sea lifted with
 * it, the wave crossing the shelf and running up into a city. Modelled on
 * the 2011 Tohoku earthquake (Mw 9.1, the highest earthquake tsunami run-up
 * ever measured, 40.5 m). Scaling: rupture length and width from magnitude
 * (Wells and Coppersmith), slip = M0 / (mu L W), seafloor uplift ~ half the
 * slip; the wave is solved over the real sea floor like the asteroid page.
 */

const params = new URLSearchParams(location.search)
const FILM = params.has('film')
const canvas = document.getElementById('gl') as HTMLCanvasElement
const pipe = new Pipeline(canvas, FILM)
const renderer = pipe.renderer
const Q = TV_MODE ? { ...TV } : { ...DESKTOP }
if (Q.tv) { pipe.setSamples(Q.samples); pipe.scene.dof = false; TERRAIN_LOD.land = 210; TERRAIN_LOD.sea = 190 }
let tvScale = Q.maxScale

// a deep block: 15 km of crust under the sea, so the plates fit
const BLOCK = -45000
setY0(BLOCK)
const OFF = new THREE.Vector3(0, PT - BLOCK * S, 0)
const W = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, z * S).add(OFF)
const TRENCH = -45000

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050608)
scene.fog = new THREE.Fog(0x050608, 7, 18)
scene.environment = studioEnvironment(renderer)
scene.environmentIntensity = 0.3
const cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.02, 40)
pipe.scene.scene = scene
pipe.scene.camera = cam

const lab = new Lab({ railKm: 120, plate: `120 × 120 km  ·  1:60,000  ·  height ×${VEX}`, blockH: -BLOCK * S })
scene.add(lab.root)
lab.screens.root.visible = false
if (Q.tv) { setShadowMapSize(scene, Q.shadowMap); capLights(scene, Q.lights) }
const dummy = impact(10, 'stone', 20, 45)
const model = new THREE.Group()
model.scale.setScalar(S)
model.position.copy(OFF)
scene.add(model)
const heights = new Heights()
const tsunami = new Tsunami(heights)
const crater = new Crater()
crater.u.uAir.value = 1 // no crater on this page
const terrain = new Terrain(crater, paintMap(heights, 2048), heights.tex, tsunami.tex)
model.add(terrain.root)
const country = new Country(heights)
model.add(country.root)
terrain.focus(0, 0, 0)
FX.uSlab.value = 1
FX.uTrenchX.value = TRENCH
FX.uEtaX.value = 70
FX.uImp.value.set(-1e6, -1e6)

/* ---------------- the earthquake ---------------- */
const st = { mw: 9.1, wall: 10, t: -60, playing: true, strain: 1, key: '', runup: 0, arrival: -1 }
function quake(mw: number) {
  const m0 = Math.pow(10, 1.5 * mw + 9.1) // N m
  const L = Math.pow(10, -2.44 + 0.59 * mw) * 1000 // m
  const Wd = Math.min(200000, L / 2.5)
  const slip = m0 / (4e10 * L * Wd)
  return { m0, L, W: Wd, slip, uplift: 0.5 * slip, energyPJ: Math.pow(10, 1.5 * mw + 4.8) / 1e15 }
}
let q = quake(st.mw)
const RUPTURE_S = 150 // the rupture takes about two and a half minutes
function solve() {
  q = quake(st.mw)
  tsunami.solve(-1e9, -1e9, q.uplift, 1, { lineX: TRENCH + 22000, wall: st.wall, inland: 260 })
  st.runup = tsunami.cityRunup; st.arrival = tsunami.cityArrival
}
const fmtM = (m: number) => (m < 1000 ? `${m.toFixed(m < 10 ? 1 : 0)} m` : `${(m / 1000).toFixed(0)} km`)
const minutes = (t: number) => (t < 90 ? `${Math.round(t)} s` : `${(t / 60).toFixed(1)} min`)

/* ---------------- controls ---------------- */
const tToU = (t: number) => Math.log(THREE.MathUtils.clamp(t, -60, 3000) + 61) / Math.log(3061)
const uToT = (u: number) => Math.pow(3061, u) - 61
const ctl: Control[] = [
  { kind: 'slider', id: 'mw', label: 'Magnitude', min: 7.5, max: 9.5, step: 0.05, get: () => st.mw, set: v => { st.mw = v }, fmt: v => `Mw ${v.toFixed(1)}${Math.abs(v - 9.1) < 0.04 ? ' · Tohoku 2011' : Math.abs(v - 9.5) < 0.04 ? ' · Chile 1960' : ''}` },
  { kind: 'slider', id: 'wall', label: 'Sea wall', min: 0, max: 50, step: 0.5, get: () => st.wall, set: v => { st.wall = v }, fmt: v => `${v.toFixed(1)} m` },
  { kind: 'slider', id: 'strain', label: 'Strain stored', min: 0, max: 1, step: 0.01, get: () => st.strain, set: v => { st.strain = v }, fmt: v => `${Math.round(v * 100)}%` },
  { kind: 'slider', id: 'time', label: 'Time', min: 0, max: 1, step: 0.0005, get: () => tToU(st.t), set: v => { st.t = uToT(v); st.playing = false }, fmt: () => fmtT(st.t) },
  { kind: 'button', id: 'go', label: '', text: 'Let it go again', run: () => { st.t = -5; st.playing = true; sfx('whoosh', { d: 0.8, v: 0.25 }) } },
]

/* ---------------- the tour ---------------- */
type Key = [number, [number, number, number], [number, number, number]]
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp
const ease = (x: number) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const ramp = (u: number, a: number, b: number) => ease((u - a) / (b - a))
const P = (x: number, y: number, z: number): [number, number, number] => { const v = W(x, y, z); return [v.x, v.y, v.z] }
const rig = new Rig()
const project = (v: View, p: THREE.Vector3) => { const r = p.clone().project(cam); return { x: (r.x * 0.5 + 0.5) * v.w, y: (-r.y * 0.5 + 0.5) * v.h, vis: r.z < 1 && Math.abs(r.x) < 1.05 && Math.abs(r.y) < 1.05 ? 1 : 0 } }
const label = (v: View, id: string, at: THREE.Vector3, text: string, sub: string, k: number, dot = '#7fd8ff'): Label => { const s = project(v, at); return { id, text, sub, x: s.x, y: s.y, vis: s.vis * clamp(k, 0, 1), dot } }
interface Spec { id: string; tab: string; kicker: string; length: number; mood: string; dof: number; keys: Key[]; enter?: () => void; script?: (u: number) => void; text: () => string; stats?: () => Stat[]; labels?: (v: View) => Label[]; cursor?: (u: number) => Cursor | null }
const mk = (s: Spec): Chapter => ({
  id: s.id, tab: s.tab, kicker: s.kicker, length: s.length, mood: s.mood, dof: s.dof,
  enter() { s.enter?.(); rig.fov = 34; rig.shot(s.keys, 0) },
  script(u) { rig.shot(s.keys, u); s.script?.(u) },
  update(v) { if (!v.auto && (v.pointer.dx || v.pointer.dy || v.pointer.wheel)) rig.orbit(v.pointer.dx, v.pointer.dy, v.pointer.wheel) },
  stats: s.stats ?? (() => [{ k: 'Magnitude', v: st.mw.toFixed(1), c: 'warm' }, { k: 'Uplift', v: q.uplift.toFixed(1), u: 'm' }, { k: 'Time', v: fmtT(st.t) }]),
  text: s.text, labels: s.labels ?? (() => []), cursor: s.cursor ?? (() => null),
})
const reset = () => { st.mw = 9.1; st.wall = 10; st.strain = 1 }
const cityW = () => W(CITY.x, heights.at(CITY.x, CITY.y) * VEX, CITY.y)
const zf = 60000 // the front face of the block, where the cut shows the plates
const chapters: Chapter[] = [
  mk({ id: 'coast', tab: 'The coast', kicker: '120 km · a subduction zone offshore', length: 5.2, mood: 'lab', dof: 0.15,
    keys: [[0, [3.8, 2.50, 5.0], [0, 1.30, 0]], [0.6, [3.1, 2.10, 4.0], [0, 1.25, 0.1]], [1, [2.5, 1.85, 3.3], [-0.1, 1.20, 0.2]]],
    enter() { reset(); st.playing = false; st.t = -60; st.strain = 0.4 }, script(u) { st.strain = lerp(0.4, 0.7, u) },
    text: () => 'A coast like north east Japan: a port city on a flat plain, a deep ocean, and under it a plate sliding beneath the continent at 8 cm a year.',
    stats: () => [{ k: 'Plate speed', v: '8', u: 'cm/yr' }, { k: 'Table', v: '120', u: 'km' }, { k: 'Crust', v: '15', u: 'km deep' }],
    labels: v => [label(v, 'city', cityW().add(new THREE.Vector3(0, 0.03, 0)), 'City', '1 million people', 1, '#ffd0a0'), label(v, 'trench', W(TRENCH, -3600 * VEX, zf), 'Trench', '7 km deep', 1)],
  }),
  mk({ id: 'locked', tab: 'Locked', kicker: 'Centuries of strain on one fault', length: 5.4, mood: 'entry', dof: 0.25,
    keys: [[0, P(-30000, -4000, zf + 80000), P(-22000, -19000, zf)], [1, P(-26000, -7000, zf + 64000), P(-20000, -19000, zf)]],
    enter() { reset(); st.playing = false; st.t = -40; st.strain = 0.3 }, script(u) { st.strain = lerp(0.3, 1, ramp(u, 0, 0.9)) },
    cursor: u => (u < 0.9 ? { id: 'strain', v: st.strain, press: u > 0.05 } : null),
    text: () => 'The plates are stuck together along the fault. The ocean plate keeps moving and drags the edge of the continent down with it, bending it like a spring, for hundreds of years.',
    stats: () => [{ k: 'Strain', v: String(Math.round(st.strain * 100)), u: '%', c: 'warm' }, { k: 'Since last', v: '600', u: 'years' }, { k: 'Slip stored', v: (q.slip * st.strain).toFixed(0), u: 'm' }],
    labels: v => [label(v, 'fault', W(TRENCH + 30000, (-3600 - 30000 * 0.18 - 2000) * VEX, zf), 'Locked fault', 'stuck', 1, '#ffb070'), label(v, 'slab', W(TRENCH + 50000, (-3600 - 50000 * 0.18 - 7000) * VEX, zf), 'Ocean plate', 'diving', 1)],
  }),
  mk({ id: 'rupture', tab: 'Rupture', kicker: 'Three minutes, 400 km of fault', length: 5.6, mood: 'contact', dof: 0.2,
    keys: [[0, P(-26000, -7000, zf + 64000), P(-20000, -19000, zf)], [0.5, P(-30000, 6000, zf + 40000), P(-22000, -3000, zf - 10000)], [1, P(-40000, 18000, zf + 52000), P(-20000, 0, zf - 20000)]],
    enter() { reset(); st.playing = false; st.t = -2 },
    script(u) { const p = st.t; st.t = lerp(-2, RUPTURE_S + 20, ramp(u, 0.05, 0.9)); if (p <= 0 && st.t > 0) { sfx('rumble', { d: 5, v: 1 }); sfx('boom', { v: 0.6 }) } },
    text: () => `The fault lets go. It slips ${q.slip.toFixed(0)} m in a few minutes and the sea floor jumps up ${q.uplift.toFixed(0)} m over a strip ${fmtM(q.W)} wide. The whole ocean above it is lifted too.`,
    stats: () => [{ k: 'Slip', v: q.slip.toFixed(0), u: 'm', c: 'warm' }, { k: 'Uplift', v: q.uplift.toFixed(1), u: 'm' }, { k: 'Energy', v: q.energyPJ > 1000 ? (q.energyPJ / 1000).toFixed(1) : q.energyPJ.toFixed(0), u: q.energyPJ > 1000 ? 'EJ' : 'PJ' }],
    labels: v => [label(v, 'up', W(TRENCH + 22000, 600 * VEX, zf - 20000), 'Sea floor', `+${q.uplift.toFixed(1)} m (drawn ×30)`, st.t > 30 ? 1 : 0, '#a8d8ff')],
  }),
  mk({ id: 'wave', tab: 'The wave', kicker: 'Two waves, one each way', length: 6, mood: 'dig', dof: 0.12,
    keys: [[0, [-0.2, 2.40, 2.6], [-0.2, 1.50, -0.1]], [0.6, [0.3, 2.25, 2.4], [0.0, 1.50, -0.1]], [1, [0.7, 2.10, 2.2], [0.1, 1.50, -0.1]]],
    enter() { reset(); st.playing = false; st.t = RUPTURE_S }, script(u) { st.t = lerp(RUPTURE_S, 420, u) },
    text: () => `Over deep water the wave is only a few metres high and ${Math.round(Math.sqrt(9.81 * 3600) * 3.6)} km/h fast. A ship would not notice it. It is also hundreds of kilometres long: all of the ocean is moving, from top to bottom.`,
    stats: () => [{ k: 'At sea', v: q.uplift.toFixed(1), u: 'm high', c: 'warm' }, { k: 'Speed', v: String(Math.round(Math.sqrt(9.81 * 3600) * 3.6)), u: 'km/h' }, { k: 'Time', v: fmtT(st.t) }],
  }),
  mk({ id: 'shelf', tab: 'The shelf', kicker: 'Slower, shorter, taller', length: 6, mood: 'collapse', dof: 0.15,
    keys: [[0, [-0.55, 1.8, 1.3], [0.25, 1.48, 0]], [0.6, [-0.35, 1.72, 1.15], [0.28, 1.48, 0.02]], [1, [-0.2, 1.68, 1.05], [0.3, 1.48, 0.04]]],
    enter() { reset(); st.playing = false; st.t = 420 }, script(u) { st.t = lerp(420, st.arrival > 0 ? st.arrival - 20 : 800, u) },
    text: () => `As the water gets shallow the front slows to ${Math.round(Math.sqrt(9.81 * 30) * 3.6)} km/h and the back catches up. The same energy piles into a wall: ${fmtM(st.runup / 1.9)} at the shore.`,
    stats: () => [{ k: 'At the shore', v: fmtM(st.runup / 1.9).split(' ')[0], u: 'm', c: 'warm' }, { k: 'Arrives', v: st.arrival > 0 ? minutes(st.arrival) : 'n/a' }, { k: 'Time', v: fmtT(st.t) }],
  }),
  mk({ id: 'city', tab: 'The city', kicker: 'Run-up and inundation', length: 6.6, mood: 'city', dof: 0.25,
    keys: [[0, [0.85, 1.70, 0.55], [0.38, 1.50, 0.04]], [0.6, [0.72, 1.66, 0.42], [0.39, 1.50, 0.04]], [1, [0.64, 1.63, 0.36], [0.41, 1.50, 0.05]]],
    enter() { reset(); st.playing = false; const a = st.arrival > 0 ? st.arrival : 800; st.t = a - 25 },
    script(u) { const a = st.arrival > 0 ? st.arrival : 800; const p = st.t; st.t = lerp(a - 25, a + 300, u); if (p < a && st.t >= a) sfx('wind', { d: 6, v: 0.5 }) },
    text: () => st.runup > 0 ? `It goes over the ${st.wall.toFixed(0)} m sea wall like it is not there, runs up ${fmtM(st.runup)} above sea level and floods kilometres inland. The 2011 wave reached 40.5 m.` : `The ${st.wall.toFixed(0)} m sea wall holds.`,
    stats: () => [{ k: 'Run-up', v: fmtM(st.runup).split(' ')[0], u: 'm', c: 'bad' }, { k: 'Sea wall', v: st.wall.toFixed(0), u: 'm' }, { k: 'Arrives', v: st.arrival > 0 ? minutes(st.arrival) : 'n/a' }],
  }),
  mk({ id: 'wall', tab: 'The wall', kicker: 'How high would it need to be?', length: 6.4, mood: 'sizes', dof: 0.12,
    keys: [[0, [2.0, 2.2, 2.6], [0.1, 1.3, 0]], [0.6, [2.6, 2.5, 3.3], [0, 1.25, 0]], [1, [3.4, 2.8, 4.3], [0, 1.25, 0]]],
    enter() { reset(); st.playing = false; st.wall = 10 },
    script(u) { st.wall = lerp(10, 48, ramp(u, 0.08, 0.8)); st.t = st.arrival > 0 ? st.arrival + 150 : 1000 },
    cursor: u => (u > 0.04 && u < 0.84 ? { id: 'wall', v: st.wall / 50, press: u > 0.08 } : null),
    text: () => st.runup > 0 ? `A ${st.wall.toFixed(0)} m wall and it still comes over.` : `At ${st.wall.toFixed(0)} m the wall holds. The tallest sea walls in Japan were 15 m.`,
    stats: () => [{ k: 'Sea wall', v: st.wall.toFixed(0), u: 'm', c: 'warm' }, { k: 'Run-up', v: fmtM(st.runup).split(' ')[0], u: 'm' }, { k: 'Magnitude', v: st.mw.toFixed(1) }],
  }),
]

/* ---------------- HUD ---------------- */
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const hud = { kicker: $('#kicker'), stats: $('#stats'), text: $('#text'), controls: $('#controls'), tabs: $('#tabs'), labels: $('#labels'), play: $('#play'), auto: $('#auto'), sound: $('#sound'), cursor: $('#cursor') }
let idx = Math.max(0, chapters.findIndex(c => c.id === params.get('c')))
let auto = !params.has('manual')
let ct = 0, fade = 0, lastStats = '', lastText = '', holding = false
function buildTabs() { hud.tabs.innerHTML = chapters.map((c, i) => `<button data-i="${i}" class="tab${i === idx ? ' on' : ''}"><i></i>${c.tab}</button>`).join(''); hud.tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => go(+b.getAttribute('data-i')!))) }
function controlHtml(c: Control) {
  if (c.kind === 'button') return `<div class="row"><button class="btn" data-id="${c.id}">${c.text}</button></div>`
  if (c.kind === 'seg') return ''
  return `<div class="row"><div class="lab">${c.label}<span class="val" data-val="${c.id}"></span></div><input type="range" data-id="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}"></div>`
}
function buildControls() {
  hud.controls.innerHTML = ctl.map(controlHtml).join('') + '<div class="hint">Drag to look around · scroll to zoom</div>'
  for (const c of ctl) {
    if (c.kind === 'button') hud.controls.querySelector<HTMLButtonElement>(`.btn[data-id="${c.id}"]`)!.addEventListener('click', () => { stopAuto(); c.run(); syncControls() })
    else if (c.kind === 'slider') {
      const el = hud.controls.querySelector<HTMLInputElement>(`input[data-id="${c.id}"]`)!
      el.addEventListener('input', () => { stopAuto(); c.set(+el.value); syncControls() })
      if (c.id === 'time') { el.addEventListener('pointerdown', () => { holding = true }); addEventListener('pointerup', () => { if (holding) { holding = false; st.playing = true } }) }
    }
  }
  syncControls()
}
function syncControls() {
  for (const c of ctl) if (c.kind === 'slider') {
    const el = hud.controls.querySelector<HTMLInputElement>(`input[data-id="${c.id}"]`)!
    if (document.activeElement !== el) el.value = String(c.get())
    el.style.setProperty('--p', `${(((c.get() - c.min) / (c.max - c.min)) * 100).toFixed(1)}%`)
    hud.controls.querySelector<HTMLElement>(`[data-val="${c.id}"]`)!.textContent = c.fmt(c.get())
  }
}
function go(i: number) {
  idx = (i + chapters.length) % chapters.length; ct = 0; fade = 0
  chapters[idx].enter()
  hud.tabs.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === idx))
  hud.labels.innerHTML = ''; labelEls.clear()
  if (!auto) { chapters[idx].script(0.6, t); st.playing = true }
  sfx('mood', { key: chapters[idx].mood })
  hud.play.classList.toggle('playing', auto); hud.auto.textContent = auto ? 'plays itself' : 'your turn'
}
function stopAuto() { if (auto) { auto = false; st.playing = true; hud.play.classList.toggle('playing', false); hud.auto.textContent = 'your turn' } }
hud.play.addEventListener('click', () => { auto = !auto; if (auto) { ct = 0; chapters[idx].enter() } else st.playing = true; hud.play.classList.toggle('playing', auto); hud.auto.textContent = auto ? 'plays itself' : 'your turn' })
hud.sound.addEventListener('click', e => { e.stopPropagation(); audio.toggle(); setTimeout(() => hud.sound.classList.toggle('on', audio.on), 60) })
const firstGesture = () => { if (!audio.on) { audio.start(); setTimeout(() => hud.sound.classList.toggle('on', audio.on), 60) } removeEventListener('pointerdown', firstGesture, true); removeEventListener('keydown', firstGesture, true) }
if (!FILM) { addEventListener('pointerdown', firstGesture, true); addEventListener('keydown', firstGesture, true) }
const pointer: View['pointer'] = { dx: 0, dy: 0, wheel: 0, down: false }
let px = 0, py = 0
canvas.addEventListener('pointerdown', e => { pointer.down = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); stopAuto() })
canvas.addEventListener('pointermove', e => { if (!pointer.down) return; pointer.dx += e.clientX - px; pointer.dy += e.clientY - py; px = e.clientX; py = e.clientY })
canvas.addEventListener('pointerup', () => { pointer.down = false })
canvas.addEventListener('wheel', e => { e.preventDefault(); pointer.wheel += e.deltaY; stopAuto() }, { passive: false })
// keys belong to the TV shell (see shell/sim-shell.ts)

/* ---------------- loop ---------------- */
let Wd = 1, Hd = 1
function resize() { Wd = FILM ? 1920 : innerWidth; Hd = FILM ? 1080 : innerHeight; pipe.resize(Wd, Hd, FILM ? 1 : Q.tv ? tvScale : Math.min(devicePixelRatio, 2)); cam.aspect = Wd / Hd; cam.updateProjectionMatrix() }
addEventListener('resize', resize)
let t = 0, lastSolve = -10
const labelEls = new Map<string, HTMLElement>()
const noCrater = { h: () => 0, rim: () => 0, u: crater.u } as unknown as Crater

function frame(dt: number) {
  t += dt
  const ch = chapters[idx]
  if (auto) { ct += dt; if (ct >= ch.length) { go(idx + 1); return frame(0) } ch.script(ct / ch.length, t) }
  const v: View = { w: Wd, h: Hd, t, dt, auto, pointer }
  ch.update(v)
  pointer.dx = 0; pointer.dy = 0; pointer.wheel = 0
  const key = `${st.mw.toFixed(2)}|${st.wall.toFixed(1)}`
  if (key !== st.key && (FILM || t - lastSolve > 0.25)) { st.key = key; lastSolve = t; solve() }
  if (!auto && st.playing && !holding) st.t = Math.min(3000, st.t + dt * (st.t < RUPTURE_S + 30 ? 25 : 12))
  const T = st.t
  FX.uT.value = T
  FX.uTime.value = t
  FX.uQuake.value = clamp(T / RUPTURE_S, 0, 1)
  FX.uStrain.value = st.strain
  FX.uUplift.value = q.uplift
  FX.uWaveOn.value = 1
  FX.uDep.value = 1
  FX.uP.value = 600
  FX.uCav.value = 0
  FX.uImpH.value = 0
  terrain.setCut(HALF + 10)
  country.update(noCrater, new THREE.Vector2(-1e6, -1e6), 0, tsunami, { blast: 0, r20: 0, r5: 0, r2: 0, burn: 0, t: T })
  lab.update(dummy, dt, t)
  rig.apply(cam)
  const shake = T > 0 && T < RUPTURE_S ? 0.0012 * Math.sin(Math.PI * T / RUPTURE_S) : 0
  if (shake) { cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake }
  pipe.scene.u.uFocus.value = rig.pos.distanceTo(rig.tgt)
  pipe.scene.u.uAperture.value = lerp(pipe.scene.u.uAperture.value, auto ? ch.dof : 0.15, Math.min(1, dt * 3))
  fade = Math.min(1, fade + dt / 0.4)
  const out = auto ? clamp((ch.length - ct) / 0.35, 0, 1) : 1
  pipe.lens.u.uFade.value = Math.min(idx === 0 && auto ? Math.min(1, ct / 1.0) : fade, idx === chapters.length - 1 && auto ? clamp((ch.length - ct) / 0.9, 0, 1) : out)
  renderer.toneMappingExposure = 1.0
  pipe.bloom.strength = 0.38; pipe.bloom.radius = 0.55; pipe.bloom.threshold = 1.3
  pipe.lens.u.uSunVis.value = 0; pipe.lens.u.uTime.value = t
  pipe.render(dt)
  audio.tick()
  hud.kicker.textContent = ch.kicker
  const stats = ch.stats().map(x => `<div class="stat"><div class="k">${x.k}</div><div class="v ${x.c ?? ''}">${x.v}${x.u ? `<small>${x.u}</small>` : ''}</div></div>`).join('')
  if (stats !== lastStats) { hud.stats.innerHTML = stats; lastStats = stats }
  const text = ch.text(); if (text !== lastText) { hud.text.innerHTML = text; lastText = text }
  const seen = new Set<string>()
  for (const l of ch.labels(v)) {
    seen.add(l.id)
    let el = labelEls.get(l.id)
    if (!el || !el.isConnected) { el = document.createElement('div'); el.className = 'pill'; hud.labels.appendChild(el); labelEls.set(l.id, el) }
    const html = `<i style="background:${l.dot};color:${l.dot}"></i><b>${l.text}</b>${l.sub ? `<span>${l.sub}</span>` : ''}`
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html }
    el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`
    el.style.opacity = String(l.vis * pipe.lens.u.uFade.value * Math.min(1, ct / 0.6 + (auto ? 0 : 1)))
  }
  for (const [id, el] of labelEls) if (!seen.has(id)) { el.remove(); labelEls.delete(id) }
  syncControls()
  ;($('#progress') as HTMLElement).style.width = `${auto ? (ct / ch.length) * 100 : 0}%`
  // the tour's cursor walks to the knob it turns
  const c = auto ? ch.cursor(ct / ch.length) : null
  if (c) {
    const row = hud.controls.querySelector(`[data-id="${c.id}"]`) as HTMLElement | null
    if (row) { const r = row.getBoundingClientRect(); const f = typeof c.v === 'number' ? c.v : 0; hud.cursor.style.transform = `translate(${(r.left + 9 + f * (r.width - 18)).toFixed(1)}px, ${(r.top + r.height / 2).toFixed(1)}px) scale(${c.press ? 0.86 : 1})` }
  }
  hud.cursor.style.opacity = c ? String(pipe.lens.u.uFade.value) : '0'
  hud.cursor.classList.toggle('press', !!c?.press)
  void coastX
  shell.tick(dt)
}

resize(); buildTabs(); buildControls()
document.body.classList.toggle('film', FILM)

/* ---------------- the TV shell ---------------- */
const shell = mountShell({
  id: 'tsunami', title: 'Tsunami',
  chapters: chapters.map(c => ({ id: c.id, tab: c.tab, kicker: c.kicker, length: c.length })),
  controls: ctl,
  index: () => idx,
  go: (i, manual) => { if (manual) stopAuto(); go(i) },
  isAuto: () => auto,
  setAuto: on => { if (on === auto) return; if (on) { auto = true; ct = 0; chapters[idx].enter(); hud.play.classList.toggle('playing', true); hud.auto.textContent = 'plays itself' } else stopAuto() },
  progress: () => ct / chapters[idx].length,
  text: () => chapters[idx].text(), kicker: () => chapters[idx].kicker, stats: () => chapters[idx].stats(),
  renderer, quality: Q,
  setScale: s => { tvScale = s; resize() }, getScale: () => (FILM ? 1 : Q.tv ? tvScale : Math.min(devicePixelRatio, 2)),
  wake: () => { if (!FILM && !audio.on) { audio.start(); setTimeout(() => hud.sound.classList.toggle('on', audio.on), 60) } },
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
  const loop = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
}
