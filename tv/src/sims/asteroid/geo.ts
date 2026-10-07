import * as THREE from 'three'

/**
 * The 120 x 120 km block: a deep ocean basin in the west, a continental shelf,
 * a coast with a bay and a port city, a coastal plain, hills and a mountain
 * ridge in the east. Heights are real metres (sea level 0); the scene draws
 * them three times taller so the relief reads on a 2 m model.
 *
 * One height function bakes a texture for the shaders and a grid for the CPU,
 * so the water, the ground, the houses and the tsunami all agree.
 */

export const HALF = 60000
export const VEX = 3
/** where the city is, and the two places the rock can land */
export const CITY = new THREE.Vector2(19500, 2500)
export const SEA = new THREE.Vector2(-14000, -4000)

const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export const fbm = (x: number, y: number, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1); f *= 2.03; a *= 0.5 } return s }
const ridge = (x: number, y: number) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { const n = 1 - Math.abs(vnoise(x * f + 3.3 * i, y * f) * 2 - 1); s += a * n * n; f *= 2.1; a *= 0.5 } return s }

/** x of the shoreline at a given z */
export const coastX = (z: number) => 17000 + 5200 * Math.sin(z / 15000 + 0.4) + 2000 * Math.sin(z / 4300 + 2) + 900 * (fbm(z * 0.0004, 3) - 0.5) - 5200 * Math.exp(-(((z - CITY.y) / 4800) ** 2))
/** the river from the hills to the bay */
export const riverZ = (x: number) => CITY.y + 1400 * Math.sin((x - CITY.x) / 3500) + 3500 * Math.sin((x - CITY.x) / 11000)

/** height of the ground or the sea floor, real metres */
export function heightAt(x: number, z: number) {
  const d = x - coastX(z) // inland distance (negative at sea)
  let h: number
  if (d < 0) {
    const off = -d
    const shelf = -Math.min(1, off / 9000) * 130
    const slope = THREE.MathUtils.smoothstep(off, 9000, 21000)
    h = shelf * (1 - slope) - 3600 * slope
    h += slope * (-350 * (fbm(x * 0.00008, z * 0.00008) - 0.5) + 900 * Math.max(0, ridge(x * 0.00005 + 4, z * 0.00005) - 0.62) * 4)
    h += (1 - slope) * 25 * (fbm(x * 0.0006, z * 0.0006) - 0.5)
    // the beach ramps up to the shore
    h = Math.min(h, -off * 0.02)
  } else {
    h = 3 + d * 0.0035 + 30 * fbm(x * 0.0005, z * 0.0005)
    h += 650 * fbm(x * 0.00012 + 2, z * 0.00012) * THREE.MathUtils.smoothstep(d, 7000, 22000)
    h += 2300 * ridge(x * 0.00006, z * 0.00009 + 1) * THREE.MathUtils.smoothstep(d, 18000, 34000)
    // the river valley
    const rv = Math.abs(z - riverZ(x))
    h -= Math.max(0, h - 2) * Math.exp(-((rv / (600 + d * 0.03)) ** 2)) * 0.85
    // the city sits on a flat coastal plain
    const c = Math.hypot(x - CITY.x, z - CITY.y)
    h = THREE.MathUtils.lerp(h, 6 + d * 0.002, Math.exp(-((c / 6000) ** 2)))
  }
  return h
}

/** a baked height grid with a bilinear sampler, and a float texture of it for the shaders */
export class Heights {
  readonly N = 512
  readonly data: Float32Array
  readonly tex: THREE.DataTexture
  constructor() {
    const N = this.N
    this.data = new Float32Array(N * N)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 * HALF - HALF, z = (j / (N - 1)) * 2 * HALF - HALF
      this.data[j * N + i] = heightAt(x, z)
    }
    this.tex = new THREE.DataTexture(this.data, N, N, THREE.RedFormat, THREE.FloatType)
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping
    this.tex.needsUpdate = true
  }
  at(x: number, z: number) {
    const N = this.N
    const fx = THREE.MathUtils.clamp(((x + HALF) / (2 * HALF)) * (N - 1), 0, N - 1.001), fz = THREE.MathUtils.clamp(((z + HALF) / (2 * HALF)) * (N - 1), 0, N - 1.001)
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
    const d = this.data
    return (d[j * N + i] * (1 - u) + d[j * N + i + 1] * u) * (1 - v) + (d[(j + 1) * N + i] * (1 - u) + d[(j + 1) * N + i + 1] * u) * v
  }
}

