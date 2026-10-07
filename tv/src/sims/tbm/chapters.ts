import * as THREE from 'three'
import { TBM, GROUNDS, type Sim, type Ground as GroundKind } from './sim'
import type { Machine } from './machine'
import type { Tunnel } from './tunnel'
import type { Ground } from './ground'
import { toWorld, type Lab } from './lab'
import { CUT_M, HL } from './mats'
import { sfx } from './sfx'

export interface Stat { k: string; v: string; u?: string; c?: string }
export interface Label { id: string; text: string; sub?: string; x: number; y: number; vis: number; dot?: string }
export type Control =
  | { kind: 'seg'; id: string; label: string; options: [string, string][]; get: () => string; set: (v: string) => void }
  | { kind: 'slider'; id: string; label: string; min: number; max: number; step: number; get: () => number; set: (v: number) => void; fmt: (v: number) => string }
export interface View {
  w: number; h: number; t: number; dt: number; auto: boolean
  pointer: { dx: number; dy: number; wheel: number; down: boolean }
}
/** where the film's cursor is: over a control (its value fraction for sliders, the option for segs), or off */
export interface Cursor { id: string; v?: number | string; press: boolean }
export interface Chapter {
  id: string; tab: string; kicker: string
  length: number
  enter(): void
  script(u: number, t: number): void
  update(v: View): void
  stats(): Stat[]
  text(): string
  labels(v: View): Label[]
  cursor(u: number): Cursor | null
  mood: string
  /** depth of field for the shot: aperture, 0 = all sharp */
  dof: number
}

export interface World { sim: Sim; m: Machine; tun: Tunnel; ground: Ground; lab: Lab; cam: THREE.PerspectiveCamera; rig: Rig; state: State }

/** the visitor's knobs, shared by every chapter */
export class State {
  cut = 0
  hl: 'all' | 'muck' | 'thrust' | 'ring' = 'all'
  earth = 1
  /** what the time slider shows, as a log of the sim speed */
  get time() { return 0 }
}

const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp
const ease = (x: number) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const ramp = (u: number, a: number, b: number) => ease((u - a) / (b - a))

/* ---------------- camera ---------------- */
type Key = [number, [number, number, number], [number, number, number]]
export class Rig {
  readonly pos = new THREE.Vector3(2.6, 1.9, 3.4)
  readonly tgt = new THREE.Vector3(0, 1.15, -0.2)
  fov = 34
  private cache = new Map<Key[], { p: THREE.CatmullRomCurve3; t: THREE.CatmullRomCurve3 }>()
  shot(keys: Key[], u: number) {
    let c = this.cache.get(keys)
    if (!c) {
      c = { p: new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k[1])), false, 'centripetal'), t: new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k[2])), false, 'centripetal') }
      this.cache.set(keys, c)
    }
    let i = 0
    while (i < keys.length - 2 && u > keys[i + 1][0]) i++
    const f = clamp((u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), 0, 1)
    const s = (i + ease(f) * 0.0 + f) / (keys.length - 1)
    c.p.getPoint(clamp(s, 0, 1), this.pos); c.t.getPoint(clamp(s, 0, 1), this.tgt)
  }
  orbit(dx: number, dy: number, wheel: number) {
    const off = this.pos.clone().sub(this.tgt)
    const sph = new THREE.Spherical().setFromVector3(off)
    sph.theta -= dx * 0.005
    sph.phi = clamp(sph.phi - dy * 0.005, 0.12, Math.PI * 0.6)
    sph.radius = clamp(sph.radius * Math.exp(wheel * 0.001), 0.12, 7)
    this.pos.copy(this.tgt).add(off.setFromSpherical(sph))
    // never through the floor or the bench top
    if (this.pos.y < 0.35) this.pos.y = 0.35
  }
  apply(cam: THREE.PerspectiveCamera) {
    cam.position.copy(this.pos); cam.lookAt(this.tgt)
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix() }
  }
}

