import * as THREE from 'three'
import { FLUIDS } from '../raptor/fluid'
import { flight, fmtClock, MECO, RAPTOR } from './flight'
import { B, S, S0, TANKS, R } from './dims'
import { sfx } from './sfx'
import type { Vehicle } from './vehicle'

/* same contract as the Roman, The Line, internet and printer pages */
export interface Stat { k: string; v: string; u?: string; c?: string }
export interface Label { id: string; text: string; sub?: string; x: number; y: number; vis: number; dot?: string }
export type Control =
  | { kind: 'seg'; id: string; label: string; options: [string, string][]; get: () => string; set: (v: string) => void }
  | { kind: 'slider'; id: string; label: string; min: number; max: number; step: number; get: () => number; set: (v: number) => void; fmt: (v: number) => string }
  | { kind: 'button'; id: string; label: string; text: string | (() => string); run: () => void }
export interface View {
  w: number; h: number; t: number; dt: number; auto: boolean
  pointer: { dx: number; dy: number; wheel: number; down: boolean; click: { x: number; y: number } | null }
}
export interface Chapter {
  id: string; tab: string; kicker: string
  length: number
  enter(): void
  script(u: number, t: number): void
  update(v: View): void
  stats(): Stat[]
  text(): string
  caption(): string
  labels(v: View): Label[]
}

/** what the page is showing; chapters steer it, the panel lets people take it over */
export interface Sim {
  v: Vehicle
  /** 0 = in the sky, 1 = a clean studio behind the vehicle (cutaway, exploded) */
  studio: number; studioT: number
  cam: THREE.PerspectiveCamera
  rig: Rig
  /** mission clock (s after liftoff) and how fast it runs (1 = real time) */
  clock: number
  rate: number
  cut: number; cutT: number
  explode: number; explodeT: number
  follow: string
  /** seconds since the booster shut down for hot staging, or -1 before it */
  stage: number
  staging: boolean
}

const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp
const ease = (x: number) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const ramp = (u: number, a: number, b: number) => ease((u - a) / (b - a))
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/* ---------------- camera, in the vehicle's frame ---------------- */
type Key = [number, [number, number, number], [number, number, number], number?]
export class Rig {
  readonly pos = new THREE.Vector3(160, 60, 420)
  readonly tgt = new THREE.Vector3(0, 60, 0)
  fov = 30
  roll = 0
  private cache = new Map<Key[], { p: THREE.CatmullRomCurve3; t: THREE.CatmullRomCurve3 }>()
  shot(keys: Key[], u: number) {
    let c = this.cache.get(keys)
    if (!c) {
      c = { p: new THREE.CatmullRomCurve3(keys.map(k => V3(...k[1])), false, 'centripetal'), t: new THREE.CatmullRomCurve3(keys.map(k => V3(...k[2])), false, 'centripetal') }
      this.cache.set(keys, c)
    }
    let i = 0
    while (i < keys.length - 2 && u > keys[i + 1][0]) i++
    const f = clamp((u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), 0, 1)
    const s = (i + f) / (keys.length - 1)
    c.p.getPoint(s, this.pos); c.t.getPoint(s, this.tgt)
    const fa = keys[i][3] ?? 30, fb = keys[i + 1][3] ?? fa
    this.fov = lerp(fa, fb, f)
  }
  orbit(dx: number, dy: number, wheel: number) {
    const off = this.pos.clone().sub(this.tgt)
    const sph = new THREE.Spherical().setFromVector3(off)
    sph.theta -= dx * 0.005
    sph.phi = clamp(sph.phi - dy * 0.005, 0.05, Math.PI - 0.05)
    sph.radius = clamp(sph.radius * Math.exp(wheel * 0.001), 6, 2500)
    this.pos.copy(this.tgt).add(off.setFromSpherical(sph))
  }
  apply(cam: THREE.PerspectiveCamera, root: THREE.Object3D) {
    root.updateMatrixWorld()
    cam.position.copy(this.pos).applyMatrix4(root.matrixWorld)
    const t = this.tgt.clone().applyMatrix4(root.matrixWorld)
    cam.up.set(0, 1, 0)
    cam.lookAt(t)
    if (this.roll) cam.rotateZ(this.roll)
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix() }
    const d = cam.position.distanceTo(t)
    const near = clamp(d * 0.02, 0.05, 4)
    if (Math.abs(cam.near - near) > near * 0.1) { cam.near = near; cam.far = 4e5; cam.updateProjectionMatrix() }
  }
}

