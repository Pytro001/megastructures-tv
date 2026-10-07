import * as THREE from 'three'
import { Pipeline } from 'megastructures-engine/render/lens'
import { NOISE3D, makeNoise3D } from 'megastructures-engine/core/noise'
import { FLUID_TIME, FLUID_RATE, FLUID_ON } from '../raptor/fluid'
import { GEO } from '../raptor/raptor'
import { Vehicle } from './vehicle'
import { Sky } from './sky'
import { ClusterPlume } from './plume'
import { Trail, Vapor, VentFire } from './effects'
import { VU } from './mats'
import { flight, MECO } from './flight'
import { B, S, S0, R, B_RINGS, S_RINGS } from './dims'
import { RVAC } from './cluster'
import { ALL, Rig, setCU, panel, applyFollow, type Chapter, type Control, type View, type Sim } from './chapters'
import { audio, sfx } from './sfx'
import '../roman.css'
import '../starship.css'
import { studioEnvironment } from 'megastructures-engine/scene/studio-env'
import { TANKS } from './dims'
import { mountShell } from '../../shell/sim-shell'
import { TV_MODE } from '../../shell/env'
import { TV, DESKTOP, setShadowMapSize, capLights } from 'megastructures-engine/tv/quality'

/**
 * Inside Starship: the full stack 45 seconds after liftoff, just above a deck
 * of cumulus with the sun low behind it. Cut it in half, follow the liquid
 * oxygen and methane, look up into 33 Raptor 3 engines, pull it apart, then
 * fast forward to hot staging. Plays itself; touch to take over.
 */

const params = new URLSearchParams(location.search)
const FILM = params.has('film')
const Q = TV_MODE ? { ...TV, lights: { ...TV.lights, PointLight: 4 } } : { ...DESKTOP }
NOISE3D.value = makeNoise3D(64)
const canvas = document.getElementById('gl') as HTMLCanvasElement
const pipe = new Pipeline(canvas, FILM)
const renderer = pipe.renderer
renderer.localClippingEnabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

/* ---------------- world ---------------- */
const scene = new THREE.Scene()
const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 4e5)
const sky = new Sky(renderer)
// the sun is low, a little to the right of where the opening shot looks
sky.setSun(new THREE.Vector3(0.25, 0.2, -0.95))

const vehicle = new Vehicle()
scene.add(vehicle.root)

const sunLight = new THREE.DirectionalLight(0xffffff, 4)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(FILM ? 4096 : 2048, FILM ? 4096 : 2048)
renderer.shadowMap.autoUpdate = false
sunLight.shadow.bias = -0.0003
sunLight.shadow.normalBias = 0.04
const sc = sunLight.shadow.camera
sc.left = -72; sc.right = 72; sc.top = 72; sc.bottom = -72; sc.near = 1; sc.far = 600
scene.add(sunLight, sunLight.target)

/* ---------------- the studio the cutaway and the exploded view sit in ---------------- */
const studioEnv = studioEnvironment(renderer)
const key = new THREE.DirectionalLight(0xdfe8ff, 0)
const rimL = new THREE.DirectionalLight(0x8fb4ff, 0)
scene.add(key, key.target, rimL, rimL.target)
// the propellant lights the inside of each tank in its own colour
const tankLights = ([[TANKS.B.lox, 0x46c8ff, 'b-lox'], [TANKS.B.ch4, 0xffa23a, 'b-ch4'], [TANKS.S.lox, 0x46c8ff, 's-lox'], [TANKS.S.ch4, 0xffa23a, 's-ch4']] as const).map(([k, c, part]) => {
  const L = new THREE.PointLight(c, 0, 26, 1.6)
  L.position.set(-0.5, (k.yBot + k.yTop) / 2, -1.2)
  vehicle.parts.find(p => p.name === part)!.group.add(L)
  return L
})
const skyEnv: { tex: THREE.Texture | null } = { tex: null }

