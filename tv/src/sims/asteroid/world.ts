import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { HALF, VEX, CITY, coastX, riverZ, fbm, type Heights, type Tsunami } from './geo'
import type { Crater } from './crater'

/**
 * The surface map (sea floor, beaches, fields, forest, rock, snow, the port
 * city and its roads) and the 3D houses and trees on it. Every frame each
 * house and tree checks what has reached it: the crater, the ejecta, the air
 * blast (gone past 20 psi, rubble past 5, trees thrown flat away from ground
 * zero past 2), the heat, and the tsunami (swept away where the flood stands
 * two metres over the ground).
 */

let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
export const urban = (x: number, z: number, h: number) => {
  if (h < 1.5) return 0
  const r = Math.hypot(x - CITY.x, z - CITY.y)
  return Math.exp(-((r / 4200) ** 2)) + 0.4 * Math.exp(-((r / 8000) ** 2)) * (fbm(x * 0.0004, z * 0.0004) > 0.48 ? 1 : 0)
}
export const forest = (x: number, z: number, h: number) => h > 60 && h < 1700 && fbm(x * 0.00012 + 7, z * 0.00012 - 3) + h * 0.00018 > 0.62

export function paintMap(H: Heights, size = 2048) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size), d = img.data
  const W = (m: number) => ((m + HALF) / (2 * HALF)) * size
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i / size) * 2 * HALF - HALF, z = (j / size) * 2 * HALF - HALF
    const h = H.at(x, z), k = (j * size + i) * 4
    const n = hash(i * 0.37, j * 0.71) * 0.12 + 0.94
    let r: number, gg: number, b: number
    if (h < -1) { // the sea floor, seen through the water
      const t = Math.min(1, -h / 2500)
      r = 150 - 100 * t; gg = 138 - 90 * t; b = 104 - 50 * t
    } else if (h < 5) { r = 205; gg = 190; b = 150 } // beach
    else if (h > 2000) { r = 238; gg = 240; b = 245 } // snow
    else if (h > 1300) { const t = (h - 1300) / 700; r = 110 + 30 * t; gg = 104 + 30 * t; b = 96 + 30 * t } // bare rock
    else if (forest(x, z, h)) { r = 36; gg = 66; b = 36 }
    else { // fields, by patch
      const f = hash(Math.floor(x / 900 + fbm(x * 0.001, z * 0.001) * 2), Math.floor(z / 700))
      const cols = [[111, 125, 65], [138, 138, 74], [154, 143, 85], [94, 112, 56], [124, 138, 72], [163, 154, 98], [79, 98, 51]]
      const cc = cols[Math.floor(f * cols.length)]
      r = cc[0]; gg = cc[1]; b = cc[2]
      if (h > 500) { const t = Math.min(1, (h - 500) / 800); r = r * (1 - t) + 70 * t; gg = gg * (1 - t) + 86 * t; b = b * (1 - t) + 50 * t }
    }
    const u = urban(x, z, h)
    if (u > 0.15) { const t = Math.min(1, (u - 0.15) * 1.6); r = r * (1 - t) + 118 * t; gg = gg * (1 - t) + 116 * t; b = b * (1 - t) + 112 * t }
    d[k] = r * n; d[k + 1] = gg * n; d[k + 2] = b * n; d[k + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const px = size / (2 * HALF)
  // the river
  g.strokeStyle = '#1d3a4c'; g.lineWidth = Math.max(2, 180 * px)
  g.beginPath()
  for (let x = coastX(CITY.y) - 500; x < HALF; x += 200) { const z = riverZ(x); if (H.at(x, z) > 1800) break; g.lineTo(W(x), W(z)) }
  g.stroke()
  // city streets and the port
  g.strokeStyle = 'rgba(60,60,64,0.9)'; g.lineWidth = Math.max(1, 30 * px)
  for (let v = -9000; v <= 9000; v += 360) {
    g.beginPath(); for (let w = -9000; w <= 9000; w += 300) { const x = CITY.x + v, z = CITY.y + w; if (urban(x, z, H.at(x, z)) > 0.2) g.lineTo(W(x), W(z)); else g.moveTo(W(x), W(z)) } g.stroke()
    g.beginPath(); for (let w = -9000; w <= 9000; w += 300) { const x = CITY.x + w, z = CITY.y + v; if (urban(x, z, H.at(x, z)) > 0.2) g.lineTo(W(x), W(z)); else g.moveTo(W(x), W(z)) } g.stroke()
  }
  // highways up the coast and inland
  g.strokeStyle = '#3c3d40'; g.lineWidth = Math.max(2, 90 * px)
  g.beginPath(); for (let z = -HALF; z <= HALF; z += 500) g.lineTo(W(coastX(z) + 2500 + 800 * Math.sin(z / 9000)), W(z)); g.stroke()
  g.beginPath(); g.moveTo(W(CITY.x), W(CITY.y)); for (let x = CITY.x; x < HALF; x += 500) g.lineTo(W(x), W(riverZ(x) + 1500)); g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  t.flipY = false
  return t
}

interface Inst { x: number; z: number; h: number; w: number; d: number; rot: number; g: number; dead: number }