/* ---------------- shared helpers ---------------- */
export let CU = -1
export function setCU(u: number) { CU = u }
const capAt = (list: [number, number, string][]) => { for (const [a, b, c] of list) if (CU >= a && CU < b) return c; return '' }

function project(s: Sim, v: View, p: THREE.Vector3) {
  const q = p.clone().project(s.cam)
  const vis = q.z < 1 && Math.abs(q.x) < 1.05 && Math.abs(q.y) < 1.05 ? 1 : 0
  return { x: (q.x * 0.5 + 0.5) * v.w, y: (-q.y * 0.5 + 0.5) * v.h, vis }
}
/** a label at a point in a part's frame (so it rides along when the stack is pulled apart) */
function label(s: Sim, v: View, id: string, at: THREE.Vector3, text: string, sub: string, k: number, dot = '#7fd8ff', part?: string): Label {
  const obj = part ? s.v.parts.find(p => p.name === part)!.group : s.v.root
  obj.updateMatrixWorld()
  const w = at.clone().applyMatrix4(obj.matrixWorld)
  const p = project(s, v, w)
  return { id, text, sub, x: p.x, y: p.y, vis: p.vis * clamp(k, 0, 1), dot }
}
const C = { lox: '#46c8ff', ch4: '#ffa23a', gas: '#9b7bff', fire: '#ffd9a8', steel: '#dfe6f0' }

const tonnes = (x: number) => `${Math.round(x).toLocaleString('en-US')}`
function flightStats(s: Sim): Stat[] {
  const f = flight(s.clock)
  return [
    { k: 'Clock', v: fmtClock(s.clock), c: 'cool' },
    { k: 'Altitude', v: (f.h / 1000).toFixed(1), u: 'km' },
    { k: 'Speed', v: Math.round(f.v * 3.6).toLocaleString('en-US'), u: 'km/h' },
  ]
}

/** common per frame work: the user's camera */
function common(s: Sim, v: View) {
  if (!v.auto && (v.pointer.dx || v.pointer.dy || v.pointer.wheel)) s.rig.orbit(v.pointer.dx, v.pointer.dy, v.pointer.wheel)
}

/** the moment: 45 s after liftoff Starship is just above a deck of cumulus, going through Mach 1 */
export const MOMENT = 44.5

/* =====================================================================
   1. above the clouds: the sun behind it, push in from a long way out
   ===================================================================== */
export function climbChapter(s: Sim): Chapter {
  const keys: Key[] = [
    [0, [-300, 380, 1700], [0, -40, 0], 30],
    [0.45, [-180, 160, 820], [0, 0, 0], 30],
    [0.8, [-90, 50, 380], [0, 10, 0], 30],
    [1, [-75, 45, 320], [0, 18, 0], 30],
  ]
  return {
    id: 'climb', tab: 'Above the clouds', kicker: 'Starship V3 · ascent', length: 12,
    enter() { s.studioT = 0; s.studio = 0; s.clock = MOMENT - 3; s.rate = 0.5; s.cutT = 0; s.explodeT = 0; s.cut = 0; s.explode = 0; s.staging = false; s.stage = -1; sfx('mood', { key: 'climb' }); sfx('rumble', { d: 12, v: 0.9 }) },
    script(u) { s.rig.shot(keys, ease(u)) },
    update(v) { common(s, v) },
    stats: () => flightStats(s),
    text: () => `<b>124 m</b> of steel on <b>33 Raptor 3</b> engines, going through the speed of sound.`,
    caption: () => capAt([[0.05, 0.5, 'Starship, T+0:45.'], [0.5, 0.98, 'Mach 1, above the clouds.']]),
    labels: () => [],
  }
}