const bPlume = new ClusterPlume(B_RINGS.map(([n, r, ph, s]) => ({ count: n, radius: r, phase: ph, re: GEO.Re * s })), R - 0.3, vehicle.booster)
bPlume.at(0)
vehicle.booster.add(bPlume.mesh)
const sPlume = new ClusterPlume(S_RINGS.map(([n, r, ph, s], i) => ({ count: n, radius: r, phase: ph, re: i ? RVAC.re * s : GEO.Re * s })), 3.4, vehicle.ship)
sPlume.at(S0 + 0.1)
vehicle.ship.add(sPlume.mesh)
const trail = new Trail()
vehicle.root.add(trail.mesh)
const vapor = new Vapor([
  { y: B.hsr1 + 1.5, r: R + 0.25, len: 16, flare: 3.0 },
  { y: S.nose0 + 3.2, r: R - 0.1, len: 13, flare: 2.4 },
  { y: B.fins + 1.0, r: R + 0.6, len: 12, flare: 2.6 },
])
vehicle.root.add(vapor.group)
const vents = new VentFire(vehicle.hsrVents)
vehicle.booster.add(vents.mesh)

// this page runs at real sunlight levels (clouds are ten times brighter than blue sky), so the
// hot spot clamp before bloom sits much higher than on the dark pages
for (const ps of pipe.composer.passes) { const m = (ps as unknown as { fsq?: { material: THREE.ShaderMaterial } }).fsq?.material; if (m?.uniforms?.uMax) m.uniforms.uMax.value = 45 }
sky.u.uSteps.value = FILM ? 64 : Q.tv ? 16 : 34
if (FILM) for (const pl of [bPlume, sPlume]) { pl.mat.defines.NEIGHBOURS = 1; pl.mat.needsUpdate = true }
bPlume.mat.uniforms.uSteps.value = FILM ? 48 : Q.tv ? 16 : 30
sPlume.mat.uniforms.uSteps.value = FILM ? 48 : Q.tv ? 16 : 30
// TV performance mode: no MSAA, a smaller sun shadow map, a fixed light budget; the ray march step
// counts above are the level of detail for the clouds and the engine plumes
if (Q.tv) { pipe.setSamples(Q.samples); setShadowMapSize(scene, Q.shadowMap); capLights(scene, Q.lights) }
pipe.layers.layers = [{ scene: sky.back, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) }, { scene, camera: cam }]

/* ---------------- the sim the chapters steer ---------------- */
const rig = new Rig()
const sim: Sim = { v: vehicle, cam, rig, studio: 0, studioT: 0, clock: 44.5, rate: 0.5, cut: 0, cutT: 0, explode: 0, explodeT: 0, follow: 'all', stage: -1, staging: false }
const chapters: Chapter[] = ALL.map(f => f(sim))

/* ---------------- HUD ---------------- */
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const hud = {
  kicker: $('#kicker'), stats: $('#stats'), text: $('#text'), cap: $('#cap'),
  controls: $('#controls'), tabs: $('#tabs'), labels: $('#labels'), play: $('#play'), auto: $('#auto'),
}

let idx = Math.max(0, chapters.findIndex(c => c.id === params.get('c')))
let auto = !params.has('manual')
let ct = 0
let fade = 0
let lastStats = '', lastText = '', lastCap = ''
const controlsList: Control[] = panel(sim, () => stopAuto())