export class Country {
  readonly root = new THREE.Group()
  readonly houses: Inst[] = []
  readonly trees: Inst[] = []
  private hm: THREE.InstancedMesh
  private tm: THREE.InstancedMesh
  constructor(H: Heights) {
    seed = 7
    for (let gx = -9000; gx <= 9000; gx += 150) for (let gz = -9000; gz <= 9000; gz += 150) {
      const x = CITY.x + gx + (rnd() - 0.5) * 50, z = CITY.y + gz + (rnd() - 0.5) * 50
      const g = H.at(x, z)
      const u = urban(x, z, g)
      if (rnd() > u * 1.1) continue
      const r = Math.hypot(x - CITY.x, z - CITY.y)
      const core = Math.exp(-((r / 1500) ** 2))
      this.houses.push({ x, z, h: 10 + rnd() * 20 + core * (60 + rnd() * 200) * (rnd() < 0.6 ? 1 : 0.3), w: 50 + rnd() * 60, d: 50 + rnd() * 60, rot: rnd() * 0.3, g, dead: 0 })
    }
    for (let i = 0; i < 90000 && this.trees.length < 14000; i++) {
      const x = CITY.x - 8000 + rnd() * (HALF - CITY.x + 8000), z = (rnd() * 2 - 1) * HALF
      const g = H.at(x, z)
      if (!forest(x, z, g)) continue
      this.trees.push({ x, z, h: 60 + rnd() * 40, w: 45 + rnd() * 30, d: 0, rot: rnd() * 6.28, g, dead: 0 })
    }
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    this.hm = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), this.houses.length)
    const pal = [0xd9d4ca, 0xc4bfb6, 0xb9b2a6, 0xe4e0d8, 0xa8a49c, 0x9aa4ad, 0xc9b9a3]
    const col = new THREE.Color()
    this.houses.forEach((h, i) => { col.setHex(pal[Math.floor(hash(h.x, h.z) * pal.length)]); if (h.h > 80) col.setHex(0x8fa3b5); this.hm.setColorAt(i, col) })
    this.hm.castShadow = true; this.hm.receiveShadow = true
    const cone = mergeGeometries([new THREE.ConeGeometry(0.5, 0.8, 6).translate(0, 0.6, 0), new THREE.CylinderGeometry(0.08, 0.1, 0.25, 5).translate(0, 0.12, 0)])
    this.tm = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), this.trees.length)
    this.trees.forEach((t, i) => { col.setRGB(0.1 + hash(t.x, 1) * 0.05, 0.2 + hash(t.z, 2) * 0.08, 0.09); this.tm.setColorAt(i, col) })
    this.tm.castShadow = true; this.tm.receiveShadow = true
    this.root.add(this.hm, this.tm)
  }

  update(crater: Crater, imp: THREE.Vector2, impH: number, tsu: Tsunami | null, o: { blast: number; r20: number; r5: number; r2: number; burn: number; t: number }) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), ax = new THREE.Vector3()
    const col = new THREE.Color()
    const rim = crater.rim()
    const R = crater.u.uR.value
    for (let i = 0; i < this.houses.length; i++) {
      const h = this.houses[i]
      const r = Math.hypot(h.x - imp.x, h.z - imp.y)
      const hit = r < o.blast
      let k = 1
      if (rim > 0 && r < rim * 1.05) k = 0
      else if (hit && r < o.r20) k = 0.02
      else if (hit && r < o.r5) k = 0.25
      if (tsu && o.t > 0) { const w = tsu.sample(h.x, h.z); if (w.t >= 0 && o.t > w.t + 20 && w.a > h.g + 2) k = 0 }
      const inside = R > 0 ? THREE.MathUtils.smoothstep(r, R * 1.3, R * 0.9) : 0
      const y = (h.g * (1 - inside) + impH * inside + crater.h(r)) * VEX
      if (rim > 0 && r < rim * 1.6 && crater.h(r) > h.h * 0.8) k = 0
      p.set(h.x, y, h.z)
      q.setFromAxisAngle(ax.set(0, 1, 0), h.rot)
      s.set(h.w, Math.max(0.01, h.h * k * VEX), h.d)
      if (k === 0) s.set(0.001, 0.001, 0.001)
      m.compose(p, q, s); this.hm.setMatrixAt(i, m)
    }
    this.hm.instanceMatrix.needsUpdate = true
    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i]
      const r = Math.hypot(t.x - imp.x, t.z - imp.y)
      const a = Math.atan2(t.z - imp.y, t.x - imp.x)
      let gone = rim > 0 && r < rim * 1.2
      if (o.blast > r && r < o.r20 * 0.6) gone = true
      const y = (t.g + crater.h(r)) * VEX
      if (rim > 0 && r < rim * 2 && crater.h(r) > t.h * 0.6) gone = true
      p.set(t.x, y, t.z)
      const down = o.blast > r && r < o.r2 ? 1 : 0
      if (down) { q.setFromAxisAngle(ax.set(-Math.sin(a), 0, Math.cos(a)), -Math.PI / 2 * 0.95); q.multiply(new THREE.Quaternion().setFromAxisAngle(ax.set(0, 1, 0), t.rot)) }
      else q.setFromAxisAngle(ax.set(0, 1, 0), t.rot)
      const sc = gone ? 0.001 : 1
      s.set(t.w * sc, t.h * sc * (down ? 1 : VEX * 0.6), t.w * sc)
      m.compose(p, q, s); this.tm.setMatrixAt(i, m)
      if (o.t > 0.3 && r < o.burn) col.setRGB(0.05, 0.04, 0.035)
      else if (down) col.setRGB(0.28, 0.24, 0.12)
      else col.setRGB(0.1 + hash(t.x, 1) * 0.05, 0.2 + hash(t.z, 2) * 0.08, 0.09)
      this.tm.setColorAt(i, col)
    }
    this.tm.instanceMatrix.needsUpdate = true
    if (this.tm.instanceColor) this.tm.instanceColor.needsUpdate = true
  }
}
