import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { TBM, type Sim } from './sim'
import { cutify, machineMats, CUT_M, type MachineMats } from './mats'

/**
 * The shield machine, in metres, with the face of the cutterhead at x = 0
 * and the tunnel axis along x. The parent moves it to the face position.
 * Built from lathe profiles and instanced parts so the 64 discs, 32 thrust
 * cylinders and 14 drive motors cost a handful of draw calls.
 */

const TAU = Math.PI * 2

/** a solid of revolution around the x axis from a counter clockwise (radius, x) profile */
export function lathe(prof: [number, number][], segs = 96, phiStart = 0, phiLen = TAU) {
  const g = new THREE.LatheGeometry(prof.map(([r, a]) => new THREE.Vector2(r, a)), segs, phiStart, phiLen)
  g.rotateZ(-Math.PI / 2)
  return g
}
/** a ring (tube with square section) around x between radii, from x0 to x1 */
export function ringGeo(ri: number, ro: number, x0: number, x1: number, segs = 96, ch = 0) {
  if (ch > 0) return lathe([[ri, x0], [ro - ch, x0], [ro, x0 + ch], [ro, x1 - ch], [ro - ch, x1], [ri, x1]], segs)
  return lathe([[ri, x0], [ro, x0], [ro, x1], [ri, x1]], segs)
}
/** a cylinder between two points */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, segs = 16) {
  const d = b.clone().sub(a)
  const g = new THREE.CylinderGeometry(r, r, d.length(), segs)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}
/** a point at radius r and angle th around the x axis (th = 0 is up, +pi/2 toward +z) */
export const polar = (x: number, r: number, th: number) => new THREE.Vector3(x, r * Math.cos(th), r * Math.sin(th))
/** a box placed at radius r and angle th, oriented with the radial direction */
function radialBox(w: number, h: number, d: number, x: number, r: number, th: number) {
  // w along x, h radial, d tangential
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(0, r, 0)
  g.rotateX(th)
  g.translate(x, 0, 0)
  return g
}
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1)

/** one concrete segment: an annular sector of the ring, centred on th = 0, axis along x from 0 to w */
export function segmentGeo(span: number, gap = 0.012) {
  const w = TBM.RING_W - 0.01, ri = TBM.SEG_RI, ro = TBM.SEG_RO, c = 0.03
  const half = span / 2 - gap / ro
  // lathe phi is measured from +z toward +x in its own frame; after the rotation phi = 0 points at +z
  // so a sector centred on "up" (th = 0) starts at phi = -half - pi/2 ... build and then rotate instead
  const g = lathe([[ri + c, 0], [ro - c, 0], [ro, c], [ro, w - c], [ro - c, w], [ri + c, w], [ri, w - c], [ri, c]], Math.max(8, Math.round(span * 40)), -half, half * 2)
  // phi = 0 maps to +z; rotate about x so the sector centre sits at +y
  g.rotateX(-Math.PI / 2)
  return g
}

export class Machine {
  readonly root = new THREE.Group()
  /** the rotating cutterhead */
  readonly head = new THREE.Group()
  readonly mats: MachineMats
  private cylBarrels!: THREE.InstancedMesh
  private cylRods!: THREE.InstancedMesh
  private cylShoes!: THREE.InstancedMesh
  readonly pairs: number[] = [] // angles of the 16 thrust pairs
  readonly erector = new THREE.Group()
  private erArm = new THREE.Group()
  private carried: THREE.Mesh[] = []
  readonly screw = new THREE.Group()
  readonly segNormal: THREE.BufferGeometry
  readonly segKey: THREE.BufferGeometry
  readonly muck: THREE.Mesh
  readonly muckU = { uSpin: { value: 0 }, uMuck: { value: new THREE.Color(0.42, 0.3, 0.2) }, uChurn: { value: 0 } }
  readonly lights: THREE.Mesh[] = []
  /** world space tips of the gauge cutters, local to the head, for the sparks */
  readonly gauge: THREE.Vector3[] = []