function buildTabs() {
  hud.tabs.innerHTML = chapters.map((c, i) => `<button data-i="${i}" class="tab${i === idx ? ' on' : ''}"><i></i>${c.tab}</button>`).join('')
  hud.tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { go(+b.getAttribute('data-i')!) }))
}
const btnText = (c: Extract<Control, { kind: 'button' }>) => (typeof c.text === 'function' ? c.text() : c.text)
function controlHtml(c: Control) {
  if (c.kind === 'seg') return `<div class="row"><div class="lab">${c.label}</div><div class="seg" data-id="${c.id}">${c.options.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join('')}</div></div>`
  if (c.kind === 'slider') return `<div class="row"><div class="lab">${c.label}<span class="val" data-val="${c.id}"></span></div><input type="range" data-id="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}"></div>`
  return `<div class="row"><div class="lab">${c.label}</div><button class="btn" data-id="${c.id}">${btnText(c)}</button></div>`
}
function buildControls() {
  hud.controls.innerHTML = controlsList.map(controlHtml).join('') + '<div class="hint">Drag to look around. Scroll to zoom.</div>'
  for (const c of controlsList) {
    if (c.kind === 'seg') hud.controls.querySelectorAll<HTMLButtonElement>(`.seg[data-id="${c.id}"] button`).forEach(b => b.addEventListener('click', () => { stopAuto(); c.set(b.dataset.v!); sfx('tick', { f: 1800, v: 0.15 }); syncControls() }))
    if (c.kind === 'slider') { const el = hud.controls.querySelector<HTMLInputElement>(`input[data-id="${c.id}"]`)!; el.addEventListener('input', () => { stopAuto(); c.set(+el.value); syncControls() }) }
    if (c.kind === 'button') hud.controls.querySelector<HTMLButtonElement>(`.btn[data-id="${c.id}"]`)!.addEventListener('click', () => { stopAuto(); c.run(); syncControls() })
  }
  syncControls()
}
function syncControls() {
  for (const c of controlsList) {
    if (c.kind === 'seg') { const v = c.get(); hud.controls.querySelectorAll<HTMLButtonElement>(`.seg[data-id="${c.id}"] button`).forEach(b => b.classList.toggle('on', b.dataset.v === v)) }
    if (c.kind === 'slider') {
      const el = hud.controls.querySelector<HTMLInputElement>(`input[data-id="${c.id}"]`)!
      if (document.activeElement !== el) el.value = String(c.get())
      const p = (c.get() - c.min) / (c.max - c.min); el.style.setProperty('--p', `${(p * 100).toFixed(1)}%`)
      hud.controls.querySelector<HTMLElement>(`[data-val="${c.id}"]`)!.textContent = c.fmt(c.get())
    }
    if (c.kind === 'button') { const b = hud.controls.querySelector<HTMLButtonElement>(`.btn[data-id="${c.id}"]`)!; const t = btnText(c); if (b.textContent !== t) b.textContent = t }
  }
}
function go(i: number) {
  idx = (i + chapters.length) % chapters.length
  ct = 0; fade = 0
  chapters[idx].enter()
  hud.tabs.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === idx))
  hud.labels.innerHTML = ''
  labelEls.clear()
  if (!auto) { chapters[idx].script(0.6, t); setCU(-1); sim.cut = sim.cutT; sim.explode = sim.explodeT } else setCU(0)
  updateAutoUi()
  syncControls()
}
function stopAuto() { if (auto) { auto = false; setCU(-1); updateAutoUi() } }
function updateAutoUi() {
  hud.play.classList.toggle('playing', auto)
  hud.play.setAttribute('aria-label', auto ? 'Pause the tour' : 'Play the tour')
  hud.auto.textContent = auto ? 'plays itself' : 'your turn'
}
hud.play.addEventListener('click', () => { auto = !auto; if (auto) { ct = 0; chapters[idx].enter() } else setCU(-1); updateAutoUi() })

/* ---------------- sound ---------------- */
/* the page is silent on purpose: no sound button, no audio context */

/* ---------------- input ---------------- */
const pointer: View['pointer'] = { dx: 0, dy: 0, wheel: 0, down: false, click: null }
let px = 0, py = 0
canvas.addEventListener('pointerdown', e => { pointer.down = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); stopAuto() })
canvas.addEventListener('pointermove', e => { if (!pointer.down) return; pointer.dx += e.clientX - px; pointer.dy += e.clientY - py; px = e.clientX; py = e.clientY })
canvas.addEventListener('pointerup', () => { pointer.down = false })
canvas.addEventListener('pointercancel', () => { pointer.down = false })
canvas.addEventListener('wheel', e => { e.preventDefault(); pointer.wheel += e.deltaY; stopAuto() }, { passive: false })
// keys belong to the TV shell (see shell/sim-shell.ts)