/* =====================================================================
   2. cut it in half
   ===================================================================== */
export function cutChapter(s: Sim): Chapter {
  const keys: Key[] = [
    [0, [-40, 70, 240], [0, 62, 0], 30],
    [0.5, [10, 66, 200], [0, 62, 0], 32],
    [1, [40, 62, 190], [0, 62, 0], 32],
  ]
  return {
    id: 'cut', tab: 'Cut in half', kicker: 'Section through the stack', length: 11,
    enter() { s.studioT = 0; s.clock = MOMENT; s.rate = 0.05; s.cutT = 0; s.explodeT = 0; s.follow = 'all'; sfx('mood', { key: 'cut' }); sfx('whoosh', { d: 1.6 }) },
    script(u) { s.rig.shot(keys, ease(u)); s.cutT = ramp(u, 0.12, 0.42); s.studioT = u > 0.08 ? 1 : 0 },
    update(v) { common(s, v) },
    stats: () => {
      const f = flight(s.clock)
      return [
        { k: 'Oxygen', v: tonnes(f.bLox + f.sLox), u: 't', c: 'cool' },
        { k: 'Methane', v: tonnes(f.bCh4 + f.sCh4), u: 't', c: 'warm' },
        { k: 'Steel', v: '4', u: 'mm wall' },
      ]
    },
    text: () => `Four tanks: <b style="color:${C.lox}">liquid oxygen</b> below, <b style="color:${C.ch4}">liquid methane</b> above, in each stage.`,
    caption: () => capAt([[0.04, 0.45, 'Cut it in half.'], [0.45, 0.98, 'Almost all propellant.']]),
    labels: (v) => {
      const k = ramp(CU < 0 ? 1 : CU, 0.42, 0.55)
      return [
        label(s, v, 'blox', V3(-2.2, 20, 0), 'Liquid oxygen', `${tonnes(flight(s.clock).bLox)} t`, k, C.lox, 'b-lox'),
        label(s, v, 'bch4', V3(-2.2, 51, 0), 'Liquid methane', `${tonnes(flight(s.clock).bCh4)} t`, k, C.ch4, 'b-ch4'),
        label(s, v, 'slox', V3(-2.2, S0 + 12, 0), 'Oxygen', `${tonnes(flight(s.clock).sLox)} t`, k, C.lox, 's-lox'),
        label(s, v, 'sch4', V3(-2.2, S0 + 25, 0), 'Methane', `${tonnes(flight(s.clock).sCh4)} t`, k, C.ch4, 's-ch4'),
        label(s, v, 'bay', V3(-2.5, S.bay0 + 6, 0), 'Payload bay', 'Starlink satellites', k, C.steel, 's-bay'),
      ]
    },
  }
}

/* =====================================================================
   3. what is in the tanks: frost line, downcomer, header tanks
   ===================================================================== */
