import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Raptor, GEO } from '../raptor/raptor'
import { CutState } from 'megastructures-engine/core/cut'
import { surf } from 'megastructures-engine/core/materials'
import { revolve, wall } from 'megastructures-engine/core/geometry'

/**
 * The lab's Raptor 3 (the same model as the engine exhibit) baked into one
 * geometry per material, then drawn as instanced meshes: 33 engines under the
 * booster and 6 under the ship cost a few dozen draw calls instead of
 * thousands. The section cut, the cut caps and the propellant flowing in the
 * cut pipes all still work, because the cut shaders handle instancing.
 */

const KEEP = ['position', 'normal', 'uv', 'aS']

function normalise(g: THREE.BufferGeometry, m: THREE.Matrix4) {
  let geo = g.clone()
  geo.applyMatrix4(m)
  for (const name of Object.keys(geo.attributes)) if (!KEEP.includes(name)) geo.deleteAttribute(name)
  const n = geo.attributes.position.count
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
  if (!geo.getAttribute('aS')) geo.setAttribute('aS', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
  if (!geo.index) {
    const idx = new Uint32Array(n)
    for (let i = 0; i < n; i++) idx[i] = i
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
  } else if (!(geo.index.array instanceof Uint32Array)) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(geo.index.array), 1))
  geo.morphAttributes = {}
  return geo
}

export interface Baked { geo: THREE.BufferGeometry; mat: THREE.Material; fluid?: string; cast: boolean }

/** one engine, every mesh merged per material, in the engine's own frame (injector face at y = 0) */
export function bakeRaptor(cut: CutState, extra?: (add: (g: THREE.BufferGeometry, m: THREE.Material) => void, M: Raptor['mats']) => void): Baked[] {
  const r = new Raptor(cut)
  r.root.updateMatrixWorld(true)
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; fluid?: string; cast: boolean }>()
  const push = (g: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, fluid?: string, cast = true) => {
    const b = buckets.get(mat) ?? { geos: [], fluid, cast }
    b.geos.push(normalise(g, m))
    buckets.set(mat, b)
  }
  r.root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material)) return
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const im = mesh as THREE.InstancedMesh
      const mi = new THREE.Matrix4()
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, mi); push(im.geometry, im.material as THREE.Material, im.matrixWorld.clone().multiply(mi)) }
      return
    }
    push(mesh.geometry, mesh.material, mesh.matrixWorld, mesh.userData.fluid, mesh.castShadow)
  })
  extra?.((g, m) => push(g, m, new THREE.Matrix4()), r.mats)
  // the template engine never gets drawn
  r.root.traverse((o) => cut.meshes.delete(o as THREE.Mesh))
  const out: Baked[] = []
  for (const [mat, b] of buckets) {
    const geo = mergeGeometries(b.geos, false)
    if (!geo) continue
    geo.computeBoundingSphere()
    out.push({ geo, mat, fluid: b.fluid, cast: b.cast })
  }
  return out
}

/** the extension a vacuum Raptor bolts onto its regen nozzle: thin, radiatively cooled, glows when it runs */
export const RVAC = { len: 2.1, re: 1.18 }
export function rvacExtension(cut: CutState) {
  const y0 = GEO.yE + 0.02, y1 = GEO.yE - RVAC.len
  const rin = (y: number) => {
    const u = (y0 - y) / (y0 - y1)
    return GEO.Re - 0.01 + (RVAC.re - GEO.Re + 0.01) * (1 - Math.pow(1 - u, 1.7))
  }
  const geo = revolve(wall(rin, (y) => rin(y) + 0.012 + 0.02 * Math.exp(-((y0 - y) / 0.08)), y1, y0 + 0.06, 90), 120)
  const mat = surf({
    name: 'rvac', color: 0x3b3d41, metalness: 0.85, roughness: 0.48, detail: 2, roughVar: 0.3, colorVar: 0.08, streaks: 0.25,
    tint: { y0: y1, y1: y0, a: 0x2b2d31, b: 0x4a4646, c: 0x6b5340, strength: 0.55 },
    ribs: [360, 0.00025], emissive: 0xff5a1e, emissiveIntensity: 0,
    cut, capColor: 0x9aa0a6,
  })
  return { geo, mat }
}

export class Cluster {
  readonly root = new THREE.Group()
  readonly meshes: THREE.InstancedMesh[] = []
  readonly fluids: THREE.InstancedMesh[] = []
  readonly base: THREE.Matrix4[] = []
  readonly pos: THREE.Vector3[] = []
  readonly scale: number[] = []
  /** per engine gimbal (rad about x and z) and visibility */
  readonly gimbal: THREE.Vector2[] = []
  readonly hidden: boolean[] = []
  readonly ring: number[] = []
  /** pulled apart: each ring drops out of the engine bay by a different amount (m) */
  drop = 0
  constructor(baked: Baked[], rings: [number, number, number, number][], name: string) {
    this.root.name = name
    rings.forEach(([n, rad, ph, sc], ri) => {
      for (let i = 0; i < n; i++) {
        this.ring.push(ri)
        const a = ph + (i / n) * Math.PI * 2
        // engines face their pumps outward, so the cluster reads like the real thing from below
        const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0)), new THREE.Vector3(sc, sc, sc))
        this.base.push(m)
        this.pos.push(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad))
        this.scale.push(sc)
        this.gimbal.push(new THREE.Vector2())
        this.hidden.push(false)
      }
    })
    const N = this.base.length
    for (const b of baked) {
      const im = new THREE.InstancedMesh(b.geo, b.mat, N)
      im.castShadow = b.cast && !b.fluid
      im.receiveShadow = !b.fluid
      im.frustumCulled = false
      if (b.fluid) { im.userData.fluid = b.fluid; this.fluids.push(im) } else this.meshes.push(im)
      this.root.add(im)
    }
    this.sync()
  }
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private zero = new THREE.Matrix4().makeScale(0, 0, 0)
  /** rebuild instance matrices from the gimbal angles (pivot at the gimbal block on top) */
  sync() {
    const piv = 1.02
    for (let i = 0; i < this.base.length; i++) {
      const g = this.gimbal[i]
      this.e.set(g.x, 0, g.y)
      this.q.setFromEuler(this.e)
      this.m.makeTranslation(this.pos[i].x, piv - this.drop * (1 + this.ring[i] * 0.9), this.pos[i].z)
        .multiply(new THREE.Matrix4().makeRotationFromQuaternion(this.q))
        .multiply(new THREE.Matrix4().makeTranslation(-this.pos[i].x, -piv, -this.pos[i].z))
        .multiply(this.base[i])
      for (const im of [...this.meshes, ...this.fluids]) im.setMatrixAt(i, this.hidden[i] ? this.zero : this.m)
    }
    for (const im of [...this.meshes, ...this.fluids]) im.instanceMatrix.needsUpdate = true
  }
  showFluids(caps: boolean) { for (const f of this.fluids) f.visible = caps || f.userData.fluid === 'fire' }
}