/* ---------------- loop ---------------- */
let W = 1, H = 1
/** live viewers get a resolution that keeps the frame rate up; the film always renders at 1080p */
let scale = FILM ? 1 : Q.tv ? Q.maxScale : Math.min(devicePixelRatio, 1.5)
const maxScale = scale
function resize() {
  W = FILM ? 1920 : innerWidth; H = FILM ? 1080 : innerHeight
  pipe.resize(W, H, scale)
  sky.resize(W * Math.min(scale, 1), H * Math.min(scale, 1))
  cam.aspect = W / H; cam.updateProjectionMatrix()
}
let perfAcc = 0, perfN = 0
function adapt(ms: number) {
  if (FILM || Q.tv) return // in TV mode the shell's resolution governor owns the scale
  perfAcc += ms; perfN++
  if (perfN < 40) return
  const avg = perfAcc / perfN
  perfAcc = 0; perfN = 0
  const next = avg > 30 ? Math.max(0.55, scale * 0.85) : avg < 17 ? Math.min(maxScale, scale * 1.1) : scale
  if (Math.abs(next - scale) > 0.02) { scale = next; resize() }
}
addEventListener('resize', resize)

const DBG: { hide: string; exp: number; pk: number; cam: number[] | null; sun: number; env: number; pts: number } = { hide: '', exp: 0, pk: 1, cam: null, sun: -1, env: -1, pts: -1 }
;(window as unknown as { __dbg: unknown }).__dbg = DBG
let t = 0
const labelEls = new Map<string, HTMLElement>()
let capT = 0
let wasStaged = false
let lastShadow = ''
const skyAmb = new THREE.Vector3()
const tmpC = new THREE.Color()

