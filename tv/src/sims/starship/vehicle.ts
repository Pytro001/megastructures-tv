import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CutState } from 'megastructures-engine/core/cut'
import { surf } from 'megastructures-engine/core/materials'
import { revolve, ringProfile, circleProfile, pipe, bentPath, spline2, type P2 } from 'megastructures-engine/core/geometry'
import { fluidMat } from '../raptor/fluid'
import { GEO } from '../raptor/raptor'
import { rvacExtension, Cluster, RVAC } from './cluster'
import { bakeLite } from './lite'
import { R, RIN, B, S, S0, TANKS, B_RINGS, S_RINGS, tankArea, type BuiltTank } from './dims'
import { steel, tiles, baseShield, liquid, liquidSurface, VU } from './mats'

/**
 * Starship V3 on its way up: Super Heavy with 33 Raptor 3 engines and the
 * ship with six, stacked 124 m tall. Every tank, dome, pipe and engine is a
 * closed solid on one section plane, so the whole stack can be cut in half
 * live, and each section of it can slide apart along the axis.
 */

export interface Part { name: string; group: THREE.Group; dy: number }

const D = Math.PI / 180

/** a thin dome shell: rim at yRim, apex at yRim + h (h < 0 bulges down) */
function domeShell(yRim: number, h: number, t: number, rOut = RIN + 0.005, n = 40): P2[] {
  const out: P2[] = [], inn: P2[] = []
  const s = Math.sign(h)
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * (Math.PI / 2)
    out.push([rOut * Math.sin(th), yRim + h * Math.cos(th)])
    inn.push([(rOut - t) * Math.sin(th), yRim + (h - s * t) * Math.cos(th) - s * t * 0.0])
  }
  return [...out, ...inn.reverse()]
}

/** the inside of a tank as one closed solid (for the liquid and gas in it) */
function tankSolid(k: BuiltTank, shrink = 0.03) {
  const pts: P2[] = []
  const n = 160
  // outer boundary from bottom apex up to top apex; for a dome bulging into this tank from above, follow its underside
  const yA = k.y0 + 0.001, yB = k.y1 - 0.001
  const right: P2[] = [], left: P2[] = []
  for (let i = 0; i <= n; i++) {
    const y = yA + ((yB - yA) * i) / n
    const area = tankArea(k, y)
    if (k.hTop < 0 && y > k.yTop + k.hTop) {
      // annulus under a dome that bulges down into this tank
      const s = (k.yTop - y) / -k.hTop
      const rIn = RIN * Math.sqrt(Math.max(0, 1 - s * s))
      right.push([RIN - shrink, y]); left.push([rIn + shrink, y])
    } else right.push([Math.max(0, Math.sqrt(area / Math.PI) - shrink), y])
  }
  if (left.length) {
    // up the wall, back down the dome's underside, and close along the axis below it
    pts.push(...right, ...left.reverse())
    const yApex = k.yTop + k.hTop
    pts.push([0, yApex - shrink])
    pts.push([0, yA])
  } else {
    pts.push([0, yA], ...right, [0, yB])
  }
  return revolve(pts, 96)
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.rotateY(ry)
  g.translate(x, y, z)
  return g
}

export class Vehicle {
  readonly root = new THREE.Group()
  readonly booster = new THREE.Group()
  readonly ship = new THREE.Group()
  readonly cut: CutState
  readonly parts: Part[] = []
  readonly bEng: Cluster
  readonly sSL: Cluster
  readonly sVac: Cluster
  readonly vacMat: THREE.MeshStandardMaterial
  readonly surfaces: { mesh: THREE.Mesh; tank: BuiltTank; idx: number }[] = []
  readonly fluids: THREE.Mesh[] = []
  readonly anchors: Record<string, THREE.Vector3> = {}
  readonly finGroups: THREE.Group[] = []
  readonly hsrVents: THREE.Vector3[] = []
  readonly spanning: THREE.Mesh[] = []

