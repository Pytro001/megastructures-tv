import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CutState } from 'megastructures-engine/core/cut'
import { surf } from 'megastructures-engine/core/materials'
import { revolve, wall, ringProfile, circleProfile, pipe, bentPath, spline2, rAt, type P2 } from 'megastructures-engine/core/geometry'
import { GEO, RJ, RL, CH4X, combustionField } from '../raptor/raptor'
import { fluidMat } from '../raptor/fluid'
import type { Baked } from './cluster'

/**
 * A Raptor 3 light enough to draw 39 times: the same bell contour, chamber,
 * powerhead, pumps and the clean outside of the real Raptor 3 (no heat shield,
 * almost no external plumbing), about 30,000 triangles instead of the
 * exhibit's 1.3 million. Same materials, so it reads as the same engine, and
 * every part is a closed solid with propellant inside, so it cuts open too.
 */
export function bakeLite(cut: CutState): Baked[] {
  const M = {
    nozzle: surf({
      name: 'nozzle', color: 0x5f6267, metalness: 1, roughness: 0.44, detail: 1.3, roughVar: 0.28, colorVar: 0.05, bump: 0.0002, streaks: 0.28,
      tint: { y0: GEO.yE, y1: GEO.yT, a: 0x44484e, b: 0x5b5a63, c: 0x8c6a47, strength: 0.6 },
      ribs: [220, 0.00035], cut, capColor: 0xb4b9bf, capRoughness: 0.42,
    }),
    cast: surf({ name: 'cast', color: 0xa3a8ae, metalness: 1, roughness: 0.44, detail: 1.1, roughVar: 0.22, colorVar: 0.035, bump: 0.00012, cut, capColor: 0xb4b9bf, capRoughness: 0.42 }),
    printed: surf({ name: 'printed', color: 0xa9adb3, metalness: 1, roughness: 0.5, detail: 1.2, roughVar: 0.22, colorVar: 0.035, layers: [2300, 0.00004], bump: 0.00015, cut, capColor: 0xb4b9bf, capRoughness: 0.42 }),
    machined: surf({ name: 'machined', color: 0xc4c8cd, metalness: 1, roughness: 0.3, detail: 3, roughVar: 0.15, colorVar: 0.02, cut, capColor: 0xb9bdc3, capRoughness: 0.42 }),
    dark: surf({ name: 'dark', color: 0x34373c, metalness: 0.9, roughness: 0.4, detail: 9, roughVar: 0.3, cut, capColor: 0x8a8f96 }),
    liner: surf({ name: 'liner', color: 0xb06a42, metalness: 1, roughness: 0.34, detail: 3, roughVar: 0.25, colorVar: 0.06, cut, capColor: 0xc97c50, capRoughness: 0.42 }),
  }
  const geos = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => { const l = geos.get(m) ?? []; l.push(g); geos.set(m, l) }
  const fluids: Baked[] = []
  const field = combustionField()

  /* thrust chamber and bell, one revolved wall with the copper liner inside */
  const yJ = GEO.yT - 0.3
  const bulk = spline2([[0.34, -0.07], [0.322, -0.15], [0.282, -0.28], [0.236, GEO.yT + 0.03], [0.215, GEO.yT - 0.1], [RJ(yJ) + 0.014, yJ]], 6)
  add(revolve(wall((y) => RL(y) - 0.004, RJ, GEO.yE, yJ, 70), 64, 30), M.nozzle)
  add(revolve(wall(RL, (y) => Math.max(RJ(y), rAt(bulk, y)), yJ, -0.07, 30), 64, 30), M.cast)
  add(revolve(wall(GEO.Rin, (y) => RL(y) - 0.004, GEO.yE + 0.002, -0.004, 70), 64, 30), M.liner)
  // stiffening rings on the bell and the lip at the exit
  for (const yb of [GEO.yT - 0.58, GEO.yT - 1.02]) { const r = RJ(yb); add(revolve(ringProfile(r - 0.004, r + 0.014, yb - 0.022, yb + 0.022, 0.005), 64), M.nozzle) }
  add(revolve(circleProfile(GEO.Re + 0.03, GEO.yE + 0.004, 0.012, 8), 64), M.nozzle)
  // methane inlet manifold near the bottom of the regen section
  const yM = GEO.yE + 0.19, rM = RJ(yM) + 0.024
  add(revolve(circleProfile(rM, yM, 0.04, 10), 64), M.cast)

  /* main injector dome and the hot gas manifold on top */
  add(revolve([[0, -0.07], [0.375, -0.07], [0.375, 0.0], [0.33, 0.06], [0.24, 0.16], [0.12, 0.22], [0, 0.235]], 48, 40), M.printed)
  add(revolve(circleProfile(0.33, 0.07, 0.07, 10), 48), M.printed)

  /* powerhead: oxygen turbopump in line, methane pump on the side, preburners and ducts */
  const lox = new THREE.Vector3(0, 0, 0.3)
  {
    const p: P2[] = [[0, 0.3], [0.2, 0.3], [0.25, 0.42], [0.26, 0.62], [0.3, 0.7], [0.3, 0.82], [0.2, 0.9], [0.12, 1.02], [0, 1.04]]
    add(revolve(p, 40, 40).translate(lox.x, 0, lox.z), M.printed)
    add(revolve(circleProfile(0.27, 0.78, 0.07, 10), 40).translate(lox.x, 0, lox.z), M.cast)
    // the inlet that bolts to the vehicle's oxygen line, and the gimbal block
    add(revolve(ringProfile(0, 0.13, 1.0, 1.12, 0.01), 32).translate(0, 0, 0.14), M.machined)
    add(new THREE.BoxGeometry(0.16, 0.12, 0.16).translate(0, 1.02, 0.28), M.dark)
    // oxygen preburner below the pump
    add(revolve([[0, 0.12], [0.14, 0.12], [0.16, 0.2], [0.16, 0.32], [0, 0.32]], 32, 40).translate(lox.x, 0.0, lox.z), M.cast)
  }
  const ch4 = new THREE.Vector3(CH4X, 0, 0.2)
  {
    const p: P2[] = [[0, 0.28], [0.15, 0.28], [0.19, 0.36], [0.19, 0.6], [0.22, 0.66], [0.2, 0.74], [0.1, 0.8], [0, 0.82]]
    add(revolve(p, 32, 40).translate(ch4.x, 0, ch4.z), M.printed)
    add(revolve([[0, -0.3], [0.11, -0.3], [0.13, -0.24], [0.13, 0.26], [0, 0.28]], 28, 40).translate(ch4.x, 0, ch4.z - 0.07), M.cast)
    add(revolve(ringProfile(0, 0.1, 0.8, 0.94, 0.01), 28).translate(ch4.x, 0, ch4.z), M.machined)
    // the fuel rich hot gas duct sweeping round to the main injector
    const duct = bentPath([[ch4.x, 0.02, 0.13], [0.5, 0.06, 0.12], [0.4, 0.1, 0.08]], 0.08)
    add(pipe(duct, { r: 0.085, tubular: 16, radial: 16 }), M.cast)
    // methane feed from the pump down to the bell's inlet manifold
    const feed = bentPath([[ch4.x + 0.05, 0.4, 0.33], [0.55, 0.2, 0.42], [0.5, -0.6, 0.38], [rM * 0.7, yM + 0.05, rM * 0.7]], 0.2)
    add(pipe(feed, { r: 0.045, tubular: 32, radial: 12 }), M.cast)
    const fg = pipe(feed, { r: 0.035, tubular: 32, radial: 10 })
    fluids.push({ geo: fg, mat: fluidMat(cut, { kind: 'ch4', mode: 0, scale: 0.18, speed: 1.4 }), fluid: 'ch4', cast: false })
  }
  // propellant inside the pumps, seen when the stack is cut
  fluids.push({ geo: revolve([[0, 0.34], [0.18, 0.34], [0.22, 0.46], [0.23, 0.8], [0.12, 0.98], [0, 1.0]], 32).translate(lox.x, 0, lox.z), mat: fluidMat(cut, { kind: 'lox', mode: 4, scale: 0.12, speed: 1.6, gas: false }), fluid: 'lox', cast: false })
  fluids.push({ geo: revolve([[0, 0.32], [0.13, 0.32], [0.16, 0.4], [0.16, 0.7], [0, 0.76]], 28).translate(ch4.x, 0, ch4.z), mat: fluidMat(cut, { kind: 'ch4', mode: 4, scale: 0.12, speed: 1.6, gas: false }), fluid: 'ch4', cast: false })
  // and the fire in the chamber and bell, which shows from below even when nothing is cut
  const fire = revolve([[0, -0.003], ...GEO.contour.filter((p) => p[1] < -0.003).filter((_, i) => i % 3 === 0).map((p) => [p[0] - 0.003, p[1]] as P2), [GEO.Re - 0.003, GEO.yE], [0, GEO.yE]], 48)
  fluids.push({ geo: fire, mat: fluidMat(cut, { kind: 'fire', mode: 3, field: field.tex, fieldRange: field.range, intensity: 1.0 }), fluid: 'fire', cast: false })

  const out: Baked[] = []
  for (const [mat, list] of geos) {
    const clean = list.map((g) => {
      const n = g.attributes.position.count
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aS'].includes(k)) g.deleteAttribute(k)
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
      if (!g.getAttribute('aS')) g.setAttribute('aS', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
      return g.index ? g : g.toNonIndexed()
    })
    const nonIdx = clean.some((g) => !g.index)
    const geo = mergeGeometries(nonIdx ? clean.map((g) => (g.index ? g.toNonIndexed() : g)) : clean, false)!
    geo.computeBoundingSphere()
    out.push({ geo, mat, cast: false })
  }
  for (const f of fluids) {
    const n = f.geo.attributes.position.count
    if (!f.geo.getAttribute('aS')) f.geo.setAttribute('aS', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
    out.push(f)
  }
  return out
}