export function tanksChapter(s: Sim): Chapter {
  const keys: Key[] = [
    [0, [26, 66, 54], [0, 60, 0], 34],
    [0.35, [22, 44, 46], [0, 40, 0], 34],
    [0.7, [20, 22, 44], [0, 20, 0], 34],
    [1, [24, 12, 52], [0, 12, 0], 34],
  ]
  let lastT = 0
  return {
    id: 'tanks', tab: 'Tanks', kicker: 'What is in the tanks', length: 13,
    enter() { s.studioT = 1; s.clock = MOMENT; s.rate = 0.05; s.cutT = 1; s.explodeT = 0; sfx('mood', { key: 'tanks' }); lastT = 0 },
    script(u) {
      s.rig.shot(keys, ease(u))
      // a time lapse: the levels fall and the frost line on the outside follows them down
      s.rate = u > 0.45 && u < 0.9 ? 6 : 0.05
      if (u > 0.45 && lastT <= 0.45) sfx('riser', { d: 1.6 })
      lastT = u
    },
    update(v) { common(s, v) },
    stats: () => {
      const f = flight(s.clock)
      return [
        { k: 'Booster O₂', v: tonnes(f.bLox), u: 't', c: 'cool' },
        { k: 'Booster CH₄', v: tonnes(f.bCh4), u: 't', c: 'warm' },
        { k: 'Flow', v: (33 * RAPTOR.mdot * f.thr / 1000).toFixed(1), u: 't/s' },
      ]
    },
    text: () => `Methane falls through the <b>downcomer</b>, a pipe straight through the oxygen tank.`,
    caption: () => capAt([[0.04, 0.42, 'Methane falls through the oxygen.'], [0.45, 0.98, 'Frost line = liquid level.']]),
    labels: (v) => {
      const lv = (i: number) => (s.v.cut.capsOn ? (i === 0 ? TANKS.B.lox.level(flight(s.clock).bLox * 1000 / TANKS.B.lox.mass) : TANKS.B.ch4.level(flight(s.clock).bCh4 * 1000 / TANKS.B.ch4.mass)) : 0)
      return [
        label(s, v, 'dc', V3(0, 30, 0.5), 'Downcomer', 'methane in the oxygen tank', ramp(CU < 0 ? 1 : CU, 0.05, 0.15) * (1 - ramp(CU < 0 ? 0 : CU, 0.6, 0.7)), C.ch4, 'b-lox'),
        label(s, v, 'lvl', V3(-R, lv(0), -0.4), 'Frost line', 'liquid level inside', ramp(CU < 0 ? 1 : CU, 0.45, 0.55), C.steel, 'b-lox'),
        label(s, v, 'gox', V3(-4.2, 26, 0), 'Hot oxygen gas', 'keeps the tank pressed', ramp(CU < 0 ? 1 : CU, 0.15, 0.25) * (1 - ramp(CU < 0 ? 0 : CU, 0.45, 0.5)), C.gas, 'b-lox'),
        label(s, v, 'cd', V3(2, 37.2, 0), 'Common dome', 'one wall, two liquids', ramp(CU < 0 ? 1 : CU, 0.1, 0.2) * (1 - ramp(CU < 0 ? 0 : CU, 0.4, 0.45)), C.steel, 'b-lox'),
      ]
    },
  }
}

/* =====================================================================
   4. 33 Raptor 3: under the booster, looking up into the fire
   ===================================================================== */
export function enginesChapter(s: Sim): Chapter {
  const keys: Key[] = [
    [0, [44, -4, 40], [0, 4, 0], 34],
    [0.5, [30, -9, 34], [0, 2, 0], 36],
    [1, [10, -12, 36], [0, 1, 0], 38],
  ]
  return {
    id: 'engines', tab: '33 engines', kicker: 'Super Heavy · Raptor 3', length: 12,
    enter() { s.studioT = 0; s.clock = MOMENT; s.rate = 0.05; s.cutT = 0; s.explodeT = 0; sfx('mood', { key: 'engines' }); sfx('rumble', { d: 12, v: 1 }) },
    script(u) { s.rig.shot(keys, ease(u)) },
    update(v) {
      common(s, v)
      // the inner three steer: they wander a few degrees
      const g = s.v.bEng.gimbal
      for (let i = 0; i < 3; i++) g[i].set(Math.sin(v.t * 0.9 + i * 2.1) * 0.06, Math.cos(v.t * 0.7 + i * 1.3) * 0.06)
      s.v.bEng.sync()
    },
    stats: () => [
      { k: 'Engines', v: '33', u: 'Raptor 3', c: 'warm' },
      { k: 'Thrust', v: (33 * 280).toLocaleString('en-US'), u: 'tf' },
      { k: 'Each', v: '280', u: 'tf' },
    ],
    text: () => `<b>3</b> steer, <b>10</b> around them, <b>20</b> fixed on the outside.`,
    caption: () => capAt([[0.04, 0.5, '33 Raptor 3 engines.'], [0.5, 0.98, 'Over twice a Saturn V.']]),
    labels: (v) => {
      const k = ramp(CU < 0 ? 1 : CU, 0.2, 0.3)
      return [
        label(s, v, 'r1', V3(0.98, 0, 0), 'Center 3', 'steer', k, C.fire, 'b-engines'),
        label(s, v, 'r2', V3(-2.5, 0, 0), 'Middle 10', 'steer', k, C.fire, 'b-engines'),
        label(s, v, 'r3', V3(3.86, 0, -0.6), 'Outer 20', 'fixed', k, C.fire, 'b-engines'),
      ]
    },
  }
}

