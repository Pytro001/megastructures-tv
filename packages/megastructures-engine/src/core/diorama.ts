import * as THREE from 'three'
import { LAYER_GLOW } from '../render/layers'

/** Shared helpers for tabletop dioramas: noise, canvas textures, particle points and pipe routes. */

export function hash(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
export function vnoise(x: number, y: number, p = 0) {
  let xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const w = (n: number) => p ? ((n % p) + p) % p : n
  const x1 = w(xi + 1), y1 = w(yi + 1); xi = w(xi); yi = w(yi)
  const a = hash(xi, yi), b = hash(x1, yi), c = hash(xi, y1), d = hash(x1, y1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export function fbm(x: number, y: number, o = 4, p = 0) {
  let s = 0, a = 0.5, f = 1
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, p ? p * f : 0); f *= 2; a *= 0.5 }
  return s
}
export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) }
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function canvasTex(w: number, h: number, px: (x: number, y: number) => [number, number, number, number?], srgb = true, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!, img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a = 1] = px(x, y), k = (y * w + x) * 4
    img.data[k] = r * 255; img.data[k + 1] = g * 255; img.data[k + 2] = b * 255; img.data[k + 3] = a * 255
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  return t
}
export function normalTex(size: number, height: (u: number, v: number) => number, strength: number) {
  const hmap = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) hmap[y * size + x] = height(x / size, y / size)
  const at = (x: number, y: number) => hmap[((y + size) % size) * size + ((x + size) % size)]
  return canvasTex(size, size, (x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength
    const l = Math.hypot(dx, dy, 1)
    return [(-dx / l) * 0.5 + 0.5, (-dy / l) * 0.5 + 0.5, (1 / l) * 0.5 + 0.5]
  }, false)
}

// ─── Particle points ──────────────────────────────────────────────────────
const pointVert = `attribute vec3 color;attribute float size;attribute float alpha;uniform float uHalfH;uniform float uScale;varying vec3 vColor;varying float vAlpha;
void main(){vColor=color;vAlpha=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.5,size*uScale*projectionMatrix[1][1]*uHalfH/-mv.z);gl_Position=projectionMatrix*mv;}`
const pointFrag = `uniform float uGain;uniform float uSoft;varying vec3 vColor;varying float vAlpha;
void main(){vec2 c=gl_PointCoord-.5;float d=length(c)*2.;float a=mix(1.-smoothstep(.55,1.,d),pow(max(0.,1.-d),1.6),uSoft);if(a<.01)discard;gl_FragColor=vec4(vColor*uGain,a*vAlpha);}`
export class Particles {
  pos: Float32Array; col: Float32Array; size: Float32Array; alpha: Float32Array
  geo = new THREE.BufferGeometry(); points: THREE.Points; mat: THREE.ShaderMaterial
  constructor(public count: number, opts: { additive?: boolean; gain?: number; soft?: number; order?: number; scale?: { value: number } }) {
    this.pos = new Float32Array(count * 3); this.col = new Float32Array(count * 3); this.size = new Float32Array(count).fill(0.05); this.alpha = new Float32Array(count).fill(1)
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: pointVert, fragmentShader: pointFrag, transparent: true, depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uHalfH: sharedHalfH, uScale: opts.scale ?? { value: 1 }, uGain: { value: opts.gain ?? 1 }, uSoft: { value: opts.soft ?? 0 } },
    })
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = opts.order ?? 5; this.points.layers.set(LAYER_GLOW)
  }
  set(i: number, x: number, y: number, z: number, c: readonly number[], s: number, a: number) {
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z
    this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2]; this.size[i] = s; this.alpha[i] = a
  }
  flush() { for (const k of ['position', 'color', 'size', 'alpha']) (this.geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true }
  dispose() { this.geo.dispose(); this.mat.dispose() }
}
export const sharedHalfH = { value: 400 }

/** Orthogonal pipe route with rounded bends, sampled for fast lookup. */
export class Route {
  curve: THREE.CurvePath<THREE.Vector3>; table: THREE.Vector3[]; length: number
  constructor(points: THREE.Vector3[], bend = 0.12) {
    const path = new THREE.CurvePath<THREE.Vector3>()
    let from = points[0].clone()
    for (let i = 1; i < points.length; i++) {
      const p = points[i], next = points[i + 1]
      if (!next) { path.add(new THREE.LineCurve3(from, p.clone())); break }
      const a = p.clone().sub(points[i - 1]), b = next.clone().sub(p)
      const r = Math.min(bend, a.length() / 2, b.length() / 2)
      const inPt = p.clone().sub(a.normalize().multiplyScalar(r)), outPt = p.clone().add(b.normalize().multiplyScalar(r))
      if (inPt.distanceTo(from) > 1e-4) path.add(new THREE.LineCurve3(from, inPt))
      path.add(new THREE.QuadraticBezierCurve3(inPt, p.clone(), outPt)); from = outPt
    }
    this.curve = path; this.length = path.getLength()
    this.table = path.getSpacedPoints(Math.max(32, Math.ceil(this.length * 60)))
  }
  at(u: number, out: THREE.Vector3) {
    const f = clamp(u, 0, 1) * (this.table.length - 1), i = Math.floor(f), t = f - i
    const a = this.table[i], b = this.table[Math.min(i + 1, this.table.length - 1)]
    return out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t))
  }
}