/* ---------------- helpers ---------------- */
function project(w: World, v: View, p: THREE.Vector3) {
  const q = p.clone().project(w.cam)
  const vis = q.z < 1 && Math.abs(q.x) < 1.05 && Math.abs(q.y) < 1.05 ? 1 : 0
  return { x: (q.x * 0.5 + 0.5) * v.w, y: (-q.y * 0.5 + 0.5) * v.h, vis }
}
function label(w: World, v: View, id: string, at: THREE.Vector3, text: string, sub: string, k: number, dot = '#ffb347'): Label {
  const s = project(w, v, at)
  return { id, text, sub, x: s.x, y: s.y, vis: s.vis * clamp(k, 0, 1), dot }
}
/** a machine local point (metres, relative to the face) in the world */
const mAt = (w: World, x: number, y: number, z: number) => toWorld(w.sim.xf + x, y, z)
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US')
const SPEEDS = [1, 3, 10, 30, 100, 300, 1000, 3000]
export const speedToSlider = (s: number) => Math.log10(Math.max(1, s)) / Math.log10(3000)
export const sliderToSpeed = (u: number) => Math.pow(3000, u)
void SPEEDS

export function controls(w: World): Control[] {
  const { sim, state } = w
  return [
    { kind: 'slider', id: 'cut', label: 'Cut in half', min: 0, max: 1, step: 0.001, get: () => state.cut, set: v => { state.cut = v }, fmt: v => (v < 0.01 ? 'whole' : v > 0.99 ? 'half' : `${Math.round(v * 100)}%`) },
    { kind: 'seg', id: 'ground', label: 'Ground', options: [['clay', 'Clay'], ['sand', 'Sand'], ['granite', 'Granite']], get: () => sim.ground, set: v => setGround(w, v as GroundKind) },
    { kind: 'slider', id: 'rpm', label: 'Cutterhead', min: 0, max: 3, step: 0.05, get: () => sim.rpm, set: v => { sim.rpm = v }, fmt: v => `${v.toFixed(2)} rpm` },
    { kind: 'slider', id: 'screw', label: 'Screw conveyor', min: 0.3, max: 2.2, step: 0.01, get: () => sim.screw, set: v => { sim.screw = v; sim.autoScrew = false }, fmt: v => (Math.abs(v - 1) < 0.06 ? 'balanced' : v < 1 ? `slow, ${Math.round(v * 100)}%` : `fast, ${Math.round(v * 100)}%`) },
    { kind: 'slider', id: 'time', label: 'Time', min: 0, max: 1, step: 0.001, get: () => speedToSlider(sim.speed), set: v => { sim.speed = sliderToSpeed(v) }, fmt: () => `${fmtInt(sim.speed)}x` },
    { kind: 'seg', id: 'hl', label: 'Follow', options: [['all', 'All'], ['muck', 'Spoil'], ['thrust', 'Thrust'], ['ring', 'Rings']], get: () => state.hl, set: v => { state.hl = v as State['hl'] } },
  ]
}
export function setGround(w: World, g: GroundKind) {
  if (w.sim.ground === g) return
  w.sim.ground = g
  w.ground.setGround(g)
  sfx('whoosh', { d: 0.8, v: 0.2 })
}

/** the shared per frame work */
function common(w: World, v: View) {
  if (!v.auto && (v.pointer.dx || v.pointer.dy || v.pointer.wheel)) w.rig.orbit(v.pointer.dx, v.pointer.dy, v.pointer.wheel)
}

/** what the camera sees through when someone grabs it: keep their framing */
function baseStats(w: World): Stat[] {
  const s = w.sim
  return [
    { k: 'Advance', v: s.phase === 'bore' ? s.rate.toFixed(0) : '0', u: 'mm/min', c: 'warm' },
    { k: 'Thrust', v: s.thrust.toFixed(0), u: 'MN' },
    { k: 'Face', v: s.pressure.toFixed(2), u: 'bar', c: s.faceState === 'balanced' || s.faceState === 'self supporting' ? 'ok' : 'bad' },
  ]
}