  constructor() {
    const M = (this.mats = machineMats())
    this.segNormal = segmentGeo((TAU - (20 / 360) * TAU) / 7)
    this.segKey = segmentGeo((20 / 360) * TAU)
    this.buildHead(M)
    this.root.add(this.head)
    this.buildShield(M)
    this.buildDrive(M)
    this.buildThrust(M)
    this.buildErector(M)
    this.buildScrew(M)
    // the excavation chamber, full of conditioned spoil churned by the head
    const muckMat = cutify(new THREE.MeshStandardMaterial({ color: 0x6b4c33, roughness: 0.92, metalness: 0 }), {
      cap: 0x5a3f2a, capMetal: 0, bump: 1.2, bumpScale: 40, hl: 'muck', hlColor: 0xffb347, uniforms: this.muckU,
      pars: 'uniform float uSpin, uChurn; uniform vec3 uMuck;',
      color: /* glsl */ `{
        vec2 yz = vOP.yz; float r = length(yz); float a = atan(yz.y, yz.x) - uSpin;
        vec3 q = vec3(vOP.x * 2.0, r * 1.6, 0.0) + vec3(cos(a), sin(a), 0.0) * r * 0.9;
        float n = tb_fbm(q * 2.2 + vec3(0.0, 0.0, uChurn));
        float streak = tb_fbm(vec3(a * 6.0, r * 3.0, vOP.x * 4.0 + uChurn * 0.3));
        vec3 c = uMuck * (0.65 + 0.6 * n) * (0.85 + 0.3 * streak);
        c = mix(c, vec3(0.9, 0.92, 0.95), smoothstep(0.72, 0.9, tb_n(q * 9.0)) * 0.35); // foam
        diffuseColor.rgb = c;
      }`,
    })
    this.muck = new THREE.Mesh(ringGeo(0.95, 5.78, -1.64, -0.08, 96), muckMat)
    this.root.add(this.muck)
    this.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  }