/* =====================================================================
   5. pulled apart: every section and where it separates
   ===================================================================== */
export function explodeChapter(s: Sim): Chapter {
  const keys: Key[] = [
    [0, [-90, 70, 230], [0, 64, 0], 34],
    [0.45, [-60, 72, 260], [0, 72, 0], 36],
    [1, [-20, 76, 250], [0, 76, 0], 36],
  ]
  return {
    id: 'explode', tab: 'Pulled apart', kicker: 'Every section', length: 12,
    enter() { s.studioT = 1; s.cutT = 0; s.clock = MOMENT; s.rate = 0.05; sfx('mood', { key: 'explode' }); sfx('whoosh', { d: 1.4, dir: 'down' }) },
    script(u) { s.rig.shot(keys, ease(u)); s.explodeT = ramp(u, 0.08, 0.4); s.cutT = ramp(u, 0.55, 0.75) },
    update(v) { common(s, v) },
    stats: () => [
      { k: 'Height', v: S.top.toFixed(1), u: 'm' },
      { k: 'Booster', v: B.hsr1.toFixed(1), u: 'm' },
      { k: 'Ship', v: (S.top - S0).toFixed(1), u: 'm' },
    ],
    text: () => `Super Heavy below, the ship on top. They split at the <b>hot stage ring</b>.`,
    caption: () => capAt([[0.04, 0.5, 'Pull it apart.'], [0.5, 0.98, 'Two rockets, stacked.']]),
    labels: (v) => {
      const k = ramp(CU < 0 ? 1 : CU, 0.32, 0.42)
      return [
        label(s, v, 'e1', V3(R, 2.5, 0), 'Engine bay', '33 engines, 12 pressure bottles', k, C.fire, 'b-aft'),
        label(s, v, 'e2', V3(R, 22, 0), 'Oxygen tank', 'Super Heavy', k, C.lox, 'b-lox'),
        label(s, v, 'e3', V3(R, 50, 0), 'Methane tank', 'Super Heavy', k, C.ch4, 'b-ch4'),
        label(s, v, 'e4', V3(R + 3, B.fins, 0), 'Grid fins', 'steer it back to the tower', k, C.steel, 'b-fwd'),
        label(s, v, 'e5', V3(R, (B.hsr0 + B.hsr1) / 2, 0), 'Hot stage ring', 'separation here', k, '#ff6a8a', 'b-hsr'),
        label(s, v, 'e6', V3(R, S0 + 3, 0), 'Six engines', '3 sea level, 3 vacuum', k, C.fire, 's-aft'),
        label(s, v, 'e7', V3(R, S0 + 13, 0), 'Oxygen tank', 'Ship', k, C.lox, 's-lox'),
        label(s, v, 'e8', V3(R, S0 + 25, 0), 'Methane tank', 'Ship', k, C.ch4, 's-ch4'),
        label(s, v, 'e9', V3(R, S.bay0 + 6, 0), 'Payload bay', 'Starlink', k, C.steel, 's-bay'),
        label(s, v, 'e10', V3(R - 1, S.nose0 + 4, 0), 'Nose', 'oxygen header tank, flaps', k, C.steel, 's-nose'),
      ]
    },
  }
}

/* =====================================================================
   6. hot staging: the ship lights while still attached
   ===================================================================== */