interface Spec {
  id: string; tab: string; kicker: string; length: number; mood: string; dof: number
  keys: Key[]
  enter?: () => void
  script?: (u: number, t: number) => void
  stats?: () => Stat[]
  text: () => string
  labels?: (v: View) => Label[]
  cursor?: (u: number) => Cursor | null
  fov?: number
}
function chapter(w: World, s: Spec): Chapter {
  return {
    id: s.id, tab: s.tab, kicker: s.kicker, length: s.length, mood: s.mood, dof: s.dof,
    enter() { s.enter?.(); w.rig.fov = s.fov ?? 34; w.rig.shot(s.keys, 0) },
    script(u, t) { w.rig.shot(s.keys, u); s.script?.(u, t) },
    update(v) { common(w, v) },
    stats: s.stats ?? (() => baseStats(w)),
    text: s.text,
    labels: s.labels ?? (() => []),
    cursor: s.cursor ?? (() => null),
  }
}

/* =====================================================================
   the tour
   ===================================================================== */

export function buildChapters(w: World): Chapter[] {
  const { sim, state } = w
  const L = (v: View) => (id: string, at: THREE.Vector3, text: string, sub: string, k: number, dot?: string) => label(w, v, id, at, text, sub, k, dot)

  const lab = chapter(w, {
    id: 'lab', tab: 'The machine', kicker: 'EPB shield · Ø 12.0 m · scale 1:30', length: 5.2, mood: 'lab', dof: 0.25,
    keys: [
      [0, [3.6, 2.15, 5.6], [0.0, 1.3, -0.5]],
      [0.55, [2.9, 1.85, 4.3], [0.05, 1.25, -0.4]],
      [1, [2.35, 1.65, 3.4], [0.15, 1.2, -0.3]],
    ],
    enter() {
      sim.reset(); sim.ground = 'clay'; w.ground.setGround('clay'); sim.rpm = 2.0; sim.speed = 90; sim.autoScrew = true; sim.screw = 1; sim.running = true
      state.cut = 0; state.hl = 'all'
      sfx('mood', { key: 'lab' })
    },
    text: () => 'A 12 metre tunnel boring machine under a street, cut open down its axis. It eats the ground at the front and leaves a finished concrete tunnel behind.',
    stats: () => [
      { k: 'Diameter', v: '12.0', u: 'm' },
      { k: 'Weight', v: '2,400', u: 't' },
      { k: 'Ring', v: fmtInt(sim.rings + 1), c: 'warm' },
    ],
    labels: v => {
      const l = L(v)
      return [
        l('head', mAt(w, 0.2, 6.6, 0.5), 'Cutterhead', `${sim.rpm.toFixed(1)} rpm`, ramp(0, 0, 1) * (1 - 0)),
        l('street', toWorld(-8, 21.5, -4), 'Street', '20 m above the axis', 1, '#9fd8ff'),
        l('backup', toWorld(sim.xf - 32, 5.2, -1), 'Backup train', '4 gantries', 1, '#9fd8ff'),
      ]
    },
  })

  const cut = chapter(w, {
    id: 'cut', tab: 'Cut in half', kicker: 'Section through the shield', length: 5.6, mood: 'cut', dof: 0.3,
    keys: [
      [0, [0.95, 1.36, 1.15], [0.5, 1.08, -0.08]],
      [0.6, [0.85, 1.3, 1.0], [0.5, 1.08, -0.08]],
      [1, [0.8, 1.27, 0.92], [0.52, 1.08, -0.08]],
    ],
    enter() { state.cut = 0; sim.speed = 60; sfx('mood', { key: 'cut' }) },
    script(u) {
      const k = ramp(u, 0.12, 0.62)
      if (k > 0.001 && state.cut < 0.002) sfx('laser', { d: 2.6 })
      state.cut = k
    },
    cursor: u => (u < 0.08 ? { id: 'cut', v: 0, press: false } : u < 0.66 ? { id: 'cut', v: ramp(u, 0.12, 0.62), press: true } : u < 0.75 ? { id: 'cut', v: 1, press: false } : null),
    text: () => 'Drag the section plane through it. Behind the cutterhead is a chamber packed with spoil at the pressure of the ground outside, then a steel bulkhead, then air for the crew.',
    stats: () => [
      { k: 'Chamber', v: sim.pressure.toFixed(2), u: 'bar', c: 'warm' },
      { k: 'Drive', v: '14 ×', u: '350 kW' },
      { k: 'Torque', v: sim.torque.toFixed(1), u: 'MNm' },
    ],
    labels: v => {
      const l = L(v), k = clamp(state.cut * 3 - 1.4, 0, 1)
      return [
        l('chamber', mAt(w, -0.9, -2.6, 0.02), 'Excavation chamber', `${sim.pressure.toFixed(1)} bar`, k, '#ffb347'),
        l('bulk', mAt(w, -1.8, 4.6, 0.02), 'Bulkhead', 'pressure wall', k, '#9fd8ff'),
        l('drive', mAt(w, -4.4, 4.1, 0.6), 'Main drive', '14 motors', k, '#9fd8ff'),
        l('lock', mAt(w, -4.2, 2.0, 1.6), 'Man lock', 'for the crew', k * 0.9, '#9fd8ff'),
      ]
    },
  })

  const face = chapter(w, {
    id: 'face', tab: 'The face', kicker: '64 disc cutters, 85 mm apart', length: 6.0, mood: 'face', dof: 0.5,
    keys: [
      [0, [1.1, 1.2, 0.5], [0.735, 1.087, 0.06]],
      [0.5, [1.0, 1.14, 0.44], [0.735, 1.087, 0.065]],
      [1, [0.95, 1.1, 0.4], [0.735, 1.087, 0.07]],
    ],
    enter() { state.cut = 0; sim.speed = 40; sim.rpm = 2.2; sfx('mood', { key: 'face' }) },
    script(u) {
      if (u > 0.36 && sim.ground !== 'granite') setGround(w, 'granite')
      sim.rpm = lerp(2.2, 2.8, ramp(u, 0.55, 0.85))
    },
    cursor: u => (u < 0.22 ? null : u < 0.4 ? { id: 'ground', v: 'granite', press: u > 0.33 && u < 0.38 } : u < 0.55 ? null : u < 0.88 ? { id: 'rpm', v: lerp(2.2, 2.8, ramp(u, 0.55, 0.85)) / 3, press: true } : null),
    text: () => sim.ground === 'granite'
      ? 'In granite each disc is pressed on with 25 tonnes and rolls a groove; the rock between two grooves cracks off in chips. A few millimetres a turn.'
      : 'In clay the discs barely matter: scrapers peel the ground off and it falls through the openings into the chamber.',
    stats: () => [
      { k: 'Ground', v: GROUNDS[sim.ground].name.split(' ')[0], c: 'warm' },
      { k: 'Per turn', v: sim.pen.toFixed(1), u: 'mm' },
      { k: 'Strength', v: GROUNDS[sim.ground].ucs.replace(' MPa', ''), u: sim.ground === 'sand' ? '' : 'MPa' },
    ],
    labels: v => {
      const l = L(v)
      return [
        l('disc', mAt(w, 0.15, 5.0, 2.6), '17 inch disc cutter', '250 kN', 1, '#ffb347'),
        l('scr', mAt(w, 0.05, -3.2, 0.5), 'Scrapers', 'carbide', 1, '#9fd8ff'),
      ]
    },
  })

  const muck = chapter(w, {
    id: 'muck', tab: 'The spoil', kicker: 'Chamber, screw, belt', length: 5.6, mood: 'muck', dof: 0.55,
    keys: [
      [0, [0.86, 1.02, 0.5], [0.62, 1.0, -0.03]],
      [0.5, [0.6, 1.1, 0.55], [0.3, 1.04, -0.04]],
      [1, [0.25, 1.2, 0.58], [-0.05, 1.12, -0.05]],
    ],
    enter() { state.cut = 1; state.hl = 'muck'; setGround(w, 'clay'); sim.rpm = 2.2; sim.speed = 60; sim.phase = 'bore'; sim.stroke = Math.min(sim.stroke, 0.6); sfx('mood', { key: 'muck' }) },
    script(u) { if (u > 0.92) state.hl = 'all' },
    text: () => `The screw conveyor is the valve: how fast it turns decides how much leaves the chamber. ${fmtInt(sim.inflow * 60 * 2)} tonnes of spoil an hour ride the belt out.`,
    stats: () => [
      { k: 'Spoil', v: (sim.inflow * 60 * 2).toFixed(0), u: 't/h', c: 'warm' },
      { k: 'Screw', v: sim.screwRpm.toFixed(1), u: 'rpm' },
      { k: 'Belt', v: '3.2', u: 'm/s' },
    ],
    labels: v => {
      const l = L(v)
      return [
        l('screw', mAt(w, -9, -2.6, -0.2), 'Screw conveyor', `${sim.screwRpm.toFixed(1)} rpm`, 1, '#ffb347'),
        l('belt', mAt(w, -30, 3.2, -0.4), 'Belt conveyor', 'to the surface', 1, '#ffb347'),
      ]
    },
  })

  const street = chapter(w, {
    id: 'street', tab: 'The street', kicker: 'Face pressure vs settlement', length: 7.0, mood: 'street', dof: 0.2,
    keys: [
      [0, [1.45, 2.75, 1.25], [0.5, 1.6, -0.35]],
      [0.5, [1.35, 2.62, 1.12], [0.52, 1.58, -0.35]],
      [1, [1.28, 2.52, 1.04], [0.54, 1.57, -0.35]],
    ],
    enter() { state.cut = 1; state.hl = 'all'; setGround(w, 'sand'); sim.speed = 160; sim.rpm = 2.2; sim.phase = 'bore'; sim.stroke = 0; sim.running = true; sim.autoScrew = false; sim.screw = 1; sfx('mood', { key: 'street' }) },
    script(u) {
      // too fast: the face loses ground and the street drops; then too slow: it heaves; then balanced
      const a = ramp(u, 0.08, 0.3), b = ramp(u, 0.5, 0.66), c = ramp(u, 0.8, 0.92)
      sim.screw = lerp(lerp(lerp(1, 1.9, a), 0.5, b), 1, c)
      if (u > 0.3 && u < 0.31) sfx('rumble', { d: 2.4, v: 0.7 })
    },
    cursor: u => (u < 0.05 ? null : u < 0.95 ? { id: 'screw', v: (sim.screw - 0.3) / 1.9, press: (u > 0.08 && u < 0.3) || (u > 0.5 && u < 0.66) || (u > 0.8 && u < 0.92) } : null),
    text: () => {
      const st = sim.faceState
      if (st === 'collapsing' || st === 'losing ground') return 'Screw too fast: spoil leaves faster than the face is cut, the pressure drops and the ground flows in. The street sinks.'
      if (st === 'heaving' || st === 'blowing out') return 'Screw too slow: the chamber over-pressurises and pushes the ground up. The street heaves.'
      return 'Balanced: the chamber pushes back exactly as hard as the ground and the water. The street barely notices.'
    },
    stats: () => [
      { k: 'Face', v: sim.pressure.toFixed(2), u: `/ ${sim.g.need.toFixed(1)} bar`, c: sim.faceState === 'balanced' ? 'ok' : 'bad' },
      { k: 'Street', v: (sim.smax).toFixed(0), u: 'mm', c: Math.abs(sim.smax) > 40 ? 'bad' : 'ok' },
      { k: 'Volume loss', v: sim.vl.toFixed(1), u: '%' },
    ],
    labels: v => {
      const l = L(v)
      const worst = w.ground.buildings.reduce((a, b) => (b.tilt > a.tilt ? b : a), w.ground.buildings[0])
      const dmg = worst.tilt > 1 / 300 ? 'severe' : worst.tilt > 1 / 500 ? 'cracking' : 'fine'
      return [
        l('trough', toWorld(sim.xf - 6, w.ground.topY(sim, sim.xf - 6, -1) + 1.5, -1), 'Street', `${sim.smax > 0 ? '+' : ''}${sim.smax.toFixed(0)} mm (drawn 20x)`, 1, Math.abs(sim.smax) > 40 ? '#ff6a50' : '#50ffaa'),
        l('house', toWorld(worst.x, w.ground.topY(sim, worst.x, worst.z) + 14, worst.z), 'Houses', dmg, 1, dmg === 'fine' ? '#50ffaa' : '#ff6a50'),
        l('cham', mAt(w, -0.9, -1.5, 0.02), 'Chamber', `${sim.pressure.toFixed(2)} bar`, 1, '#ffb347'),
      ]
    },
  })

  const ring = chapter(w, {
    id: 'ring', tab: 'Build a ring', kicker: '8 segments, 4 tonnes each', length: 7.0, mood: 'ring', dof: 0.35,
    keys: [
      [0, [0.62, 1.36, 0.72], [0.38, 1.1, -0.1]],
      [0.5, [0.56, 1.33, 0.67], [0.38, 1.1, -0.1]],
      [1, [0.52, 1.31, 0.63], [0.38, 1.1, -0.1]],
    ],
    enter() {
      state.cut = 1; state.hl = 'all'; setGround(w, 'clay'); sim.autoScrew = true; sim.screw = 1
      sim.phase = 'ring'; sim.stroke = 2; sim.build = 0; sim.speed = 300; sim.running = true
      sfx('mood', { key: 'ring' })
    },
    script(u) { if (u > 0.95) state.hl = 'all' },
    text: () => 'The machine stops. The erector lifts each segment, turns it into place and the thrust cylinders behind it let go and push again. Key last.',
    stats: () => [
      { k: 'Segment', v: sim.phase === 'ring' ? `${Math.min(8, Math.floor(sim.build) + 1)}` : '8', u: '/ 8', c: 'warm' },
      { k: 'Ring', v: fmtInt(sim.rings + (sim.phase === 'ring' ? 1 : 0)) },
      { k: 'Width', v: '2.0', u: 'm' },
    ],
    labels: v => {
      const l = L(v)
      return [
        l('erector', mAt(w, -10, 3.6, 1.0), 'Erector', sim.phase === 'ring' ? 'placing' : 'parked', 1, '#7cf0c0'),
        l('thrust', mAt(w, -6.4, -5.0, 1.6), 'Thrust cylinders', '32 × 3.75 MN', 1, '#ffb347'),
        l('tail', mAt(w, -12.6, 5.6, 0.2), 'Tail seal', '3 brush rows', 1, '#9fd8ff'),
      ]
    },
  })

  const advance = chapter(w, {
    id: 'advance', tab: 'A day', kicker: 'Bore, build, repeat', length: 5.4, mood: 'advance', dof: 0.2,
    keys: [
      [0, [0.9, 1.32, 1.05], [0.2, 1.12, -0.2]],
      [0.6, [1.9, 1.75, 2.6], [0.0, 1.2, -0.3]],
      [1, [2.5, 2.0, 3.4], [-0.05, 1.25, -0.35]],
    ],
    enter() {
      state.hl = 'all'; sim.autoScrew = true; sim.screw = 1; setGround(w, 'clay'); sim.rpm = 2.2
      sim.speed = 300; if (sim.phase === 'ring') { sim.phase = 'bore'; sim.stroke = 0; sim.build = 0; sim.rings++ }
      sfx('mood', { key: 'advance' })
    },
    script(u) {
      sim.speed = lerp(300, 2600, ramp(u, 0.0, 0.25))
      state.cut = 1 - ramp(u, 0.55, 0.95)
    },
    cursor: u => (u < 0.3 ? { id: 'time', v: speedToSlider(sim.speed), press: u > 0.02 && u < 0.26 } : null),
    text: () => `Two metres, a ring, two metres, a ring. About ${sim.perDay.toFixed(0)} metres of finished tunnel a day, around the clock.`,
    stats: () => [
      { k: 'Per day', v: sim.perDay.toFixed(0), u: 'm', c: 'warm' },
      { k: 'Rings', v: fmtInt(sim.rings) },
      { k: 'Spoil', v: fmtInt(sim.spoil), u: 't' },
    ],
  })

  return [lab, cut, face, muck, street, ring, advance]
}

/** visual state that follows the knobs: cut plane, highlights */
export function applyState(w: World, dt: number) {
  const { state } = w
  // the plane starts just past the machine and ends on its axis
  const z = lerp(0.24, 0.0, ease(state.cut))
  CUT_M.z.value = state.cut <= 0.0005 ? 50 : z
  CUT_M.glow.value = state.cut > 0.002 && state.cut < 0.998 ? 1 : Math.max(0, CUT_M.glow.value - dt * 3)
  for (const k of ['muck', 'thrust', 'ring'] as const) {
    const on = state.hl === k ? 1 : 0
    HL[k].value += (on - HL[k].value) * Math.min(1, dt * 5)
  }
  w.tun.freshU.value = HL.ring.value
  void TBM
}