function frame(dt: number) {
  t += dt
  const ch = chapters[idx]
  if (auto) {
    ct += dt
    if (ct >= ch.length) { go(idx + 1); return frame(0) }
    setCU(ct / ch.length)
    ch.script(ct / ch.length, t)
  }
  const v: View = { w: W, h: H, t, dt, auto, pointer }
  ch.update(v)
  pointer.dx = 0; pointer.dy = 0; pointer.wheel = 0; pointer.click = null

  /* ---- mission clock, staging ---- */
  sim.clock = Math.min(MECO + 18, sim.clock + dt * sim.rate)
  if (sim.staging && sim.clock >= MECO) {
    if (!wasStaged) { sfx('ignite', { v: 1 }); wasStaged = true }
    sim.stage = sim.clock - MECO
  } else { sim.stage = -1; wasStaged = false }
  const st = sim.stage
  const f = flight(sim.clock)
  const k = 1 - Math.exp(-dt * 2.4)
  sim.cut += (sim.cutT - sim.cut) * k
  sim.explode += (sim.explodeT - sim.explode) * k
  if (Math.abs(sim.cut - sim.cutT) < 0.002) sim.cut = sim.cutT
  if (Math.abs(sim.explode - sim.explodeT) < 0.002) sim.explode = sim.explodeT
  const sep = st > 1.4 ? 0.5 * 2.6 * (st - 1.4) ** 2 : 0
  vehicle.update({ bLox: f.bLox, bCh4: f.bCh4, sLox: f.sLox, sCh4: f.sCh4, explode: sim.explode, sep, cut: sim.cut })
  // the stack leans over along its flight path
  vehicle.root.rotation.z = -f.pitch
  // after separation the booster starts to turn back
  if (st > 2.5) {
    const a = 0.035 * (st - 2.5) ** 2
    vehicle.booster.rotation.z = a
    const pv = new THREE.Vector3(0, 36, 0)
    vehicle.booster.position.copy(pv).sub(pv.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), a))
    vehicle.booster.position.y -= 0.5 * 2.0 * (st - 2.5) ** 2
  } else { vehicle.booster.rotation.z = 0; vehicle.booster.position.set(0, 0, 0) }

  /* ---- sky and light ---- */
  if (DBG.cam) { rig.pos.set(DBG.cam[0], DBG.cam[1], DBG.cam[2]); rig.tgt.set(DBG.cam[3], DBG.cam[4], DBG.cam[5]); rig.fov = DBG.cam[6] ?? 30 }
  rig.apply(cam, vehicle.root)
  cam.updateMatrixWorld()
  const camAlt = f.h
  sky.off.set(f.x * Math.cos(0.0) + 0.0, 0).set(f.x, -1800 + t * 0.0)
  sky.update(cam, camAlt, t)
  sim.studio += (sim.studioT - sim.studio) * (1 - Math.exp(-dt * 2.2))
  if (Math.abs(sim.studio - sim.studioT) < 0.002) sim.studio = sim.studioT
  const sd = THREE.MathUtils.smoothstep(sim.studio, 0, 1)
  // the sky is lit like the real thing (exposure about 0.3), the studio like the engine exhibit (about 1)
  const exposure = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.32, 0.2, THREE.MathUtils.smoothstep(f.h, 20000, 50000)), 0.8, sd)
  const skyK = THREE.MathUtils.lerp(0.32, 0.2, THREE.MathUtils.smoothstep(f.h, 20000, 50000)) / exposure
  sky.studio.value = sd
  sky.skyScale.value = skyK
  const envTex = sky.env()
  if (envTex) skyEnv.tex = envTex
  scene.environment = sd < 0.5 ? skyEnv.tex : studioEnv
  scene.environmentIntensity = sd < 0.5 ? skyK : 0.32
  tmpC.copy(sky.sunCol)
  sunLight.color.copy(tmpC)
  sunLight.intensity = 17 * skyK * (1 - sd)
  key.intensity = 0.9 * sd; rimL.intensity = 1.1 * sd
  key.target.position.set(0, 60, 0).applyMatrix4(vehicle.root.matrixWorld); key.position.copy(key.target.position).add(new THREE.Vector3(-260, 220, 120))
  rimL.position.copy(key.target.position).add(new THREE.Vector3(240, 120, -220)); rimL.target.position.copy(key.target.position)
  for (const L of tankLights) L.intensity = vehicle.cut.capsOn ? 70 * sd : 0
  const center = new THREE.Vector3(0, 62, 0).applyMatrix4(vehicle.root.matrixWorld)
  sunLight.position.copy(center).addScaledVector(sky.sun, 300)
  sunLight.target.position.copy(center)
  // the shadow map only needs drawing again when the stack moved against the sun
  const shKey = `${f.pitch.toFixed(3)}|${sim.explode.toFixed(3)}|${sep.toFixed(1)}|${vehicle.booster.rotation.z.toFixed(3)}|${sim.cut.toFixed(3)}`
  if (shKey !== lastShadow) { renderer.shadowMap.needsUpdate = true; lastShadow = shKey }
  skyAmb.set(0.18, 0.3, 0.6).multiplyScalar(1 - THREE.MathUtils.smoothstep(f.h, 20000, 70000) * 0.8)

  /* ---- engines and plumes ---- */
  const before = st < 0
  const bOn = before ? 1 : st < 3.2 ? 1 : Math.max(0, 1 - (st - 3.2) / 0.6)
  const ringB: [number, number, number] = before ? [1, 1, 1] : [1, 0, 0]
  bPlume.update(dt, t, f.pa, before ? f.thr : 0.45, bOn * (sim.explode > 0.3 ? 0 : 1) * (1 - sd) * DBG.pk, ringB, cam)
  const sOn = st > 0.35 ? Math.min(1, (st - 0.35) / 0.4) : 0
  sPlume.update(dt, t, f.pa, 1, sOn * Math.min(1, sep / 12 + 0.25), [1, 1, 0], cam)
  for (const L of sPlume.lights) L.intensity *= 0.12
  vents.update(t, st > 0.3 ? Math.min(1, (st - 0.3) / 0.25) * Math.exp(-Math.max(0, st - 1.2) * 0.9) * (sep < 18 ? 1 : 0) : 0)
  vehicle.vacMat.emissiveIntensity = sOn * 2.2
  VU.uScorch.value = st > 0.4 ? Math.min(1, (st - 0.4) / 1.5) : 0
  VU.uBaseGlow.value.set(bOn * (sim.explode > 0.3 ? 0 : 1) * (0.6 + 0.4 * Math.min(1, (101325 - f.pa) / 60000)), sOn)
  FLUID_TIME.value = t
  FLUID_RATE.value = 1
  FLUID_ON.value = 1
  applyFollow(sim, dt)
  trail.update(t, cam, sky.sun, sky.sunCol, skyAmb, f.h, before && sim.explode < 0.3 ? 1 - sd : 0, bPlume.s.len * 0.55, 1 + 2.5 * THREE.MathUtils.smoothstep(f.h, 10000, 50000))
  vapor.update(t, f.mach, sky.sun, sky.sunCol, skyAmb)
  vapor.group.visible = vapor.group.visible && sim.explode < 0.05 && sim.cut < 0.05 && sd < 0.05

  if (DBG.hide) for (const n of DBG.hide.split(',')) { const o = ({ plume: bPlume.mesh, splume: sPlume.mesh, trail: trail.mesh, vapor: vapor.group, vehicle: vehicle.root.children[0] } as Record<string, THREE.Object3D>)[n]; if (o) o.visible = false }

  if (DBG.sun >= 0) sunLight.intensity = DBG.sun
  if (DBG.env >= 0) scene.environmentIntensity = DBG.env
  if (DBG.pts >= 0) scene.traverse(o => { if ((o as THREE.PointLight).isPointLight) (o as THREE.PointLight).intensity = DBG.pts })

  /* ---- post ---- */
  fade = Math.min(1, fade + dt / 0.4)
  const out = auto ? THREE.MathUtils.clamp((ch.length - ct) / 0.35, 0, 1) : 1
  pipe.lens.u.uFade.value = Math.min(idx === 0 && auto ? Math.min(1, ct / 1.2) : fade, out)
  renderer.toneMappingExposure = DBG.exp || exposure
  pipe.bloom.strength = THREE.MathUtils.lerp(0.5, 0.45, sd)
  pipe.bloom.radius = 0.55
  pipe.bloom.threshold = THREE.MathUtils.lerp(24, 3.0, sd)
  // lens flare from the sun when it is on screen and not behind the vehicle
  const sp = cam.position.clone().addScaledVector(sky.sun, 1000).project(cam)
  const onScreen = sp.z < 1 && Math.abs(sp.x) < 1.2 && Math.abs(sp.y) < 1.2
  pipe.lens.u.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5)
  pipe.lens.u.uSunVis.value = onScreen ? 0.35 * sunVisibility() * (1 - sd) : 0
  pipe.lens.u.uTime.value = t
  pipe.render(dt)

  /* ---- HUD ---- */
  hud.kicker.textContent = ch.kicker
  const stats = ch.stats().map(x => `<div class="stat"><div class="k">${x.k}</div><div class="v ${x.c ?? ''}">${x.v}${x.u ? `<small>${x.u}</small>` : ''}</div></div>`).join('')
  if (stats !== lastStats) { hud.stats.innerHTML = stats; lastStats = stats }
  const text = ch.text()
  if (text !== lastText) { hud.text.innerHTML = text; lastText = text }
  const cap = auto ? ch.caption() : ''
  if (cap !== lastCap) { hud.cap.textContent = cap; capT = 0; lastCap = cap }
  capT += dt
  const ci = Math.min(1, capT / 0.5), ce = 1 - Math.pow(1 - ci, 3)
  hud.cap.style.transform = `translate(-50%, ${((1 - ce) * 14).toFixed(1)}px)`
  hud.cap.style.filter = ci < 1 ? `blur(${((1 - ce) * 6).toFixed(1)}px)` : 'none'
  hud.cap.style.opacity = String(pipe.lens.u.uFade.value * Math.min(1, ci * 2.5))
  const seen = new Set<string>()
  for (const l of ch.labels(v)) {
    seen.add(l.id)
    let el = labelEls.get(l.id)
    if (!el || !el.isConnected) { el = document.createElement('div'); el.className = 'pill'; hud.labels.appendChild(el); labelEls.set(l.id, el) }
    const html = `<i style="${l.dot ? `background:${l.dot};color:${l.dot}` : ''}"></i><b>${l.text}</b>${l.sub ? `<span>${l.sub}</span>` : ''}`
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html }
    el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`
    el.style.opacity = String(l.vis * pipe.lens.u.uFade.value)
  }
  for (const [id, el] of labelEls) if (!seen.has(id)) { el.remove(); labelEls.delete(id) }
  shell.tick(dt)
  if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) syncControls()
  ;($('#progress') as HTMLElement).style.width = `${auto ? (ct / ch.length) * 100 : 0}%`
}

/** is the sun hidden behind the stack? a cheap ray test against the vehicle's axis as a cylinder */
function sunVisibility() {
  const inv = vehicle.root.matrixWorld.clone().invert()
  const o = cam.position.clone().applyMatrix4(inv)
  const d = sky.sun.clone().transformDirection(inv)
  // closest approach of the ray to the axis segment y in [0, top]
  let best = 1
  for (let i = 0; i <= 40; i++) {
    const y = (S.top * i) / 40
    const tt = (y - o.y) / (d.y || 1e-6)
    if (tt <= 0) continue
    const p = o.clone().addScaledVector(d, tt)
    const r = Math.hypot(p.x, p.z)
    best = Math.min(best, THREE.MathUtils.smoothstep(r, R * 0.9, R * 1.3))
  }
  return best
}

resize()
buildTabs()
buildControls()
document.body.classList.toggle('film', FILM)

/* ---------------- the TV shell ---------------- */
const shell = mountShell({
  id: 'starship', title: 'Starship',
  chapters: chapters.map(c => ({ id: c.id, tab: c.tab, kicker: c.kicker, length: c.length })),
  controls: controlsList,
  index: () => idx,
  go: (i, manual) => { if (manual) stopAuto(); go(i) },
  isAuto: () => auto,
  setAuto: on => { if (on === auto) return; auto = on; if (auto) { ct = 0; chapters[idx].enter() } else setCU(-1); updateAutoUi() },
  progress: () => ct / chapters[idx].length,
  text: () => chapters[idx].text(), kicker: () => chapters[idx].kicker, stats: () => chapters[idx].stats(),
  renderer, quality: Q,
  setScale: s => { scale = s; resize() }, getScale: () => scale,
})
;(window as unknown as { __sim: unknown }).__sim = { sim, vehicle, sky, cam, rig, bPlume, sPlume, renderer, scene, pipe }
if (FILM) {
  audio.film(() => t)
  go(idx)
  let t0 = 0
  ;(window as unknown as { __film: unknown }).__film = {
    step: (dt: number, n = 1) => { for (let i = 0; i < n; i++) frame(dt) },
    goto: (i: number, noFade = false) => { auto = true; go(i); ct = 0; if (noFade) fade = 1 },
    startAudio: () => { audio.filmReset(); t0 = t },
    audio: (duration: number) => audio.renderFilm(duration, t0),
    chapters: chapters.map(c => ({ id: c.id, length: c.length })),
    ready: true,
  }
} else {
  go(idx)
  let last = performance.now()
  const loop = (now: number) => {
    const raw = now - last
    const dt = Math.min(0.05, raw / 1000); last = now
    adapt(raw)
    frame(dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
