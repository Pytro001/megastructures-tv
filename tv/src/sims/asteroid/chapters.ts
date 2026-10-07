import * as THREE from 'three'
import { impact, fmtE, fmtLen, MARKS, type Kind, type Impact } from './sim'
import { toWorld } from './lab'
import { sfx } from './sfx'

export interface Stat { k: string; v: string; u?: string; c?: string }
export interface Label { id: string; text: string; sub?: string; x: number; y: number; vis: number; dot?: string }
export type Control =
  | { kind: 'seg'; id: string; label: string; options: [string, string][]; get: () => string; set: (v: string) => void }
  | { kind: 'slider'; id: string; label: string; min: number; max: number; step: number; get: () => number; set: (v: number) => void; fmt: (v: number) => string }
  | { kind: 'button'; id: string; label: string; text: string; run: () => void }
export interface View { w: number; h: number; t: number; dt: number; auto: boolean; pointer: { dx: number; dy: number; wheel: number; down: boolean } }
export interface Cursor { id: string; v?: number | string; press: boolean }
export interface Chapter {
  id: string; tab: string; kicker: string; length: number; mood: string; dof: number
  enter(): void
  script(u: number, t: number): void
  update(v: View): void
  stats(): Stat[]
  text(): string
  labels(v: View): Label[]
  cursor(u: number): Cursor | null
}

/** everything the visitor can change, and the event it makes */
export class State {
  L = 1000
  kind: Kind = 'stone'
  v = 20
  angle = 45
  /** where it lands */
  target: 'sea' | 'city' = 'sea'
  /** water depth at the impact point, m (set by the page from the map) */
  water = 3600
  /** seconds after contact */
  t = -30
  playing = true
  cut = 0
  shock = 0
  /** the tsunami's run-up at the city, m, and its arrival, s (set by the page) */
  runup = 0
  arrival = -1
  im: Impact = impact(1000, 'stone', 20, 45, 3600)
  private key = ''
  changed = false
  refresh() {
    const k = `${this.L.toFixed(2)}|${this.kind}|${this.v}|${this.angle}|${this.target}|${this.water.toFixed(0)}`
    this.changed = k !== this.key
    if (this.changed) { this.key = k; this.im = impact(this.L, this.kind, this.v, this.angle, this.target === 'sea' ? this.water : 0) }
    return this.im
  }
  drop() { this.t = -3; this.playing = true }
}

export interface World { st: State; cam: THREE.PerspectiveCamera; rig: Rig; craterRim: () => number; impW: () => THREE.Vector3; cityW: () => THREE.Vector3 }

const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp
const ease = (x: number) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const ramp = (u: number, a: number, b: number) => ease((u - a) / (b - a))
/** a time that runs slowly at first and then faster: from a to b over u in [0, 1] */
const logT = (u: number, a: number, b: number) => -4 + Math.exp(Math.log(a + 4) + (Math.log(b + 4) - Math.log(a + 4)) * clamp(u, 0, 1))

type Key = [number, [number, number, number], [number, number, number]]
export class Rig {
  readonly pos = new THREE.Vector3(3.4, 2.2, 4.6)
  readonly tgt = new THREE.Vector3(0, 1.1, 0)
  fov = 34
  private cache = new Map<Key[], { sig: string; p: THREE.CatmullRomCurve3; t: THREE.CatmullRomCurve3 }>()
  shot(keys: Key[], u: number) {
    if (keys.length < 2) return
    const sig = JSON.stringify(keys)
    let c = this.cache.get(keys)
    if (!c || c.sig !== sig) { c = { sig, p: new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k[1])), false, 'centripetal'), t: new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k[2])), false, 'centripetal') }; this.cache.set(keys, c) }
    let i = 0
    while (i < keys.length - 2 && u > keys[i + 1][0]) i++
    const f = clamp((u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), 0, 1)
    const s = clamp((i + f) / (keys.length - 1), 0, 1)
    c.p.getPoint(s, this.pos); c.t.getPoint(s, this.tgt)
  }
  orbit(dx: number, dy: number, wheel: number) {
    const off = this.pos.clone().sub(this.tgt)
    const sph = new THREE.Spherical().setFromVector3(off)
    sph.theta -= dx * 0.005
    sph.phi = clamp(sph.phi - dy * 0.005, 0.05, Math.PI * 0.6)
    sph.radius = clamp(sph.radius * Math.exp(wheel * 0.001), 0.15, 9)
    this.pos.copy(this.tgt).add(off.setFromSpherical(sph))
    if (this.pos.y < 0.4) this.pos.y = 0.4
  }
  apply(cam: THREE.PerspectiveCamera) {
    cam.position.copy(this.pos); cam.lookAt(this.tgt)
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix() }
  }
}