  constructor() {
    this.root.name = 'starship'
    this.root.add(this.booster, this.ship)
    const cut = (this.cut = new CutState(this.root, R + 0.7, 0))

    /* ---------------- materials ---------------- */
    const M = {
      steel: steel(cut),
      steelBare: steel(cut, { frost: false, name: 'steel-bare' }),
      steelBase: steel(cut, { frost: false, base: 8, name: 'steel-base' }),
      inner: steel(cut, { frost: false, welds: false, name: 'steel-in', roughness: 0.42, envMapIntensity: 0.6 }),
      dome: steel(cut, { frost: false, welds: false, name: 'dome', roughness: 0.36, envMapIntensity: 0.7 }),
      tiles: tiles(cut),
      flapTiles: tiles(cut, { flap: true }),
      baseB: baseShield(cut, 0),
      baseS: baseShield(cut, 1),
      dark: surf({ name: 'darksteel', color: 0x3a3c40, metalness: 0.9, roughness: 0.42, detail: 3, roughVar: 0.3, cut, capColor: 0x9aa0a6 }),
      fin: surf({ name: 'fin', color: 0x8d9095, metalness: 1, roughness: 0.38, detail: 2, roughVar: 0.35, colorVar: 0.12, streaks: 0.3, cut, capColor: 0xb8bcc2 }),
      copv: surf({ name: 'copv', color: 0x1d1f22, metalness: 0.3, roughness: 0.32, detail: 6, roughVar: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.25, cut, capColor: 0x3c3f44, capMetalness: 0.1 }),
      sat: surf({ name: 'sat', color: 0x16203a, metalness: 0.6, roughness: 0.3, detail: 4, roughVar: 0.2, cut, capColor: 0x8a93a3 }),
      satFrame: surf({ name: 'satframe', color: 0xc8c2b4, metalness: 0.8, roughness: 0.35, cut, capColor: 0xd8d2c4 }),
    }

    const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => {
      const mesh = new THREE.Mesh(g, m)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
      return mesh
    }
    const part = (name: string, parent: THREE.Group, dy: number) => {
      const g = new THREE.Group(); g.name = name
      parent.add(g)
      this.parts.push({ name, group: g, dy })
      return g
    }
    const fluid = (g: THREE.BufferGeometry, kind: 'lox' | 'ch4' | 'oxgas' | 'fuelgas', parent: THREE.Object3D, mode: 0 | 1 | 2 | 4, o: { scale?: number; speed?: number; intensity?: number } = {}) => {
      const m = fluidMat(cut, { kind, mode, scale: o.scale ?? 1.4, speed: o.speed ?? 1.4, intensity: o.intensity ?? 1.5 })
      const mesh = new THREE.Mesh(g, m)
      mesh.userData.fluid = kind
      parent.add(mesh)
      this.fluids.push(mesh)
      return mesh
    }
    /** a pipe on the section plane with propellant flowing in it from the first point to the last */
    const line = (pts: [number, number, number][], r: number, kind: 'lox' | 'ch4' | 'oxgas' | 'fuelgas', parent: THREE.Object3D, mat: THREE.Material = M.dark, bend = 0.6, spans = false) => {
      const c = bentPath(pts, bend)
      const T = Math.max(24, Math.round(c.getLength() * 3))
      const a = add(pipe(c, { r, ri: r * 0.82, tubular: T, radial: 20 }), mat, parent)
      const b = fluid(pipe(c, { r: r * 0.8, tubular: T, radial: 16 }), kind, parent, 0, { scale: Math.max(0.6, r * 4), speed: 1.2 })
      // lines that run through several sections hide while the stack is pulled apart
      if (spans) { a.userData.spans = true; b.userData.spans = true; this.spanning.push(a, b) }
    }

    /* ================================================================ */
    /* SUPER HEAVY                                                        */
    /* ================================================================ */
    const baked = bakeLite(cut)
    const engB = part('b-engines', this.booster, -9)
    this.bEng = new Cluster(baked, B_RINGS, 'booster-engines')
    this.bEng.root.position.y = -GEO.yE
    engB.add(this.bEng.root)

    // aft section: skirt, base heat shield with a hole per engine, thrust structure, COPVs, manifolds
    const aft = part('b-aft', this.booster, -5)
    add(revolve(ringProfile(R - 0.035, R, B.skirt0, TANKS.B.lox.yBot), 180), M.steelBase, aft)
    {
      const sh = new THREE.Shape(); sh.absarc(0, 0, RIN - 0.01, 0, Math.PI * 2, false)
      for (const [n, rad, ph, sc] of B_RINGS)
        for (let i = 0; i < n; i++) {
          const a = ph + (i / n) * Math.PI * 2
          const h = new THREE.Path(); h.absarc(Math.cos(a) * rad, -Math.sin(a) * rad, 0.47 * sc, 0, Math.PI * 2, true)
          sh.holes.push(h)
        }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false, curveSegments: 22 })
      g.rotateX(-Math.PI / 2); g.translate(0, B.skirt0, 0)
      add(g, M.baseB, aft)
    }
    // thrust puck in the middle, a thrust ring for the outer engines, spokes between
    add(revolve(ringProfile(0, 1.75, 3.35, 4.15, 0.06), 64), M.dark, aft)
    add(revolve(ringProfile(3.05, RIN - 0.02, 3.35, 3.85, 0.04), 160), M.dark, aft)
    add(revolve(ringProfile(1.95, 3.0, 3.4, 3.75, 0.03), 120), M.dark, aft)
    {
      const sp: THREE.BufferGeometry[] = []
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 10; sp.push(box(2.9, 0.34, 0.22, Math.cos(a) * 3.0, 3.6, Math.sin(a) * 3.0, -a)) }
      add(mergeGeometries(sp)!, M.dark, aft)
      const cp: THREE.BufferGeometry[] = []
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.13
        const g = new THREE.CapsuleGeometry(0.3, 0.75, 6, 18); g.translate(Math.cos(a) * 3.95, 4.62, Math.sin(a) * 3.95); cp.push(g)
      }
      add(mergeGeometries(cp)!, M.copv, aft)
    }
    // methane manifold ring and oxygen ring above the engines
    add(revolve(circleProfile(2.55, 4.45, 0.24, 18), 160), M.dark, aft)
    fluid(revolve(circleProfile(2.55, 4.45, 0.2, 14), 120), 'ch4', aft, 4, { scale: 1.2 })
    add(revolve(circleProfile(1.2, 4.42, 0.2, 18), 96), M.dark, aft)
    fluid(revolve(circleProfile(1.2, 4.42, 0.16, 14), 80), 'lox', aft, 4, { scale: 1.0 })
    // feed drops into the engines that sit on the section plane
    for (const x of [-3.86, 3.86, -2.5, 2.5]) line([[x * 0.66, 4.45, 0], [x, 4.0, 0], [x, 3.25, 0]], 0.13, 'ch4', aft)
    for (const x of [-0.98 * 0.5, 0.98]) line([[x * 0.3, 4.4, 0], [x, 3.95, 0], [x, 3.25, 0]], 0.15, 'lox', aft)

    // liquid oxygen tank
    const lox = part('b-lox', this.booster, -2)
    const kB = TANKS.B
    add(revolve(ringProfile(R - 0.03, R, kB.lox.yBot, kB.lox.yTop), 180), M.steel, lox)
    add(revolve(domeShell(kB.lox.yBot, -kB.lox.hBot, 0.03), 120), M.dome, lox)
    // the CH4 downcomer: methane from the upper tank runs straight down through the liquid oxygen
    {
      const top = kB.ch4.yBot - kB.ch4.hBot
      const c = new THREE.LineCurve3(new THREE.Vector3(0, top + 0.2, 0), new THREE.Vector3(0, 4.15, 0))
      add(pipe(c, { r: 0.42, ri: 0.38, tubular: 60, radial: 32 }), M.inner, lox)
      fluid(pipe(c, { r: 0.37, tubular: 60, radial: 24 }), 'ch4', lox, 0, { scale: 2.2, speed: 2.2, intensity: 1.7 })
      // three anti-vortex baffles at the oxygen outlet
      for (let i = 0; i < 3; i++) add(box(0.06, 0.9, 1.2, 0, kB.lox.yBot - kB.lox.hBot + 0.6, 0, (i / 3) * Math.PI), M.inner, lox)
    }
    // autogenous pressurisation: hot oxygen gas from the engines back up into the top of the tank
    line([[-4.2, 3.9, 0], [-4.2, kB.lox.yTop - 2.6, 0], [-3.4, kB.lox.yTop - 2.3, 0]], 0.07, 'oxgas', lox, M.inner, 0.4, true)
    this.tank(kB.lox, lox, 0)

    // liquid methane tank
    const ch4 = part('b-ch4', this.booster, 1)
    add(revolve(ringProfile(R - 0.03, R, kB.ch4.yBot, kB.ch4.yTop), 180), M.steel, ch4)
    add(revolve(domeShell(kB.ch4.yBot, -kB.ch4.hBot, 0.04), 120), M.dome, ch4)
    add(revolve(domeShell(kB.ch4.yTop, kB.ch4.hTop, 0.03), 120), M.dome, ch4)
    line([[4.2, 3.9, 0], [4.2, kB.ch4.yTop - 0.6, 0], [3.2, kB.ch4.yTop + 0.9, 0]], 0.07, 'fuelgas', ch4, M.inner, 0.4, true)
    this.tank(kB.ch4, ch4, 1)

    // forward section: grid fins, catch pins, the raceway
    const fwd = part('b-fwd', this.booster, 4)
    add(revolve(ringProfile(R - 0.03, R, kB.ch4.yTop, B.top), 180), M.steelBare, fwd)
    {
      const gf = this.gridFin()
      for (let i = 0; i < 3; i++) {
        const a = (90 + i * 120) * D
        const g = new THREE.Group()
        const mesh = add(gf, M.fin, g)
        mesh.castShadow = true
        g.position.set(Math.cos(a) * R, B.fins, Math.sin(a) * R)
        g.rotation.y = -a
        fwd.add(g)
        this.finGroups.push(g)
        add(box(0.7, 1.2, 1.4, Math.cos(a) * (R + 0.2), B.fins, Math.sin(a) * (R + 0.2), -a), M.dark, fwd)
      }
      for (const a of [30 * D, 150 * D]) add(box(0.55, 0.5, 0.7, Math.cos(a) * (R + 0.2), 65.2, Math.sin(a) * (R + 0.2), -a), M.dark, fwd)
    }
    const race = part('b-race', this.booster, 0)
    {
      const a = 200 * D
      const g = new THREE.CapsuleGeometry(0.28, kB.ch4.yTop - 8, 4, 10)
      g.scale(1, 1, 1.5); g.rotateY(-a); g.translate(Math.cos(a) * (R + 0.08), (kB.ch4.yTop + 8) / 2, Math.sin(a) * (R + 0.08))
      add(g, M.steelBare, race)
    }

    // the hot stage ring: vents all round, a dome underneath that takes the ship's engines lighting
    const hsr = part('b-hsr', this.booster, 7)
    add(revolve(ringProfile(R - 0.06, R, B.hsr0, B.hsr0 + 0.45, 0.02), 180), M.steelBare, hsr)
    add(revolve(ringProfile(R - 0.06, R, B.hsr1 - 0.42, B.hsr1, 0.02), 180), M.steelBare, hsr)
    {
      const st: THREE.BufferGeometry[] = []
      const n = 30
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const g = new THREE.BoxGeometry(0.1, B.hsr1 - B.hsr0 - 0.8, 0.34)
        g.rotateZ(0.0); g.rotateY(-a); g.translate(Math.cos(a) * (R - 0.05), (B.hsr0 + B.hsr1) / 2, Math.sin(a) * (R - 0.05))
        st.push(g)
        const av = a + Math.PI / n
        this.hsrVents.push(new THREE.Vector3(Math.cos(av) * R, (B.hsr0 + B.hsr1) / 2, Math.sin(av) * R))
      }
      add(mergeGeometries(st)!, M.steelBare, hsr)
      add(revolve(domeShell(B.hsr0 + 0.1, 1.6, 0.06, R - 0.08), 120), M.dark, hsr)
    }

    /* ================================================================ */
    /* SHIP                                                               */
    /* ================================================================ */
    const sAft = part('s-aft', this.ship, 10)
    this.sSL = new Cluster(baked, [S_RINGS[0]], 'ship-sl')
    this.sSL.root.position.y = S0 + 1.0 - GEO.yE
    sAft.add(this.sSL.root)
    const ext = rvacExtension(cut)
    this.vacMat = ext.mat
    this.sVac = new Cluster([...baked, { geo: ext.geo, mat: ext.mat, cast: false }], [S_RINGS[1]], 'ship-rvac')
    this.sVac.root.position.y = S0 + 0.1 - (GEO.yE - RVAC.len) * S_RINGS[1][3]
    sAft.add(this.sVac.root)
    add(revolve(ringProfile(R - 0.035, R, S0, S.skirt1), 180), M.steelBare, sAft)
    {
      const sh = new THREE.Shape(); sh.absarc(0, 0, RIN - 0.01, 0, Math.PI * 2, false)
      for (const [n, rad, ph] of S_RINGS)
        for (let i = 0; i < n; i++) {
          const a = ph + (i / n) * Math.PI * 2
          const h = new THREE.Path(); h.absarc(Math.cos(a) * rad, -Math.sin(a) * rad, rad > 2 ? 1.12 : 0.5, 0, Math.PI * 2, true)
          sh.holes.push(h)
        }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false, curveSegments: 26 })
      g.rotateX(-Math.PI / 2); g.translate(0, S0 + 1.75, 0)
      add(g, M.baseS, sAft)
      add(revolve(ringProfile(0, 1.6, S.puck - 0.6, S.puck, 0.05), 64), M.dark, sAft)
      add(revolve(ringProfile(1.7, RIN - 0.02, S.puck - 0.45, S.puck - 0.05, 0.03), 160), M.dark, sAft)
    }
    this.flap(sAft, M, true)

    const sLox = part('s-lox', this.ship, 13)
    const kS = TANKS.S
    add(revolve(ringProfile(R - 0.03, R, kS.lox.yBot - 0.0, kS.lox.yTop), 180), M.steel, sLox)
    add(revolve(domeShell(kS.lox.yBot, -kS.lox.hBot, 0.03), 120), M.dome, sLox)
    this.tank(kS.lox, sLox, 2)
    // the methane header tank (landing propellant) hangs in the top of the oxygen tank
    {
      const c = new THREE.Vector3(-1.75, S0 + 17.25, 0)
      add(new THREE.SphereGeometry(1.2, 56, 36).translate(c.x, c.y, c.z), M.inner, sLox)
      const g = new THREE.SphereGeometry(1.14, 48, 32); g.translate(c.x, c.y, c.z)
      fluid(g, 'ch4', sLox, 4, { scale: 0.8, speed: 0.4, intensity: 1.3 })
      line([[c.x, c.y - 1.2, 0], [c.x, S0 + 6.0, 0], [-1.0, S.puck + 0.2, 0], [-1.0, S0 + 3.4, 0]], 0.1, 'ch4', sLox, M.inner, 0.8, true)
      this.anchors.ch4Header = c.clone().add(new THREE.Vector3(0, 0, 0.6))
      // the ship's downcomer
      const dc = new THREE.LineCurve3(new THREE.Vector3(0, kS.ch4.yBot - kS.ch4.hBot + 0.1, 0), new THREE.Vector3(0, S.puck, 0))
      add(pipe(dc, { r: 0.32, ri: 0.29, tubular: 40, radial: 28 }), M.inner, sLox)
      fluid(pipe(dc, { r: 0.28, tubular: 40, radial: 20 }), 'ch4', sLox, 0, { scale: 2.0, speed: 2.0, intensity: 1.7 })
    }

    const sCh4 = part('s-ch4', this.ship, 16)
    add(revolve(ringProfile(R - 0.03, R, kS.ch4.yBot, S.bay0), 180), M.steel, sCh4)
    add(revolve(domeShell(kS.ch4.yBot, -kS.ch4.hBot, 0.04), 120), M.dome, sCh4)
    add(revolve(domeShell(kS.ch4.yTop, kS.ch4.hTop, 0.03), 120), M.dome, sCh4)
    this.tank(kS.ch4, sCh4, 3)

    const bay = part('s-bay', this.ship, 19)
    add(revolve(ringProfile(R - 0.03, R, S.bay0, S.nose0), 180), M.steelBare, bay)
    {
      // Starlink satellites stacked like plates, ready to slide out of the door on the leeward side
      const sats: THREE.BufferGeometry[] = [], frames: THREE.BufferGeometry[] = []
      for (let i = 0; i < 12; i++) {
        const y = S.bay0 + 1.6 + i * 0.78
        sats.push(box(6.0, 0.16, 2.9, 0.2, y, 0))
        frames.push(box(6.1, 0.06, 3.0, 0.2, y - 0.12, 0))
      }
      add(mergeGeometries(sats)!, M.sat, bay)
      add(mergeGeometries(frames)!, M.satFrame, bay)
      add(box(0.25, 10.4, 0.5, -3.3, S.bay0 + 5.6, 0), M.dark, bay)
      add(box(0.25, 10.4, 0.5, 3.6, S.bay0 + 5.6, 0), M.dark, bay)
      // the door slot
      add(box(0.06, 0.9, 6.4, -R + 0.01, S.bay0 + 6.0, 0), M.dark, bay)
    }

    const nose = part('s-nose', this.ship, 23)
    {
      const H = S.top - S.nose0
      const prof = spline2([[R, 0], [R - 0.02, 1.4], [4.32, 3.2], [3.85, 5.0], [3.05, 6.5], [2.0, 7.7], [0.9, 8.6], [0, H]], 14)
      const outer = (y: number) => {
        for (let i = 0; i < prof.length - 1; i++) if (prof[i + 1][1] >= y) { const t = (y - prof[i][1]) / (prof[i + 1][1] - prof[i][1] || 1); return prof[i][0] + (prof[i + 1][0] - prof[i][0]) * t }
        return 0
      }
      const pts: P2[] = []
      for (let i = 0; i <= 120; i++) { const y = (H * i) / 120; pts.push([outer(y), S.nose0 + y]) }
      for (let i = 120; i >= 0; i--) { const y = Math.min(H - 0.04, (H * i) / 120); pts.push([Math.max(0, outer(y) - 0.035), S.nose0 + y - 0.0]) }
      add(revolve(pts, 180), M.steelBare, nose)
      // tiles over the nose follow the profile
      const tp: P2[] = []
      for (let i = 0; i <= 120; i++) { const y = (H * i) / 120; tp.push([outer(y) + 0.03, S.nose0 + y]) }
      for (let i = 120; i >= 0; i--) { const y = (H * i) / 120; tp.push([Math.max(0, outer(y) + 0.001), S.nose0 + y]) }
      add(revolve(tp, 180), M.tiles, nose)
      this.noseR = outer
      // LOX header tank
      const c = new THREE.Vector3(0, S.nose0 + 2.6, 0)
      const g = new THREE.SphereGeometry(1.3, 48, 32); g.translate(c.x, c.y, c.z)
      add(g, M.inner, nose)
      const g2 = new THREE.SphereGeometry(1.22, 40, 28); g2.translate(c.x, c.y, c.z)
      fluid(g2, 'lox', nose, 4, { scale: 0.8, speed: 0.4, intensity: 1.3 })
      this.anchors.loxHeader = c.clone().add(new THREE.Vector3(0, 0, 0.7))
    }
    // the header transfer tube runs from the nose all the way down to the engines
    line([[0, S.nose0 + 1.3, 0], [0, S.nose0 + 0.4, 0], [-3.7, S.nose0 - 0.5, 0], [-3.7, S0 + 6.4, 0], [-2.95, S.puck + 0.2, 0], [-2.95, S0 + 3.2, 0]], 0.12, 'lox', sCh4, M.inner, 1.0, true)
    // tiles on the windward half of the cylinder, from the skirt to the nose
    for (const [p, y0, y1] of [[sAft, S0 + 0.15, kS.lox.yBot], [sLox, kS.lox.yBot, kS.lox.yTop], [sCh4, kS.ch4.yBot, S.bay0], [bay, S.bay0, S.nose0]] as [THREE.Group, number, number][])
      add(revolve(ringProfile(R + 0.001, R + 0.032, y0, y1), 200), M.tiles, p)
    this.flap(nose, M, false)
    this.chines(sLox, M.flapTiles)

    /* ---------------- anchors for labels (vehicle frame) ---------------- */
    Object.assign(this.anchors, {
      bLox: new THREE.Vector3(0, 22, R), bCh4: new THREE.Vector3(0, 50, R), downcomer: new THREE.Vector3(0, 20, 0.45),
      engines: new THREE.Vector3(0, 0.0, 0), fins: new THREE.Vector3(0, B.fins, R + 3), hsr: new THREE.Vector3(0, (B.hsr0 + B.hsr1) / 2, R),
      sLox: new THREE.Vector3(0, S0 + 12, R), sCh4: new THREE.Vector3(0, S0 + 25, R), bay: new THREE.Vector3(0, S.bay0 + 6, R), nose: new THREE.Vector3(0, S.top - 3, 2),
      sEngines: new THREE.Vector3(0, S0 + 0.5, 0), puck: new THREE.Vector3(0, 3.8, 0),
    })

    cut.collect(this.root)
    this.root.traverse((o) => { o.frustumCulled = false })
  }
  noseR: (y: number) => number = () => 0

  /** liquid, ullage gas and the surface for one tank */
  private tank(k: BuiltTank, parent: THREE.Group, idx: 0 | 1 | 2 | 3) {
    const g = tankSolid(k)
    const liq = new THREE.Mesh(g, liquid(this.cut, k.kind, idx))
    liq.userData.fluid = k.kind
    parent.add(liq); this.fluids.push(liq)
    const gas = new THREE.Mesh(g, liquid(this.cut, k.kind === 'lox' ? 'oxgas' : 'fuelgas', idx, true))
    gas.userData.fluid = k.kind === 'lox' ? 'oxgas' : 'fuelgas'
    gas.renderOrder = 2
    parent.add(gas); this.fluids.push(gas)
    const s = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), liquidSurface(this.cut, k.kind))
    s.userData.fluid = k.kind
    parent.add(s)
    this.surfaces.push({ mesh: s, tank: k, idx })
  }

  /** a V3 grid fin: a steel lattice in a frame, about 2.8 m out and 3.8 m wide */
  private gridFin() {
    const W = 3.8, L = 2.9, Hh = 0.55, t = 0.035, sp = 0.3
    const gs: THREE.BufferGeometry[] = []
    // frame
    gs.push(box(L, Hh, 0.12, L / 2 + 0.3, 0, -W / 2), box(L, Hh, 0.12, L / 2 + 0.3, 0, W / 2), box(0.14, Hh, W, 0.3, 0, 0), box(0.12, Hh, W, L + 0.3, 0, 0))
    gs.push(box(0.6, Hh * 0.8, 0.9, 0.0, 0, 0))
    // diagonal webs, clipped to the frame
    const x0 = 0.3, x1 = 0.3 + L, z0 = -W / 2, z1 = W / 2
    for (const s of [1, -1]) {
      for (let c = -8; c <= 8; c += sp) {
        // line: z = s * (x - x0) + c
        const pts: [number, number][] = []
        const test = (x: number, z: number) => { if (x >= x0 - 1e-6 && x <= x1 + 1e-6 && z >= z0 - 1e-6 && z <= z1 + 1e-6) pts.push([x, z]) }
        test(x0, c); test(x1, s * (x1 - x0) + c)
        test(x0 + (z0 - c) / s, z0); test(x0 + (z1 - c) / s, z1)
        if (pts.length < 2) continue
        pts.sort((a, b) => a[0] - b[0])
        const [a, b] = [pts[0], pts[pts.length - 1]]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (len < 0.05) continue
        const g = new THREE.BoxGeometry(len, Hh * 0.92, t)
        g.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]))
        g.translate((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2)
        gs.push(g)
      }
    }
    return mergeGeometries(gs.map((g) => g.toNonIndexed()))!
  }

  /** forward or aft flaps: flat, black tiles on the windward face */
  private flap(parent: THREE.Group, M: { flapTiles: THREE.Material; steelBare: THREE.Material }, aft: boolean) {
    const sh = new THREE.Shape()
    if (aft) { sh.moveTo(0, 0.6); sh.lineTo(3.3, 1.2); sh.lineTo(3.3, 7.6); sh.lineTo(0, 10.2) }
    else { sh.moveTo(0, 0.4); sh.lineTo(2.3, 1.4); sh.lineTo(2.1, 4.6); sh.lineTo(0, 6.0) }
    const g0 = new THREE.ExtrudeGeometry(sh, { depth: 0.28, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 2 })
    g0.translate(0, 0, -0.14)
    for (const s of [1, -1]) {
      const a = aft ? s * 90 * D : s * 118 * D
      const g = g0.clone()
      // flaps in front sit on the curving nose, so they lean in with it
      const yBase = aft ? S0 : S.nose0 + 0.8
      const r0 = aft ? R - 0.05 : this.noseR(yBase - S.nose0 + 3) - 0.05
      if (!aft) g.rotateZ(0.16)
      g.rotateX(0); g.translate(r0, yBase, 0)
      g.rotateY(-a)
      const m = new THREE.Mesh(g, M.flapTiles)
      m.castShadow = true; m.receiveShadow = true
      parent.add(m)
      // hinge fairing
      const hb = new THREE.CapsuleGeometry(0.22, aft ? 9.0 : 5.0, 4, 10)
      hb.translate(r0 + 0.05, yBase + (aft ? 5.4 : 3.4), 0); hb.rotateY(-a)
      parent.add(new THREE.Mesh(hb, M.steelBare))
    }
  }

  /** aerodynamic chines along the edge of the heat shield */
  private chines(parent: THREE.Group, mat: THREE.Material) {
    for (const s of [1, -1]) {
      const a = s * 1.72
      const g = new THREE.BoxGeometry(0.42, S.nose0 - S0 - 9, 0.14, 1, 8, 1)
      g.translate(R + 0.18, S0 + 7.0 + (S.nose0 - S0 - 9) / 2, 0)
      g.rotateY(-a)
      const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true
      parent.add(m)
    }
  }

  /**
   * levels: tonnes of propellant left in each tank, from the flight table;
   * explode 0..1; sep: how far the ship has moved off the booster (m)
   */
  update(o: { bLox: number; bCh4: number; sLox: number; sCh4: number; explode: number; sep: number; cut: number }) {
    const k = TANKS
    const lv = VU.uLevels.value
    lv.set(k.B.lox.level((o.bLox * 1000) / k.B.lox.mass), k.B.ch4.level((o.bCh4 * 1000) / k.B.ch4.mass), k.S.lox.level((o.sLox * 1000) / k.S.lox.mass), k.S.ch4.level((o.sCh4 * 1000) / k.S.ch4.mass))
    for (const s of this.surfaces) {
      const y = lv.getComponent(s.idx)
      const r = Math.sqrt(Math.max(0.01, tankArea(s.tank, y)) / Math.PI) - 0.04
      s.mesh.position.y = y
      s.mesh.scale.set(r, 1, r)
      s.mesh.visible = this.cut.capsOn && r > 0.2
    }
    const e = o.explode * o.explode * (3 - 2 * o.explode)
    for (const p of this.parts) p.group.position.y = p.dy * e * 1.7
    const drop = e * 3.2
    for (const c of [this.bEng, this.sSL, this.sVac]) if (Math.abs(c.drop - drop) > 1e-4) { c.drop = drop; c.sync() }
    for (const m of this.spanning) m.visible = e < 0.02 && (!m.userData.fluid || this.cut.capsOn)
    this.ship.position.y = o.sep
    this.cut.amount = o.cut
    this.cut.update()
    const caps = this.cut.capsOn
    for (const f of this.fluids) if (!f.userData.spans) f.visible = caps
    for (const c of [this.bEng, this.sSL, this.sVac]) c.showFluids(caps)
  }
}