export function stagingChapter(s: Sim): Chapter {
  const keys: Key[] = [
    [0, [-14, 52, 160], [0, 70, 0], 34],
    [0.35, [-10, 62, 135], [0, 76, 0], 32],
    [0.7, [-30, 105, 270], [0, 108, 0], 34],
    [1, [-50, 150, 400], [0, 145, 0], 34],
  ]
  return {
    id: 'staging', tab: 'Hot staging', kicker: 'Stage separation', length: 15,
    enter() { s.studioT = 0; s.studio = 0; s.clock = MECO - 2.5; s.rate = 1; s.cutT = 0; s.explodeT = 0; s.cut = 0; s.explode = 0; s.staging = true; s.stage = -1; sfx('mood', { key: 'staging' }) },
    script(u) { s.rig.shot(keys, ease(u)) },
    update(v) { common(s, v) },
    stats: () => {
      const f = flight(s.clock)
      return [
        { k: 'Clock', v: fmtClock(s.clock), c: 'cool' },
        { k: 'Altitude', v: (f.h / 1000).toFixed(0), u: 'km' },
        { k: 'Speed', v: Math.round(f.v * 3.6).toLocaleString('en-US'), u: 'km/h' },
      ]
    },
    text: () => `The ship lights while still bolted to the booster.`,
    caption: () => capAt([[0.03, 0.2, 'T+2:12.'], [0.2, 0.55, 'The ship lights while attached.'], [0.55, 0.98, 'And pushes off.']]),
    labels: (v) => {
      const k = s.stage > 0 && s.stage < 3 ? 1 : 0
      return [label(s, v, 'vents', V3(-R, (B.hsr0 + B.hsr1) / 2, 0), 'Hot stage ring', 'fire out of the vents', k, '#ff6a8a', 'b-hsr')]
    },
  }
}

export const ALL = [climbChapter, cutChapter, tanksChapter, enginesChapter, explodeChapter, stagingChapter]

/** the right hand panel: the same for every chapter */
export function panel(s: Sim, stopAuto: () => void): Control[] {
  void stopAuto
  return [
    { kind: 'seg', id: 'follow', label: 'Follow', options: [['all', 'All'], ['lox', 'Oxygen'], ['ch4', 'Methane'], ['fire', 'Fire']], get: () => s.follow, set: v => { s.follow = v } },
    { kind: 'seg', id: 'view', label: 'Starship', options: [['whole', 'Whole'], ['cut', 'Cutaway'], ['exploded', 'Exploded']], get: () => (s.explodeT > 0.5 ? 'exploded' : s.cutT > 0.5 ? 'cut' : 'whole'), set: v => { s.cutT = v === 'cut' ? 1 : 0; s.explodeT = v === 'exploded' ? 1 : 0; s.studioT = v === 'whole' ? 0 : 1 } },
    { kind: 'slider', id: 'clock', label: 'Mission clock', min: 0, max: Math.floor(MECO + 18), step: 0.5, get: () => s.clock, set: v => { s.clock = v; s.stage = v > MECO ? v - MECO : -1; s.staging = v > MECO - 3 }, fmt: v => `${fmtClock(v)} · ${(flight(v).h / 1000).toFixed(1)} km` },
    { kind: 'seg', id: 'rate', label: 'Time', options: [['0', 'Frozen'], ['0.1', 'Slow'], ['1', 'Real time']], get: () => (s.rate <= 0.001 ? '0' : s.rate < 0.5 ? '0.1' : '1'), set: v => { s.rate = +v } },
    { kind: 'button', id: 'stage', label: 'Stage separation', text: () => (s.stage > 0 ? 'Again' : 'Hot stage now'), run: () => { s.clock = MECO - 1.5; s.stage = -1; s.staging = true; s.rate = 1; s.cutT = 0; s.explodeT = 0 } },
  ]
}

export function applyFollow(s: Sim, dt: number) {
  const target: Record<string, number> = { lox: 1, ch4: 1, oxgas: 1, fuelgas: 1, fire: 1 }
  if (s.follow === 'lox') { target.ch4 = 0.12; target.fuelgas = 0.1; target.fire = 0.3 }
  if (s.follow === 'ch4') { target.lox = 0.12; target.oxgas = 0.1; target.fire = 0.3 }
  if (s.follow === 'fire') { target.lox = 0.15; target.ch4 = 0.15; target.oxgas = 0.1; target.fuelgas = 0.1; target.fire = 1.6 }
  const k = 1 - Math.exp(-dt * 6)
  for (const key of Object.keys(target) as (keyof typeof FLUIDS)[]) FLUIDS[key].emph.value += (target[key] - FLUIDS[key].emph.value) * k
}