  /* ------------------------------------------------------------ cutterhead */
  private buildHead(M: MachineMats) {
    const H = this.head
    const yellow: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = []
    // rim with an overcut lip, and a bucket ring behind it
    yellow.push(lathe([[5.48, -0.62], [5.99, -0.62], [5.99, -0.08], [5.93, 0], [5.48, 0]], 128))
    // inner ring tying the arms together, and the hub with its nose cone
    yellow.push(ringGeo(2.65, 3.0, -1.0, 0, 96, 0.04))
    yellow.push(lathe([[0.001, -1.3], [1.15, -1.3], [1.15, -0.05], [0.9, 0.06], [0.4, 0.14], [0.001, 0.16]], 64))
    // six main arms and six half arms, open between them (about 35% open)
    for (let k = 0; k < 6; k++) {
      const th = (k / 6) * TAU
      yellow.push(radialBox(1.3, 4.45, 0.78, -0.65, 1.0 + 4.45 / 2, th))
      dark.push(radialBox(0.18, 4.45, 0.84, -0.04, 1.0 + 4.45 / 2, th)) // wear plate on the arm face
      const th2 = th + TAU / 12
      yellow.push(radialBox(1.1, 2.6, 0.6, -0.55, 2.95 + 2.6 / 2, th2))
      dark.push(radialBox(0.16, 2.6, 0.66, -0.04, 2.95 + 2.6 / 2, th2))
      // back braces into the chamber: these are also the mixing arms
      yellow.push(rod(polar(-1.3, 1.6, th), polar(-1.55, 1.6, th), 0.18, 10))
      yellow.push(rod(polar(-1.3, 4.0, th2), polar(-1.6, 4.0, th2), 0.16, 10))
    }
    const headMesh = new THREE.Mesh(mergeGeometries(yellow), M.head)
    const darkMesh = new THREE.Mesh(mergeGeometries(dark), M.headDark)
    H.add(headMesh, darkMesh)

    // disc cutters: 17 inch rings in their housings, one track every 85 mm
    const disc = lathe([[0.13, -0.03], [0.18, -0.035], [0.205, -0.012], [0.216, 0], [0.205, 0.012], [0.18, 0.035], [0.13, 0.03]], 28)
    // that lathe is around x; turn it so its axis is z (we orient each instance after)
    disc.rotateY(Math.PI / 2)
    const hub = new THREE.CylinderGeometry(0.13, 0.13, 0.11, 18); hub.rotateX(Math.PI / 2)
    const house = new THREE.BoxGeometry(0.32, 0.55, 0.3); house.translate(-0.14, 0, 0)
    type C = { r: number; th: number; tilt: number }
    const cs: C[] = []
    const main = (k: number) => (k / 6) * TAU, half = (k: number) => (k / 6) * TAU + TAU / 12
    // centre: four twin discs on the nose
    for (let i = 0; i < 4; i++) cs.push({ r: 0.18 + i * 0.2, th: main(i * 3 % 6) + (i % 2 ? 0.25 : -0.25), tilt: 0 })
    // face cutters
    for (let i = 0; i < 56; i++) {
      const r = 1.05 + i * 0.0845
      let th: number
      const slot = (i * 5) % 12
      if (slot % 2 === 1 && r > 3.05) th = half((slot - 1) / 2)
      else th = main(Math.floor(slot / 2))
      cs.push({ r, th: th + (i % 2 ? 0.055 : -0.055), tilt: 0 })
    }
    // gauge cutters leaning out to cut the full diameter
    for (let i = 0; i < 4; i++) cs.push({ r: 5.74 + i * 0.045, th: main(i + 1) + 0.12, tilt: 0.3 + i * 0.16 })
    const discs = new THREE.InstancedMesh(disc, M.cutter, cs.length)
    const hubs = new THREE.InstancedMesh(hub, M.cutterHub, cs.length)
    const houses = new THREE.InstancedMesh(house, M.headDark, cs.length)
    cs.forEach((c, i) => {
      // the disc plane holds the radial direction and the axis; its own axis is tangential
      const radial = new THREE.Vector3(0, Math.cos(c.th), Math.sin(c.th))
      const tang = new THREE.Vector3(0, -Math.sin(c.th), Math.cos(c.th))
      const basis = new THREE.Matrix4().makeBasis(radial.clone().cross(tang).normalize(), radial, tang)
      q.setFromRotationMatrix(basis)
      // tilt gauge cutters about the tangential axis, outward
      if (c.tilt) q.premultiply(new THREE.Quaternion().setFromAxisAngle(tang, -c.tilt))
      v.copy(radial).multiplyScalar(c.r); v.x = 0.15 - 0.216 + (c.tilt ? -0.05 : 0)
      m4.compose(v, q, s); discs.setMatrixAt(i, m4); hubs.setMatrixAt(i, m4)
      v.x -= 0.0
      m4.compose(v, q, s); houses.setMatrixAt(i, m4)
      if (c.tilt) this.gauge.push(radial.clone().multiplyScalar(c.r + 0.2).setX(0.12))
    })
    H.add(discs, hubs, houses)

    // scrapers (carbide teeth) along both edges of every arm
    const tooth = mergeGeometries([new THREE.BoxGeometry(0.22, 0.28, 0.12).translate(-0.06, 0, 0), new THREE.BoxGeometry(0.06, 0.26, 0.1).translate(0.07, 0, 0)])
    const tm: THREE.Matrix4[] = []
    for (let k = 0; k < 12; k++) {
      const isMain = k % 2 === 0
      const th = isMain ? main(k / 2) : half((k - 1) / 2)
      const w = isMain ? 0.39 : 0.3
      const r0 = isMain ? 1.2 : 3.1
      for (let r = r0; r < 5.5; r += 0.34) for (const sgn of [-1, 1]) {
        const p = polar(0.0, r, th).add(new THREE.Vector3(0, -Math.sin(th), Math.cos(th)).multiplyScalar(sgn * (w + 0.02)))
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), th)
        tm.push(new THREE.Matrix4().compose(p, q, s))
      }
    }
    const teeth = new THREE.InstancedMesh(tooth, M.carbide, tm.length)
    tm.forEach((m, i) => teeth.setMatrixAt(i, m))
    H.add(teeth)
    // foam nozzles on the face
    const noz: THREE.BufferGeometry[] = []
    for (let k = 0; k < 6; k++) for (const r of [1.6, 3.4, 4.9]) noz.push(rod(polar(-0.05, r, (k / 6) * TAU + TAU / 24), polar(0.08, r, (k / 6) * TAU + TAU / 24), 0.07, 10))
    H.add(new THREE.Mesh(mergeGeometries(noz), M.steel))
  }

  /* ------------------------------------------------------------ shield */
  private buildShield(M: MachineMats) {
    const R = this.root
    // front, middle and tail shields with an articulation joint
    R.add(new THREE.Mesh(lathe([[5.82, -4.6], [5.975, -4.6], [5.975, -0.75], [5.94, -0.66], [5.82, -0.66]], 128), M.shield))
    R.add(new THREE.Mesh(ringGeo(5.8, 5.962, -8.6, -4.6, 128), M.shieldPaint))
    R.add(new THREE.Mesh(ringGeo(5.76, 5.94, -8.95, -8.6, 128), M.darkSteel))
    R.add(new THREE.Mesh(lathe([[5.84, -12.5], [5.9, -12.5], [5.925, -12.4], [5.925, -8.95], [5.84, -8.95]], 128), M.shield))
    // weld seams and stiffener rings inside
    const st: THREE.BufferGeometry[] = []
    for (const x of [-1.2, -2.6, -4.6, -6.6, -8.6]) st.push(ringGeo(5.55, 5.82, x - 0.12, x + 0.12, 96))
    R.add(new THREE.Mesh(mergeGeometries(st), M.steel))
    // tail seal: three rows of wire brushes with grease between
    const br: THREE.BufferGeometry[] = []
    for (const x of [-11.4, -11.85, -12.3]) br.push(ringGeo(5.71, 5.84, x - 0.12, x + 0.12, 96))
    R.add(new THREE.Mesh(mergeGeometries(br), M.rubber))
    // grout pipes in the tail skin
    const gp: THREE.BufferGeometry[] = []
    for (let k = 0; k < 6; k++) gp.push(rod(polar(-9.2, 5.8, (k / 6) * TAU + 0.3), polar(-12.45, 5.8, (k / 6) * TAU + 0.3), 0.06, 8))
    R.add(new THREE.Mesh(mergeGeometries(gp), M.orange))
    // bulkhead: the pressure wall between the chamber and the people
    R.add(new THREE.Mesh(lathe([[0.001, -1.98], [5.82, -1.98], [5.82, -1.66], [0.001, -1.66]], 96), M.shieldPaint))
    // centre rotary joint, man lock and pressure sensors on the bulkhead
    R.add(new THREE.Mesh(rod(new THREE.Vector3(-1.98, 0, 0), new THREE.Vector3(-4.2, 0, 0), 0.6, 24), M.steel))
    const lock = mergeGeometries([
      rod(polar(-2.0, 2.55, 0.55), polar(-6.4, 2.55, 0.55), 0.8, 32),
      rod(polar(-6.3, 2.55, 0.55), polar(-6.5, 2.55, 0.55), 0.88, 32),
      rod(polar(-1.99, 2.55, 0.55), polar(-2.2, 2.55, 0.55), 0.88, 32),
    ])
    R.add(new THREE.Mesh(lock, M.white))
    const sens: THREE.BufferGeometry[] = []
    for (let k = 0; k < 5; k++) sens.push(rod(polar(-1.98, 2.2 + k * 0.7, -1.2 + k * 0.5), polar(-2.25, 2.2 + k * 0.7, -1.2 + k * 0.5), 0.09, 10))
    R.add(new THREE.Mesh(mergeGeometries(sens), M.orange))
    // a thrust ring the cylinders hang from
    R.add(new THREE.Mesh(ringGeo(4.85, 5.82, -4.95, -4.55, 96), M.steel))
    // work lights in the shield
    const lg: THREE.BufferGeometry[] = []
    for (let k = 0; k < 8; k++) {
      const g = new THREE.BoxGeometry(1.0, 0.07, 0.14); g.translate(0, 5.5, 0); g.rotateX(-1.1 - k * 0.12); g.translate(-6.2 - (k % 2) * 3, 0, 0)
      lg.push(g)
    }
    const lamps = new THREE.Mesh(mergeGeometries(lg), M.lamp)
    this.lights.push(lamps)
    R.add(lamps)
  }

  /* ------------------------------------------------------------ main drive */
  private buildDrive(M: MachineMats) {
    const R = this.root
    R.add(new THREE.Mesh(lathe([[2.0, -3.4], [4.75, -3.4], [4.75, -2.15], [4.5, -1.98], [2.0, -1.98]], 96), M.darkSteel))
    // the main bearing ring, machined bright
    R.add(new THREE.Mesh(ringGeo(3.1, 3.45, -3.55, -3.38, 96), M.steel))
    // 14 motors with gearboxes
    const body = mergeGeometries([
      rod(new THREE.Vector3(-3.4, 0, 0), new THREE.Vector3(-3.95, 0, 0), 0.3, 20),
      rod(new THREE.Vector3(-3.95, 0, 0), new THREE.Vector3(-5.35, 0, 0), 0.36, 24),
      rod(new THREE.Vector3(-5.35, 0, 0), new THREE.Vector3(-5.5, 0, 0), 0.31, 24),
    ])
    const fins = new THREE.CylinderGeometry(0.39, 0.39, 0.06, 24); fins.rotateZ(Math.PI / 2)
    const finG = mergeGeometries([0, 1, 2, 3, 4, 5].map(i => fins.clone().translate(-4.1 - i * 0.2, 0, 0)))
    const motors = new THREE.InstancedMesh(body, M.motor, TBM.MOTORS)
    const finM = new THREE.InstancedMesh(finG, M.motor, TBM.MOTORS)
    const cap = new THREE.InstancedMesh(rod(new THREE.Vector3(-5.5, 0, 0), new THREE.Vector3(-5.62, 0, 0), 0.22, 18), M.orange, TBM.MOTORS)
    for (let i = 0; i < TBM.MOTORS; i++) {
      const th = (i / TBM.MOTORS) * TAU + 0.11
      m4.makeTranslation(0, 4.05 * Math.cos(th), 4.05 * Math.sin(th))
      motors.setMatrixAt(i, m4); finM.setMatrixAt(i, m4); cap.setMatrixAt(i, m4)
    }
    R.add(motors, finM, cap)
  }

  /* ------------------------------------------------------------ thrust cylinders */
  private buildThrust(M: MachineMats) {
    const n = 16
    for (let k = 0; k < n; k++) this.pairs.push((k / n) * TAU + TAU / (2 * n))
    const barrel = mergeGeometries([
      rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-3.5, 0, 0), 0.16, 18),
      rod(new THREE.Vector3(0.05, 0, 0), new THREE.Vector3(-0.25, 0, 0), 0.2, 18),
      rod(new THREE.Vector3(-3.3, 0, 0), new THREE.Vector3(-3.5, 0, 0), 0.19, 18),
    ])
    // unit length rod along -x, scaled per frame
    const r = rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1, 0, 0), 0.105, 14)
    const shoe = new THREE.BoxGeometry(0.22, 0.42, 0.78); shoe.translate(-0.11, 0, 0)
    this.cylBarrels = new THREE.InstancedMesh(barrel, M.barrel, n * 2)
    this.cylRods = new THREE.InstancedMesh(r, M.chrome, n * 2)
    this.cylShoes = new THREE.InstancedMesh(shoe, M.darkSteel, n)
    this.root.add(this.cylBarrels, this.cylRods, this.cylShoes)
  }

  /* ------------------------------------------------------------ erector */
  private buildErector(M: MachineMats) {
    const E = this.erector
    // a ring erector: the wheel turns on rollers, the centre stays free for the screw
    E.add(new THREE.Mesh(ringGeo(3.95, 4.45, -8.35, -7.85, 96, 0.03), M.erector))
    const rollers: THREE.BufferGeometry[] = []
    for (let k = 0; k < 8; k++) rollers.push(rod(polar(-7.7, 4.62, (k / 8) * TAU), polar(-8.5, 4.62, (k / 8) * TAU), 0.16, 12))
    E.add(new THREE.Mesh(mergeGeometries(rollers), M.darkSteel))
    const A = this.erArm
    // two axial beams from the wheel back over the new ring, a counterweight opposite
    A.add(new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(3.0, 0.42, 0.42).translate(-9.4, 4.2, 0.6),
      new THREE.BoxGeometry(3.0, 0.42, 0.42).translate(-9.4, 4.2, -0.6),
      new THREE.BoxGeometry(0.5, 0.5, 1.7).translate(-10.7, 4.2, 0),
      new THREE.BoxGeometry(0.7, 0.7, 1.4).translate(-8.1, -4.15, 0),
    ]), M.erector))
    // telescope barrels on the beams
    A.add(new THREE.Mesh(mergeGeometries([
      rod(new THREE.Vector3(-10.0, 3.9, 0.6), new THREE.Vector3(-10.0, 4.55, 0.6), 0.17, 14),
      rod(new THREE.Vector3(-10.0, 3.9, -0.6), new THREE.Vector3(-10.0, 4.55, -0.6), 0.17, 14),
    ]), M.barrel))
    const grip = new THREE.Group()
    grip.name = 'grip'
    grip.add(new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(1.5, 0.14, 1.7).translate(-10.0, -0.07, 0),
      rod(new THREE.Vector3(-10.0, -0.1, 0.6), new THREE.Vector3(-10.0, -1.1, 0.6), 0.1, 12),
      rod(new THREE.Vector3(-10.0, -0.1, -0.6), new THREE.Vector3(-10.0, -1.1, -0.6), 0.1, 12),
    ]), M.chrome))
    // the segment being carried, one of each kind; only one shows
    const segMat = cutify(new THREE.MeshStandardMaterial({ color: 0xbdb8ad, roughness: 0.82 }), { cap: 0x9c978d, capMetal: 0, bump: 0.5, bumpScale: 70, hl: 'ring', hlColor: 0x7cf0c0 })
    for (const geo of [this.segNormal, this.segKey]) {
      const m = new THREE.Mesh(geo, segMat)
      m.position.set(-11.0, -TBM.SEG_RI, 0)
      grip.add(m)
      this.carried.push(m)
    }
    A.add(grip)
    // warning beacon
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa21a, emissiveIntensity: 1 }))
    beacon.position.set(-8.0, 4.55, 0.0)
    beacon.name = 'beacon'
    A.add(beacon)
    E.add(A)
    this.root.add(E)
  }

  /* ------------------------------------------------------------ screw conveyor */
  readonly screwA = new THREE.Vector3(-1.75, -4.55, -0.9)
  readonly screwB = new THREE.Vector3(-16.2, -0.9, -0.9)
  private buildScrew(M: MachineMats) {
    const a = this.screwA, b = this.screwB
    const len = a.distanceTo(b)
    const S = this.screw
    // tube along local x from 0 to -len, then the group is aimed from a to b
    S.add(new THREE.Mesh(ringGeo(0.62, 0.72, -len, 0.3, 48), M.screwTube))
    const fl: THREE.BufferGeometry[] = []
    for (const x of [-len * 0.3, -len * 0.62]) fl.push(ringGeo(0.6, 0.86, x - 0.08, x + 0.08, 48))
    S.add(new THREE.Mesh(mergeGeometries(fl), M.darkSteel))
    // the flight: a helicoid around a shaft, rotated as a unit
    const turns = len / 0.75, steps = Math.round(turns * 40)
    const pos: number[] = [], idx: number[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, ang = t * turns * TAU, x = -t * len
      for (const rr of [0.2, 0.6]) pos.push(x, rr * Math.cos(ang), rr * Math.sin(ang))
      if (i < steps) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3) }
    }
    const hel = new THREE.BufferGeometry()
    hel.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hel.setIndex(idx); hel.computeVertexNormals()
    const flight = new THREE.Group()
    flight.name = 'flight'
    flight.add(new THREE.Mesh(hel, M.screwFlight))
    flight.add(new THREE.Mesh(rod(new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(-len, 0, 0), 0.2, 16), M.screwFlight))
    S.add(flight)
    // the drive at the top and the discharge gate dropping onto the belt
    S.add(new THREE.Mesh(rod(new THREE.Vector3(-len, 0, 0), new THREE.Vector3(-len - 1.1, 0, 0), 0.55, 24), M.motor))
    const gate = new THREE.BoxGeometry(0.9, 1.0, 0.9); gate.translate(-len + 0.6, -0.8, 0)
    S.add(new THREE.Mesh(gate, M.screwTube))
    S.position.copy(a)
    S.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), b.clone().sub(a).normalize())
    this.root.add(S)
  }

  /** where along the screw a spoil chunk is, 0 at the inlet, 1 at the gate */
  screwPoint(u: number, out: THREE.Vector3) { return out.copy(this.screwA).lerp(this.screwB, u) }

  /** lay the thrust cylinders and erector out for the current stroke and ring build */
  pose(sim: Sim, t: number) {
    const stroke = sim.stroke
    const ring = sim.phase === 'ring'
    const order = BUILD_ORDER
    const rot = ringRot(sim.rings + 1)
    const n = this.pairs.length
    // the cylinders: shoe on the old ring face, or on the new ring once its segment is in
    for (let k = 0; k < n; k++) {
      const th = this.pairs[k]
      let xs = -9 - stroke // shoe on the last ring
      if (ring) {
        // which segment covers this pair in the ring being built
        const segIdx = segmentAt(th - rot)
        const when = order.indexOf(segIdx)
        const f = THREE.MathUtils.clamp(sim.build - when, 0, 1)
        const retract = THREE.MathUtils.smoothstep(f, 0, 0.18)
        const extend = THREE.MathUtils.smoothstep(f, 0.82, 1)
        xs = THREE.MathUtils.lerp(-11, -8.75, retract)
        xs = THREE.MathUtils.lerp(xs, -9.0, extend)
      }
      const len = -8.4 - xs
      for (const side of [-1, 1]) {
        const i = k * 2 + (side > 0 ? 1 : 0)
        const p = polar(0, 5.43, th).add(new THREE.Vector3(0, -Math.sin(th), Math.cos(th)).multiplyScalar(side * 0.22))
        m4.makeTranslation(-4.9, p.y, p.z); this.cylBarrels.setMatrixAt(i, m4)
        m4.compose(new THREE.Vector3(-8.4, p.y, p.z), q.identity(), new THREE.Vector3(len, 1, 1)); this.cylRods.setMatrixAt(i, m4)
      }
      const p = polar(xs, 5.47, th)
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), th)
      m4.compose(p, q, s); this.cylShoes.setMatrixAt(k, m4)
    }
    this.cylBarrels.instanceMatrix.needsUpdate = true
    this.cylRods.instanceMatrix.needsUpdate = true
    this.cylShoes.instanceMatrix.needsUpdate = true

    // the erector: park on top while boring; in a ring build fetch each segment from the feeder at the invert
    let phi = 0, ext = 0, show = -1, slide = 0
    if (ring && sim.build < order.length) {
      const k = Math.floor(sim.build)
      const f = sim.build - k
      const seg = order[k]
      const target = segCentre(seg) + rot
      show = seg === 7 ? 1 : 0
      slide = 1 - THREE.MathUtils.smoothstep(f, 0.0, 0.14)
      phi = shortLerp(Math.PI, target, THREE.MathUtils.smoothstep(f, 0.16, 0.55))
      ext = THREE.MathUtils.smoothstep(f, 0.58, 0.8)
      if (f > 0.82) { show = -1; ext = 1 - THREE.MathUtils.smoothstep(f, 0.84, 1) }
    } else if (ring) phi = 0
    this.erArm.rotation.x = phi
    const grip = this.erArm.getObjectByName('grip')!
    // at full extension the carried segment lands exactly in its place in the ring
    grip.position.set(0, TBM.SEG_RI - 0.6 * (1 - ext), 0)
    for (let i = 0; i < 2; i++) { this.carried[i].visible = show === i; this.carried[i].position.x = -11.0 - slide * 2.2 }
    const beacon = this.erArm.getObjectByName('beacon') as THREE.Mesh
    ;(beacon.material as THREE.MeshStandardMaterial).emissiveIntensity = ring ? 4 + 10 * Math.max(0, Math.sin(t * 9)) : 0.3
  }
}

/** segments in the ring: 0..6 the seven big ones from the key clockwise, 7 the key at the top */
export const BUILD_ORDER = [3, 2, 4, 1, 5, 0, 6, 7]
const BIG = (TAU - (20 / 360) * TAU) / 7
export function segCentre(i: number) { return i === 7 ? 0 : (10 / 360) * TAU + BIG * (i + 0.5) }
/** which segment covers an angle (0 = top) */
export function segmentAt(th: number) {
  let a = ((th % TAU) + TAU) % TAU
  const k = (10 / 360) * TAU
  if (a < k || a > TAU - k) return 7
  return Math.min(6, Math.floor((a - k) / BIG))
}
/** each ring is turned so its joints do not line up with the last one */
export function ringRot(n: number) { return n % 2 ? (22.5 / 360) * TAU : -(22.5 / 360) * TAU }
function shortLerp(a: number, b: number, u: number) {
  let d = ((b - a) % TAU + TAU) % TAU
  if (d > Math.PI) d -= TAU
  return a + d * u
}

export { CUT_M }