/**
 * The tsunami field for an impact at (ix, iz): arrival time and wave height.
 * At sea: a shortest travel time pass with the shallow water speed sqrt(g h),
 * the amplitude falling as 1/r from the rim wave (Collins et al. 2005 eq 51-53)
 * and growing as (h0/h)^1/4 over the shelf (Green's law), capped so it
 * cannot exceed what can stand in that depth. At the coast it runs up about
 * twice its offshore height (capped at 600 m) and floods inland, losing
 * height over a distance of about 70 run-ups.
 * Texture: r = arrival time (s, -1 = never), g = wave height or flood level (m), b = 1 on land.
 */
export class Tsunami {
  readonly N = 256
  readonly field: Float32Array
  readonly tex: THREE.DataTexture
  /** the run-up where the wave reaches the city, m, and when */
  cityRunup = 0
  cityArrival = -1
  /** speed of the wave at the impact, m/s */
  c0 = 200
  constructor(private h: Heights) {
    this.field = new Float32Array(this.N * this.N * 4)
    this.tex = new THREE.DataTexture(this.field, this.N, this.N, THREE.RGBAFormat, THREE.FloatType)
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter
    this.tex.needsUpdate = true
  }
  solve(ix: number, iz: number, arw: number, rrw: number, opt: { lineX?: number; wall?: number; inland?: number } = {}) {
    const N = this.N, F = this.field
    const cell = (2 * HALF) / (N - 1)
    const H = new Float32Array(N * N)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = this.h.at((i / (N - 1)) * 2 * HALF - HALF, (j / (N - 1)) * 2 * HALF - HALF)
    const T = new Float32Array(N * N).fill(Infinity)
    const R = new Float32Array(N * N) // straight distance carried along the path
    const D0 = Math.max(50, -this.h.at(ix, iz))
    this.c0 = Math.sqrt(9.81 * D0)
    const si = Math.round(((ix + HALF) / (2 * HALF)) * (N - 1)), sj = Math.round(((iz + HALF) / (2 * HALF)) * (N - 1))
    // binary heap Dijkstra over sea cells
    const heap: number[] = [], key = new Float32Array(N * N)
    const push = (k: number, t: number) => { key[k] = t; heap.push(k); let n = heap.length - 1; while (n > 0) { const p = (n - 1) >> 1; if (key[heap[p]] <= key[heap[n]]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p } }
    const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < heap.length && key[heap[l]] < key[heap[m]]) m = l; if (r < heap.length && key[heap[r]] < key[heap[m]]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m } } return top }
    const s0 = sj * N + si
    if (opt.lineX === undefined) { T[s0] = 0; push(s0, 0) }
    else {
      // a line source: every sea cell along the trench starts at once (a plane wave, no spreading)
      const li = Math.round(((opt.lineX + HALF) / (2 * HALF)) * (N - 1))
      for (let j = 0; j < N; j++) { const k = j * N + li; if (H[k] < 0) { T[k] = 0; R[k] = 0; push(k, 0) } }
    }
    const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
    while (heap.length) {
      const k = pop()
      const t = T[k]
      if (key[k] > t + 1e-6) continue
      const i = k % N, j = (k / N) | 0
      if (H[k] >= 0 && (k !== s0 || opt.lineX !== undefined)) continue // coast: stop at sea level, land handled below
      for (const [di, dj, w] of nb) {
        const a = i + di, b = j + dj
        if (a < 0 || b < 0 || a >= N || b >= N) continue
        const q = b * N + a
        const depth = Math.max(15, -H[q])
        const c = H[q] >= 0 ? Math.sqrt(9.81 * 15) : Math.sqrt(9.81 * depth)
        const nt = t + (w * cell) / c
        if (nt < T[q]) { T[q] = nt; R[q] = Math.hypot((a - si) * cell, (b - sj) * cell); push(q, nt) }
      }
    }
    // amplitude at sea, and the run-up where it reaches land
    const A = new Float32Array(N * N)
    const coastR = new Float32Array(N * N)
    for (let k = 0; k < N * N; k++) {
      if (!isFinite(T[k])) continue
      const r = Math.max(R[k], rrw * 0.5)
      const deep = opt.lineX !== undefined ? arw : arw * Math.min(1, rrw / r)
      if (H[k] < 0) {
        const depth = Math.max(10, -H[k])
        A[k] = Math.min(deep * Math.pow(D0 / depth, 0.25), Math.max(deep, depth * 0.8 + deep * 0.3))
      } else {
        let run = opt.lineX !== undefined ? 1.9 * deep * Math.pow(D0 / 10, 0.25) : 2 * deep * Math.pow(D0 / 200, 0.12)
        run = Math.min(600, run)
        if (opt.wall !== undefined && run <= opt.wall) run = 0 // the sea wall holds
        coastR[k] = run
      }
    }
    // inland: spread from the coast cells while the water is higher than the ground
    const L = new Float32Array(N * N).fill(-1) // flood level
    heap.length = 0
    for (let k = 0; k < N * N; k++) if (coastR[k] > 0 && isFinite(T[k])) { L[k] = coastR[k]; push(k, T[k]) }
    const dist = new Float32Array(N * N)
    const src = new Float32Array(N * N)
    for (let k = 0; k < N * N; k++) src[k] = coastR[k]
    while (heap.length) {
      const k = pop()
      const i = k % N, j = (k / N) | 0
      for (const [di, dj, w] of nb) {
        const a = i + di, b = j + dj
        if (a < 0 || b < 0 || a >= N || b >= N) continue
        const q = b * N + a
        if (H[q] < 0 || L[q] >= 0) continue
        const d = dist[k] + w * cell
        const run = src[k]
        const level = run * (1 - Math.pow(d / ((opt.inland ?? 30) * Math.max(run, 1)), 1.5))
        if (level <= H[q] + 0.5) continue
        L[q] = level; dist[q] = d; src[q] = run
        T[q] = T[k] + (w * cell) / Math.sqrt(9.81 * Math.max(2, level - H[q]))
        push(q, T[q])
      }
    }
    let best = 0, bestT = -1
    for (let k = 0; k < N * N; k++) {
      const land = H[k] >= 0
      F[k * 4] = isFinite(T[k]) && (!land || L[k] >= 0) ? T[k] : -1
      F[k * 4 + 1] = land ? Math.max(0, L[k]) : A[k]
      F[k * 4 + 2] = land ? 1 : 0
      F[k * 4 + 3] = H[k]
      const i = k % N, j = (k / N) | 0
      const x = (i / (N - 1)) * 2 * HALF - HALF, z = (j / (N - 1)) * 2 * HALF - HALF
      if (land && L[k] > 0 && Math.hypot(x - CITY.x, z - CITY.y) < 3000 && L[k] > best) { best = L[k]; bestT = T[k] }
    }
    this.cityRunup = best
    this.cityArrival = bestT
    this.tex.needsUpdate = true
  }
  /** arrival time and flood level at a land point (for the houses) */
  sample(x: number, z: number) {
    const N = this.N
    const i = Math.round(((x + HALF) / (2 * HALF)) * (N - 1)), j = Math.round(((z + HALF) / (2 * HALF)) * (N - 1))
    const k = THREE.MathUtils.clamp(j, 0, N - 1) * N + THREE.MathUtils.clamp(i, 0, N - 1)
    return { t: this.field[k * 4], a: this.field[k * 4 + 1] }
  }
  clear() { this.field.fill(0); for (let k = 0; k < this.N * this.N; k++) this.field[k * 4] = -1; this.cityRunup = 0; this.cityArrival = -1; this.tex.needsUpdate = true }
}