function project(w: World, v: View, p: THREE.Vector3) {
  const q = p.clone().project(w.cam)
  const vis = q.z < 1 && Math.abs(q.x) < 1.05 && Math.abs(q.y) < 1.05 ? 1 : 0
  return { x: (q.x * 0.5 + 0.5) * v.w, y: (-q.y * 0.5 + 0.5) * v.h, vis }
}
const lab = (w: World, v: View) => (id: string, at: THREE.Vector3, text: string, sub: string, k: number, dot = '#ff9a4a'): Label => {
  const s = project(w, v, at); return { id, text, sub, x: s.x, y: s.y, vis: s.vis * clamp(k, 0, 1), dot }
}

/* the size slider is logarithmic from 10 m to 15 km */
export const sizeToU = (L: number) => Math.log(L / 10) / Math.log(1500)
export const uToSize = (u: number) => 10 * Math.pow(1500, u)
/* the time slider: -3 s to 30 min, logarithmic after contact */
export const timeToU = (t: number) => Math.log(clamp(t, -3, 1800) + 4) / Math.log(1804)
export const uToTime = (u: number) => Math.pow(1804, u) - 4

export function fmtT(t: number) {
  if (t < 0) return `T${t.toFixed(1)} s`
  if (t < 60) return `T+${t.toFixed(t < 10 ? 2 : 1)} s`
  return `T+${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
}
const mark = (L: number, kind?: Kind) => { let best = ''; let d = 0.1; for (const m of MARKS) { if (kind && m.kind !== kind) continue; const dd = Math.abs(Math.log10(m.L / L)); if (dd < d) { d = dd; best = m.name } } return best }

export function controls(w: World): Control[] {
  const s = w.st
  return [
    { kind: 'slider', id: 'size', label: 'Asteroid size', min: 0, max: 1, step: 0.001, get: () => sizeToU(s.L), set: v => { s.L = uToSize(v) }, fmt: () => `${fmtLen(s.L)}${mark(s.L, s.kind) ? ` · ${mark(s.L, s.kind)}` : ''}` },
    { kind: 'seg', id: 'target', label: 'Lands in', options: [['sea', 'The ocean'], ['city', 'The city']], get: () => s.target, set: v => { s.target = v as 'sea' | 'city'; s.drop() } },
    { kind: 'seg', id: 'kind', label: 'Made of', options: [['stone', 'Stone'], ['iron', 'Iron'], ['ice', 'Ice']], get: () => s.kind, set: v => { s.kind = v as Kind } },
    { kind: 'slider', id: 'speed', label: 'Speed', min: 11, max: 72, step: 0.5, get: () => s.v, set: v => { s.v = v }, fmt: v => `${v.toFixed(0)} km/s` },
    { kind: 'slider', id: 'angle', label: 'Angle', min: 15, max: 90, step: 1, get: () => s.angle, set: v => { s.angle = v }, fmt: v => `${v.toFixed(0)}°` },
    { kind: 'slider', id: 'time', label: 'Time', min: 0, max: 1, step: 0.0005, get: () => timeToU(s.t), set: v => { s.t = uToTime(v); s.playing = false }, fmt: () => fmtT(s.t) },
    { kind: 'slider', id: 'cut', label: 'Cut in half', min: 0, max: 1, step: 0.001, get: () => s.cut, set: v => { s.cut = v }, fmt: v => (v < 0.01 ? 'whole' : v > 0.99 ? 'half' : `${Math.round(v * 100)}%`) },
    { kind: 'button', id: 'drop', label: '', text: 'Drop it again', run: () => { s.drop(); sfx('whoosh', { d: 0.8, v: 0.25 }) } },
  ]
}

interface Spec {
  id: string; tab: string; kicker: string; length: number; mood: string; dof: number; keys: Key[]; fov?: number
  enter?: () => void; script?: (u: number) => void; text: () => string; stats?: () => Stat[]; labels?: (v: View) => Label[]; cursor?: (u: number) => Cursor | null
}
function chapter(w: World, s: Spec): Chapter {
  return {
    id: s.id, tab: s.tab, kicker: s.kicker, length: s.length, mood: s.mood, dof: s.dof,
    enter() { s.enter?.(); w.rig.fov = s.fov ?? 34; w.rig.shot(s.keys, 0) },
    script(u) { w.rig.shot(s.keys, u); s.script?.(u) },
    update(v) { if (!v.auto && (v.pointer.dx || v.pointer.dy || v.pointer.wheel)) w.rig.orbit(v.pointer.dx, v.pointer.dy, v.pointer.wheel) },
    stats: s.stats ?? (() => baseStats(w)),
    text: s.text,
    labels: s.labels ?? (() => []),
    cursor: s.cursor ?? (() => null),
  }
}
function baseStats(w: World): Stat[] {
  const im = w.st.im
  return [
    { k: 'Energy', v: fmtE(im.e).split(' ')[0], u: fmtE(im.e).split(' ').slice(1).join(' '), c: 'warm' },
    { k: im.airburst ? 'Burst at' : 'Crater', v: im.airburst ? fmtLen(im.zBurst).split(' ')[0] : fmtLen(im.dfr).split(' ')[0], u: (im.airburst ? fmtLen(im.zBurst) : fmtLen(im.dfr)).split(' ')[1] },
    { k: 'Time', v: fmtT(w.st.t) },
  ]
}

export function buildChapters(w: World): Chapter[] {
  const s = w.st
  const set = (L: number, kind: Kind, v: number, a: number, target: 'sea' | 'city' = 'sea') => { s.L = L; s.kind = kind; s.v = v; s.angle = a; s.target = target; s.refresh() }
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  // shots around the impact point and the city, in world metres
  const near = (o: THREE.Vector3, dx: number, dy: number, dz: number): [number, number, number] => [o.x + dx, o.y + dy, o.z + dz]
  const I = () => w.impW(), C = () => w.cityW()
  const dyn = (f: () => Key[]) => { let k: Key[] | null = null; return () => (k ??= f()) }
  const minutes = (t: number) => (t < 90 ? `${Math.round(t)} s` : `${(t / 60).toFixed(1)} min`)

  const table = chapter(w, {
    id: 'table', tab: 'The table', kicker: '120 km of coast · 1:60,000 · heights ×3', length: 4.6, mood: 'lab', dof: 0.15,
    keys: [[0, [4.2, 2.6, 5.4], [0, 1.05, 0]], [0.6, [3.4, 2.2, 4.3], [0, 1.05, 0]], [1, [2.8, 1.95, 3.5], [-0.1, 1.05, -0.05]]],
    enter() { set(1000, 'stone', 20, 45); s.cut = 0; s.shock = 0; s.playing = false; s.t = -8 },
    script(u) { s.t = lerp(-8, -3.2, u) },
    text: () => 'An ocean, a continental shelf, a port city of a million people, the hills behind it. A hundred and twenty kilometres of it on a table. Something is coming.',
    stats: () => [{ k: 'Sea', v: '3.6', u: 'km deep' }, { k: 'Table', v: '120', u: 'km' }, { k: 'Scale', v: '1:60k' }],
    labels: v => { const l = lab(w, v); return [l('city', C().clone().add(V(0, 0.03, 0)), 'City', '1 million people', 1, '#ffd0a0'), l('sea', I().clone().setY(1.03), 'Open ocean', '3.6 km deep', 1, '#7fd8ff')] },
  })

  let entryKeys: Key[] = []
  const entry = chapter(w, {
    id: 'entry', tab: 'Entry', kicker: '20 km/s · 45° · from space to the sea in seconds', length: 5.2, mood: 'entry', dof: 0.3,
    keys: entryKeys,
    enter() {
      set(1000, 'stone', 20, 45); s.cut = 0; s.playing = false; s.t = -3.2; sfx('roar', { d: 3.4, v: 0.6 })
      const i = I()
      entryKeys.length = 0
      entryKeys.push([0, near(i, 1.3, 0.35, 1.2), near(i, -0.4, 0.55, -0.3)], [0.7, near(i, 1.1, 0.28, 0.95), near(i, -0.15, 0.25, -0.1)], [1, near(i, 1.0, 0.25, 0.9), near(i, 0, 0.06, 0)])
    },
    script(u) { s.t = lerp(-3.2, -0.02, Math.pow(u, 0.85)) },
    text: () => `A ${fmtLen(s.L)} rock at ${s.v} km/s. The air in front of it cannot get out of the way: squeezed, it glows hotter than the surface of the Sun.`,
    stats: () => [{ k: 'Size', v: fmtLen(s.L).split(' ')[0], u: fmtLen(s.L).split(' ')[1], c: 'warm' }, { k: 'Speed', v: String(s.v), u: 'km/s' }, { k: 'Altitude', v: Math.max(0, -s.t * s.v * Math.sin(s.angle * Math.PI / 180)).toFixed(0), u: 'km' }],
  })

  let contactKeys: Key[] = []
  const contact = chapter(w, {
    id: 'contact', tab: 'Contact', kicker: 'The first seconds, cut open', length: 5.6, mood: 'contact', dof: 0.35,
    keys: contactKeys,
    enter() {
      set(1000, 'stone', 20, 45); s.playing = false; s.t = -0.02; s.cut = 0; s.shock = 1
      const i = I()
      contactKeys.length = 0
      contactKeys.push([0, near(i, 0.25, 0.1, 0.75), near(i, 0, -0.03, 0)], [0.5, near(i, 0.18, 0.08, 0.6), near(i, 0, -0.04, 0)], [1, near(i, 0.14, 0.06, 0.52), near(i, 0, -0.05, 0)])
    },
    script(u) {
      s.cut = ramp(u, 0.0, 0.22)
      const prev = s.t
      s.t = u < 0.25 ? -0.02 : logT((u - 0.25) / 0.75, 0, 6)
      if (prev <= 0 && s.t > 0) { sfx('boom', { v: 1 }); sfx('sonic', { v: 0.5 }) }
    },
    cursor: u => (u < 0.24 ? { id: 'cut', v: ramp(u, 0.0, 0.22), press: u > 0.02 } : null),
    text: () => `It goes through ${(s.water / 1000).toFixed(1)} km of sea in a fraction of a second, still at ${s.im.vSeafloor.toFixed(0)} km/s when it hits the floor. The water around it turns to steam; a shock runs into the rock.`,
    stats: () => [{ k: 'Sea', v: (s.water / 1000).toFixed(1), u: 'km', c: 'warm' }, { k: 'At the floor', v: s.im.vSeafloor.toFixed(1), u: 'km/s' }, { k: 'Time', v: fmtT(s.t) }],
  })

  let cavKeys: Key[] = []
  const cavity = chapter(w, {
    id: 'cavity', tab: 'The cavity', kicker: 'A hole in the ocean', length: 6, mood: 'dig', dof: 0.25,
    keys: cavKeys,
    enter() {
      set(1000, 'stone', 20, 45); s.playing = false; s.cut = 1; s.shock = 0; if (s.t < 6) s.t = 6
      const i = I()
      cavKeys.length = 0
      cavKeys.push([0, near(i, 0.3, 0.28, 0.75), near(i, 0, 0.0, 0)], [0.6, near(i, 0.45, 0.4, 0.85), near(i, 0.05, 0.02, 0)], [1, near(i, 0.6, 0.5, 0.9), near(i, 0.1, 0.03, 0)])
    },
    script(u) { const p = s.t; s.t = logT(u, 6, 160); if (p < 9 && s.t >= 9) sfx('debris', { d: 4, v: 0.12 }) },
    cursor: u => (u > 0.15 && u < 0.85 ? { id: 'time', v: timeToU(s.t), press: true } : null),
    text: () => `The blast opens a hole in the sea ${fmtLen(s.im.dtcw)} wide, down to the floor. Water rushes back in from all sides and the rim of that hole becomes a wave ${fmtLen(s.im.arw)} high.`,
    stats: () => [{ k: 'Cavity', v: fmtLen(s.im.dtcw).split(' ')[0], u: fmtLen(s.im.dtcw).split(' ')[1], c: 'warm' }, { k: 'Rim wave', v: fmtLen(s.im.arw).split(' ')[0], u: fmtLen(s.im.arw).split(' ')[1] }, { k: 'Time', v: fmtT(s.t) }],
  })

  const wave = chapter(w, {
    id: 'wave', tab: 'Tsunami', kicker: 'Slower and taller over the shelf', length: 6.4, mood: 'collapse', dof: 0.15,
    keys: [[0, [1.6, 1.6, 1.5], [0.05, 1.0, 0]], [0.6, [1.5, 1.45, 1.1], [0.15, 1.0, 0]], [1, [1.3, 1.3, 0.8], [0.25, 1.0, 0.02]]],
    enter() { set(1000, 'stone', 20, 45); s.playing = false; s.cut = 0; if (s.t < 160) s.t = 160 },
    script(u) { const end = s.arrival > 0 ? s.arrival - 25 : 500; s.t = lerp(160, end, u) },
    text: () => `In deep water it races at ${Math.round(Math.sqrt(9.81 * s.water) * 3.6)} km/h and you would barely feel it pass. On the shelf it slows to a crawl and stacks up. ${s.arrival > 0 ? `It reaches the city ${minutes(s.arrival)} after impact.` : ''}`,
    stats: () => [{ k: 'Deep speed', v: String(Math.round(Math.sqrt(9.81 * s.water) * 3.6)), u: 'km/h', c: 'warm' }, { k: 'At the city', v: s.arrival > 0 ? minutes(s.arrival) : 'n/a' }, { k: 'Time', v: fmtT(s.t) }],
    labels: v => { const l = lab(w, v); return [l('coast', C().clone().add(V(-0.08, 0.02, 0.12)), 'Coast', 'shelf 130 m deep', 1, '#7fd8ff')] },
  })

  const flood = chapter(w, {
    id: 'flood', tab: 'The city', kicker: 'Run-up and inundation', length: 6.4, mood: 'city', dof: 0.25,
    keys: [[0, [0.85, 1.22, 0.55], [0.38, 1.0, 0.04]], [0.6, [0.72, 1.18, 0.42], [0.38, 1.0, 0.04]], [1, [0.64, 1.15, 0.36], [0.4, 1.0, 0.04]]],
    enter() { set(1000, 'stone', 20, 45); s.playing = false; s.cut = 0; const a = s.arrival > 0 ? s.arrival : 500; s.t = a - 25 },
    script(u) { const a = s.arrival > 0 ? s.arrival : 500; const p = s.t; s.t = lerp(a - 25, a + 260, u); if (p < a && s.t >= a) sfx('wind', { d: 5, v: 0.5 }) },
    text: () => s.runup > 0 ? `The wave runs up ${fmtLen(s.runup)} above sea level into the streets. Everything under that line is gone; the water reaches kilometres inland before it drains back out.` : 'The wave never reaches the city.',
    stats: () => [{ k: 'Run-up', v: fmtLen(s.runup).split(' ')[0], u: fmtLen(s.runup).split(' ')[1], c: 'bad' }, { k: 'Arrives', v: s.arrival > 0 ? minutes(s.arrival) : 'n/a' }, { k: 'Time', v: fmtT(s.t) }],
  })

  const sizes = chapter(w, {
    id: 'sizes', tab: 'Bigger', kicker: 'From a house to Chicxulub', length: 7, mood: 'sizes', dof: 0.12,
    keys: [[0, [2.4, 2.4, 3.0], [0, 1.05, 0]], [0.6, [3.0, 2.7, 3.8], [0, 1.1, 0]], [1, [3.6, 3.0, 4.6], [0, 1.2, 0]]],
    enter() { set(60, 'stone', 18, 40); s.cut = 0; s.playing = false; s.t = 700 },
    script(u) {
      s.L = uToSize(lerp(sizeToU(60), sizeToU(5000), ramp(u, 0.08, 0.82)))
      s.angle = Math.round(lerp(40, 45, ramp(u, 0.08, 0.3)))
      s.t = s.arrival > 0 ? s.arrival + 90 : 700
    },
    cursor: u => (u > 0.04 && u < 0.84 ? { id: 'size', v: sizeToU(s.L), press: u > 0.08 } : null),
    text: () => s.im.airburst
      ? `At ${fmtLen(s.L)} it bursts ${fmtLen(s.im.zBurst)} up and never reaches the sea.`
      : `A ${fmtLen(s.L)} rock: a wave ${fmtLen(s.runup)} high at the city.${s.im.dfr > 0 ? ` A crater ${fmtLen(s.im.dfr)} wide on the sea floor.` : ''}`,
    stats: () => [{ k: 'Size', v: fmtLen(s.L).split(' ')[0], u: fmtLen(s.L).split(' ')[1], c: 'warm' }, { k: 'Run-up', v: fmtLen(s.runup).split(' ')[0], u: fmtLen(s.runup).split(' ')[1] }, { k: 'Energy', v: fmtE(s.im.e).split(' ')[0], u: fmtE(s.im.e).split(' ').slice(1).join(' ') }],
  })
  void dyn
  return [table, entry, contact, cavity, wave, flood, sizes]
}

/** the air blast front: Sedov-Taylor strong shock, then sound speed; returns ground range, m */
export function blastR(s: State) {
  const t = Math.max(0, s.t)
  const E = s.im.e * 4.184e15
  const sedov = 1.03 * Math.pow(E / 1.2, 0.2) * Math.pow(t, 0.4)
  const R = Math.max(Math.min(sedov, 340 * t + 3000), 340 * t * 0.9)
  const zb = s.im.zBurst
  return R > zb ? Math.sqrt(R * R - zb * zb) : 0
}
/** overpressure at the front right now, psi (Collins' surface curve) */
export function blastP(s: State) {
  const r = blastR(s), ekt = s.im.e * 1000
  const r1 = Math.hypot(r, s.im.zBurst) / Math.cbrt(Math.max(ekt, 1e-6))
  return ((75000 * 290) / (4 * r1) * (1 + 3 * Math.pow(290 / r1, 1.3))) / 6894.76
}
