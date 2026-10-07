import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { TBM, type Sim, type Ground } from './sim'
import { tunnelMats, cutify, CUT_M, CUT_T, dotTexture, type TunnelMats } from './mats'
import { lathe, ringGeo, rod, polar, segmentGeo, segCentre, ringRot, BUILD_ORDER, type Machine } from './machine'

/**
 * Everything behind the shield, in metres along the tunnel: the finished
 * lining, the grout behind it, and the backup train that follows the machine
 * (four gantries with the control cabin, grout and foam tanks, transformers,
 * the cable reel, the belt conveyor and the ventilation duct). Plus the spoil
 * that travels from the face through the screw onto the belt, and the sparks
 * of the gauge cutters in granite.
 */

const TAU = Math.PI * 2
const MAX_RINGS = 46
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1)

export class Tunnel {
  readonly root = new THREE.Group()
  /** moves with the face */
  readonly backup = new THREE.Group()
  readonly mats: TunnelMats
  private normal: THREE.InstancedMesh
  private key: THREE.InstancedMesh
  private bolts: THREE.InstancedMesh
  private grout: THREE.Mesh
  private fresh: THREE.Mesh
  readonly lamps: THREE.PointLight[] = []
  private workers: { g: THREE.Group; x0: number; walk: number; ph: number }[] = []
  private chunks: THREE.InstancedMesh
  private chunkU: Float32Array
  private chunkSeed: Float32Array
  private chunkCol: THREE.Color[] = []
  private sparks: THREE.Points
  private sparkV: Float32Array
  private sparkL: Float32Array
  sparkLight: THREE.PointLight
  private beltMat!: THREE.MeshStandardMaterial
  readonly freshU = { value: 0 }

  constructor(private machine: Machine) {
    const T = (this.mats = tunnelMats())
    this.root.add(this.backup)
    // the lining: seven segments and a key per ring
    this.normal = new THREE.InstancedMesh(segmentGeo((TAU - (20 / 360) * TAU) / 7), T.segment, MAX_RINGS * 7)
    this.key = new THREE.InstancedMesh(segmentGeo((20 / 360) * TAU), T.key, MAX_RINGS)
    this.normal.castShadow = this.key.castShadow = true
    this.normal.receiveShadow = this.key.receiveShadow = true
    // bolt pockets along the ring joints
    const pocket = new THREE.BoxGeometry(0.28, 0.06, 0.16)
    pocket.translate(0, TBM.SEG_RI + 0.015, 0)
    this.bolts = new THREE.InstancedMesh(pocket, T.dark, MAX_RINGS * 16)
    this.root.add(this.normal, this.key, this.bolts)
    // grout annulus behind the tail, and the band still setting
    this.grout = new THREE.Mesh(lathe([[TBM.SEG_RO, 0], [6.0, 0], [6.0, 1], [TBM.SEG_RO, 1]], 96, Math.PI / 2, Math.PI), T.grout)
    this.root.add(this.grout)
    const freshMat = cutify(new THREE.MeshStandardMaterial({ color: 0x9db08f, roughness: 0.4, emissive: 0x7cf0c0, emissiveIntensity: 0 }), { cut: CUT_T, cap: 0x7f9070, capMetal: 0 })
    this.fresh = new THREE.Mesh(lathe([[TBM.SEG_RO + 0.005, 0], [5.995, 0], [5.995, 1], [TBM.SEG_RO + 0.005, 1]], 96, Math.PI / 2, Math.PI), freshMat)
    this.root.add(this.fresh)

    this.buildBackup(T)
    this.buildWorkers(T)

    // spoil chunks
    const n = 520
    const rock = new THREE.IcosahedronGeometry(0.16, 0)
    this.chunks = new THREE.InstancedMesh(rock, cutify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), { cut: CUT_M, cap: 0x6b4c33, capMetal: 0, hl: 'muck', hlColor: 0xffb347 }), n)
    this.chunks.castShadow = true
    this.chunkU = new Float32Array(n)
    this.chunkSeed = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      this.chunkU[i] = i / n
      for (let k = 0; k < 4; k++) this.chunkSeed[i * 4 + k] = Math.random()
      this.chunkCol.push(new THREE.Color(0.36, 0.25, 0.17))
      this.chunks.setColorAt(i, this.chunkCol[i])
    }
    this.backup.add(this.chunks)

    // sparks
    const sn = 360
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sn * 3), 3))
    sg.setAttribute('a', new THREE.BufferAttribute(new Float32Array(sn), 1))
    this.sparkV = new Float32Array(sn * 3)
    this.sparkL = new Float32Array(sn)
    const sm = new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTexture() }, uScale: { value: 300 } },
      vertexShader: `attribute float a; varying float vA; uniform float uScale; void main(){ vA = a; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(14.0, uScale * (0.3 + a) / -mv.z); }`,
      fragmentShader: `uniform sampler2D map; varying float vA; void main(){ if (vA <= 0.0) discard; float m = texture2D(map, gl_PointCoord).r; vec3 c = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.9, 0.6), vA); gl_FragColor = vec4(c * m * (2.0 + 6.0 * vA), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    this.sparks = new THREE.Points(sg, sm)
    this.sparks.frustumCulled = false
    this.root.add(this.sparks)
    this.sparkLight = new THREE.PointLight(0xff8a2a, 0, 0.6, 2)
  }

  /* ------------------------------------------------------------ backup train */
  private buildBackup(T: TunnelMats) {
    const B = this.backup
    const far = -260 // the train and services go back further than the block; the clip hides the rest
    // invert fill, sleepers and rails
    B.add(new THREE.Mesh(new THREE.BoxGeometry(-far - 12, 0.5, 5.4).translate((far - 12) / 2 + -6, -4.95, 0), T.grout))
    const sl: THREE.BufferGeometry[] = []
    for (let x = -13; x > -150; x -= 1.2) sl.push(new THREE.BoxGeometry(0.25, 0.16, 5.0).translate(x, -4.62, 0))
    B.add(new THREE.Mesh(mergeGeometries(sl), T.dark))
    const rails: THREE.BufferGeometry[] = []
    for (const z of [-2.0, 2.0, -0.75, 0.75]) rails.push(new THREE.BoxGeometry(-far, 0.2, 0.14).translate(far / 2 - 12, -4.44, z))
    B.add(new THREE.Mesh(mergeGeometries(rails), T.steel))

    // four gantries on rails, 11 m each, starting behind the bridge
    const frame: THREE.BufferGeometry[] = [], deck: THREE.BufferGeometry[] = [], rail: THREE.BufferGeometry[] = [], wheel: THREE.BufferGeometry[] = []
    const lampG: THREE.BufferGeometry[] = []
    const G0 = -17
    for (let gi = 0; gi < 4; gi++) {
      const xa = G0 - gi * 12, xb = xa - 11
      for (let x = xa; x >= xb - 0.01; x -= 3.666) {
        for (const z of [-3.5, 3.5]) {
          frame.push(new THREE.BoxGeometry(0.28, 7.6, 0.28).translate(x, -0.6, z))
          wheel.push(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 16).rotateX(Math.PI / 2).translate(x + 0.4, -4.1, z * 0.57))
          wheel.push(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 16).rotateX(Math.PI / 2).translate(x - 0.4, -4.1, z * 0.57))
        }
        frame.push(new THREE.BoxGeometry(0.3, 0.4, 7.3).translate(x, 3.1, 0))
        frame.push(new THREE.BoxGeometry(0.3, 0.3, 7.3).translate(x, -1.75, 0))
        frame.push(new THREE.BoxGeometry(0.3, 0.3, 4.4).translate(x, -3.9, 0))
      }
      for (const z of [-3.5, 3.5]) {
        frame.push(new THREE.BoxGeometry(11, 0.32, 0.28).translate((xa + xb) / 2, 3.1, z))
        frame.push(new THREE.BoxGeometry(11, 0.28, 0.28).translate((xa + xb) / 2, -1.75, z))
        frame.push(new THREE.BoxGeometry(11, 0.28, 0.28).translate((xa + xb) / 2, 0.9, z))
      }
      // decks (gratings) and the walkway at the side
      deck.push(new THREE.BoxGeometry(11, 0.08, 7.2).translate((xa + xb) / 2, -1.55, 0))
      deck.push(new THREE.BoxGeometry(11, 0.08, 2.2).translate((xa + xb) / 2, 1.1, -2.5))
      // handrails
      for (const [y, z] of [[-0.5, -3.75], [2.1, -1.35], [-0.95, -3.75], [1.6, -1.35]] as const) rail.push(new THREE.BoxGeometry(11, 0.06, 0.06).translate((xa + xb) / 2, y, z))
      for (let x = xa; x > xb; x -= 1.4) { rail.push(new THREE.BoxGeometry(0.05, 1.05, 0.05).translate(x, -1.0, -3.75)); rail.push(new THREE.BoxGeometry(0.05, 1.0, 0.05).translate(x, 1.6, -1.35)) }
      // strip lights under the top beams
      for (let x = xa - 1.5; x > xb; x -= 3.666) { lampG.push(new THREE.BoxGeometry(1.2, 0.06, 0.12).translate(x, 2.82, -2.6)); lampG.push(new THREE.BoxGeometry(1.2, 0.06, 0.12).translate(x, -1.95, -2.2)) }
    }
    const mesh = (g: THREE.BufferGeometry[], m: THREE.Material) => { const o = new THREE.Mesh(mergeGeometries(g), m); o.castShadow = o.receiveShadow = true; B.add(o); return o }
    mesh(frame, T.gantry)
    mesh(deck, T.dark)
    mesh(rail, T.rail)
    mesh(wheel, T.dark)
    B.add(new THREE.Mesh(mergeGeometries(lampG), T.lamp))

    // bridge from the shield to gantry 1, with the segment feeder under it
    mesh([new THREE.BoxGeometry(5.0, 0.5, 0.4).translate(-14.6, 2.9, -2.6), new THREE.BoxGeometry(5.0, 0.5, 0.4).translate(-14.6, 2.9, 2.6), new THREE.BoxGeometry(0.4, 0.4, 5.6).translate(-12.6, 2.9, 0)], T.gantry)
    mesh([new THREE.BoxGeometry(6.0, 0.3, 2.4).translate(-14.5, -4.1, 0), new THREE.BoxGeometry(6.0, 0.25, 0.25).translate(-14.5, -3.95, -1.1), new THREE.BoxGeometry(6.0, 0.25, 0.25).translate(-14.5, -3.95, 1.1)], T.orange)
    // two segments waiting on the feeder, curved side down
    const wait = segmentGeo((TAU - (20 / 360) * TAU) / 7)
    for (let k = 0; k < 2; k++) {
      const s = new THREE.Mesh(wait, T.segment)
      s.rotation.x = Math.PI
      s.position.set(-16.8, TBM.SEG_RO - 3.95 + k * 0.5, 0)
      s.scale.set(1, 1, 1)
      s.castShadow = true
      B.add(s)
    }

    // equipment on the decks (on the far side, which the cut shows)
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; B.add(o); return o }
    const cyl = (r: number, h: number, x: number, y: number, z: number, m: THREE.Material) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; B.add(o); return o }
    // gantry 1: hydraulic power packs and the control cabin
    box(2.4, 1.4, 1.6, -19.5, -0.8, -2.4, T.cabinet)
    box(2.0, 1.2, 1.4, -22.5, -0.9, -2.5, T.cabinet)
    box(1.2, 1.0, 1.2, -25.5, -1.0, -2.5, T.orange)
    const cab = box(3.6, 2.0, 2.0, -21.5, 2.15, -2.45, T.gantry)
    cab.name = 'cabin'
    const win = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.8, 0.04), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x9fd8ff, emissiveIntensity: 2.2 }))
    win.position.set(-21.5, 2.45, -1.43); B.add(win)
    // gantry 2: grout and foam
    for (const x of [-31.5, -34.2]) { cyl(1.05, 2.6, x, -0.2, -2.3, T.tank); cyl(1.07, 0.15, x, 1.15, -2.3, T.steel) }
    cyl(0.75, 1.8, -37.0, -0.6, -2.6, T.tankBlue)
    cyl(0.75, 1.8, -38.8, -0.6, -2.6, T.tankBlue)
    box(1.6, 0.9, 1.0, -30.0, 1.6, -2.4, T.cabinet)
    // gantry 3: transformers and switchgear
    for (const x of [-43.5, -46.8]) {
      box(2.4, 2.0, 1.9, x, -0.5, -2.35, T.orange)
      for (let k = 0; k < 7; k++) box(0.06, 1.6, 0.4, x - 1.0 + k * 0.33, -0.5, -1.25, T.dark)
    }
    for (let k = 0; k < 5; k++) box(0.9, 1.7, 0.7, -42.6 - k * 1.0, 2.0, -2.5, T.cabinet)
    // gantry 4: cable reel and water tank
    const reel = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(1.7, 1.7, 0.14, 40).translate(0, 0.6, 0), new THREE.CylinderGeometry(1.7, 1.7, 0.14, 40).translate(0, -0.6, 0), new THREE.CylinderGeometry(1.1, 1.1, 1.2, 40)]), T.orange)
    reel.rotation.x = Math.PI / 2; reel.position.set(-56.5, 0.2, -2.5); reel.castShadow = true; B.add(reel)
    cyl(1.15, 1.2, -56.5, 0.2, -2.5, T.cable).rotation.x = Math.PI / 2
    box(3.0, 1.5, 1.8, -52.0, -0.75, -2.45, T.tankBlue)

    // belt conveyor: up from under the screw to the top deck and back out of the tunnel
    const yb = 2.35, zb = -0.9
    const beltPts = [new THREE.Vector3(-15.6, -1.8, zb), new THREE.Vector3(-27, yb, zb), new THREE.Vector3(far, yb, zb)]
    const belt: THREE.BufferGeometry[] = [], idl: THREE.BufferGeometry[] = []
    for (let i = 0; i < beltPts.length - 1; i++) {
      const a = beltPts[i], b = beltPts[i + 1]
      const d = b.clone().sub(a), len = d.length()
      const g = new THREE.BoxGeometry(len, 0.06, 1.2)
      g.rotateZ(Math.atan2(d.y, d.x) + Math.PI)
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, zb)
      belt.push(g)
      const g2 = new THREE.BoxGeometry(len, 0.28, 0.12); g2.rotateZ(Math.atan2(d.y, d.x) + Math.PI)
      for (const dz of [-0.68, 0.68]) belt.push(g2.clone().translate((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.12, zb + dz))
      for (let u = 0; u < len; u += 1.4) { const p = a.clone().addScaledVector(d, u / len); idl.push(rod(new THREE.Vector3(p.x, p.y - 0.12, zb - 0.6), new THREE.Vector3(p.x, p.y - 0.12, zb + 0.6), 0.07, 8)) }
    }
    this.beltMat = T.belt
    mesh(belt, T.belt)
    mesh(idl, T.steel)
    // ventilation duct at the crown with its hoops
    const duct = new THREE.Mesh(rod(new THREE.Vector3(-20, 4.0, -1.35), new THREE.Vector3(far, 4.0, -1.35), 0.85, 36), T.duct)
    duct.castShadow = true
    B.add(duct)
    const hoops: THREE.BufferGeometry[] = []
    for (let x = -21; x > -150; x -= 1.6) hoops.push(ringGeo(0.85, 0.9, x - 0.04, x + 0.04, 32).translate(0, 4.0, -1.35))
    mesh(hoops, T.dark)
    // the duct cassette on gantry 4
    cyl(1.0, 2.2, -60, 4.0, -1.35, T.gantry).rotation.z = Math.PI / 2
    // services on the wall: water in and out, grout, compressed air, power cables
    const pipes: [number, number, THREE.Material][] = [[-1.95, 0.16, T.pipeB], [-2.1, 0.16, T.pipeG], [-2.25, 0.12, T.pipeR], [-2.38, 0.09, T.steel]]
    for (const [th, r, m] of pipes) {
      const p = polar(0, 4.95, th)
      const o = new THREE.Mesh(rod(new THREE.Vector3(-14, p.y, p.z), new THREE.Vector3(far, p.y, p.z), r, 14), m)
      o.castShadow = true; B.add(o)
    }
    const trays: THREE.BufferGeometry[] = []
    for (const th of [-1.2, -1.32]) { const p = polar(0, 5.0, th); trays.push(rod(new THREE.Vector3(-14, p.y, p.z), new THREE.Vector3(far, p.y, p.z), 0.08, 8)) }
    mesh(trays, T.cable)
    // lights that light the tunnel (few, fixed count)
    for (const x of [-20, -36, -52]) {
      const L = new THREE.PointLight(0xffd7a8, 0, 0.7, 2)
      L.position.set(x, 1.6, -2.4)
      L.userData.base = 1
      B.add(L)
      this.lamps.push(L)
    }
    // a segment train waiting further back
    box(9.0, 1.0, 3.6, -70, -3.7, 0, T.orange)
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(wait, T.segment); s.rotation.x = Math.PI; s.position.set(-71.5, TBM.SEG_RO - 3.2 + k * 0.48, 0); s.castShadow = true; B.add(s) }
  }

  /* ------------------------------------------------------------ people for scale */
  private buildWorkers(T: TunnelMats) {
    const make = (x: number, y: number, z: number, rot: number, walk = 0) => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.7, 4, 10).translate(0, 1.0, 0), T.hivis)
      const legs = new THREE.Mesh(mergeGeometries([new THREE.CapsuleGeometry(0.09, 0.6, 4, 8).translate(-0.1, 0.38, 0), new THREE.CapsuleGeometry(0.09, 0.6, 4, 8).translate(0.1, 0.38, 0)]), T.dark)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10).translate(0, 1.58, 0), T.skin)
      const hat = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, TAU, 0, Math.PI / 2).translate(0, 1.62, 0), T.helmet)
      g.add(body, legs, head, hat)
      g.traverse(o => { (o as THREE.Mesh).castShadow = true })
      g.position.set(x, y, z); g.rotation.y = rot
      this.backup.add(g)
      this.workers.push({ g, x0: x, walk, ph: Math.random() * 10 })
    }
    make(-18.4, -1.5, -2.9, Math.PI / 2, 0)
    make(-21.0, 1.15, -2.0, 0.3, 0)
    make(-28, -1.5, -3.0, Math.PI / 2, 1)
    make(-33, -1.5, -1.2, -0.4, 0)
    make(-13.6, -3.95, -1.6, Math.PI / 2, 0)
    make(-45, 1.15, -2.1, -Math.PI / 2, 1)
  }

  /** the path of one spoil chunk, machine local, u in 0..1 */
  private chunkAt(u: number, i: number, head: number, out: THREE.Vector3) {
    const sd = this.chunkSeed
    const r0 = 0.9 + sd[i * 4] * 4.7, a0 = sd[i * 4 + 1] * TAU
    if (u < 0.12) { // swirling down through the chamber with the head
      const f = u / 0.12
      const a = a0 + head * 0.6 + f * 2.0
      const r = THREE.MathUtils.lerp(r0, 4.5, f * f)
      out.set(THREE.MathUtils.lerp(-0.35, -1.5, f), r * Math.cos(a), r * Math.sin(a))
      out.lerp(this.machine.screwA, f * f * f)
      return out
    }
    if (u < 0.4) { // up the screw, turning with the flight
      const f = (u - 0.12) / 0.28
      this.machine.screwPoint(f, out)
      const a = f * 60 + a0
      out.y += Math.cos(a) * 0.35 - 0.1; out.z += Math.sin(a) * 0.35
      return out
    }
    if (u < 0.43) { // dropping out of the gate
      const f = (u - 0.4) / 0.03
      out.copy(this.machine.screwB).add(v.set(0.4, -0.8 - f * 0.5, 0))
      return out
    }
    // riding the belt
    const f = (u - 0.43) / 0.57
    const dz = (sd[i * 4 + 2] - 0.5) * 0.8
    if (f < 0.06) { const g = f / 0.06; return out.set(THREE.MathUtils.lerp(-15.8, -27, g), THREE.MathUtils.lerp(-1.65, 2.5, g), -0.9 + dz) }
    return out.set(-27 - (f - 0.06) / 0.94 * 60, 2.5, -0.9 + dz)
  }

  update(sim: Sim, dt: number, t: number) {
    const xf = sim.xf
    this.backup.position.x = xf
    // finished rings: the newest face sits on the shoes; one more appears segment by segment in a build
    const face = xf - 9 - (sim.phase === 'bore' ? sim.stroke : 2)
    let nN = 0, nK = 0, nB = 0
    const put = (x0: number, ringNo: number, segs: number[]) => {
      const rot = ringRot(ringNo)
      for (const sIdx of segs) {
        const th = segCentre(sIdx) + rot
        q.setFromAxisAngle(v.set(1, 0, 0), th)
        m4.compose(v.set(x0, 0, 0), q, one)
        if (sIdx === 7) this.key.setMatrixAt(nK++, m4); else this.normal.setMatrixAt(nN++, m4)
      }
      for (let k = 0; k < 8; k++) {
        if (nB >= MAX_RINGS * 16) break
        q.setFromAxisAngle(v.set(1, 0, 0), rot + (k / 8) * TAU + 0.2)
        m4.compose(v.set(x0 + 0.3, 0, 0), q, one); this.bolts.setMatrixAt(nB++, m4)
        q.setFromAxisAngle(v.set(1, 0, 0), rot + (k / 8) * TAU - 0.2)
        m4.compose(v.set(x0 + 1.7, 0, 0), q, one); this.bolts.setMatrixAt(nB++, m4)
      }
    }
    const all = [0, 1, 2, 3, 4, 5, 6, 7]
    let k = 0
    for (let x = face - 2; x > TBM.X0 - 2 && k < MAX_RINGS - 1; x -= 2, k++) put(x, sim.rings - k, all)
    if (sim.phase === 'ring') {
      const placed = BUILD_ORDER.filter((_, i) => sim.build - i >= 0.82)
      if (placed.length) put(face, sim.rings + 1, placed)
    }
    this.normal.count = nN; this.key.count = nK; this.bolts.count = nB
    this.normal.instanceMatrix.needsUpdate = true; this.key.instanceMatrix.needsUpdate = true; this.bolts.instanceMatrix.needsUpdate = true
    // grout fills the annulus from the tail back; the last few metres are still setting
    const tail = xf - 12.5
    this.grout.position.x = TBM.X0 - 1
    this.grout.scale.x = Math.max(0.01, tail - 3 - (TBM.X0 - 1))
    this.fresh.position.x = tail - 3
    this.fresh.scale.x = 3
    const fm = this.fresh.material as THREE.MeshStandardMaterial
    fm.emissiveIntensity = this.freshU.value * (0.6 + 0.4 * Math.sin(t * 4))

    // people: a couple of them walk the decks
    for (const w of this.workers) {
      if (w.walk) { w.ph += dt * 0.25; w.g.position.x = w.x0 + Math.sin(w.ph) * 3; w.g.rotation.y = Math.cos(w.ph) > 0 ? Math.PI / 2 : -Math.PI / 2 }
      else w.g.rotation.y += Math.sin(t * 0.7 + w.ph) * dt * 0.1
    }

    // spoil: moves with the inflow; the belt stops while a ring is built
    const flow = sim.phase === 'bore' && sim.running ? Math.min(1.6, sim.rate / 70) : 0
    const n = this.chunkU.length
    const col = groundColor(sim.ground)
    for (let i = 0; i < n; i++) {
      let u = this.chunkU[i] + dt * flow * 0.045 * (0.9 + this.chunkSeed[i * 4 + 3] * 0.2)
      if (u >= 1) { u -= 1; this.chunkCol[i].copy(col).multiplyScalar(0.7 + this.chunkSeed[i * 4 + 2] * 0.6); this.chunks.setColorAt(i, this.chunkCol[i]) }
      this.chunkU[i] = u
      this.chunkAt(u, i, sim.head, v)
      const sc = (sim.ground === 'sand' ? 0.55 : sim.ground === 'granite' ? 0.8 : 1.15) * (0.6 + this.chunkSeed[i * 4] * 0.8)
      q.setFromEuler(new THREE.Euler(this.chunkSeed[i * 4 + 1] * 6, this.chunkSeed[i * 4 + 2] * 6, u * 20))
      m4.compose(v, q, new THREE.Vector3(sc, sc * 0.75, sc))
      this.chunks.setMatrixAt(i, m4)
    }
    this.chunks.instanceMatrix.needsUpdate = true
    if (this.chunks.instanceColor) this.chunks.instanceColor.needsUpdate = true

    // sparks off the gauge cutters in hard rock
    const pos = this.sparks.geometry.attributes.position as THREE.BufferAttribute
    const al = this.sparks.geometry.attributes.a as THREE.BufferAttribute
    const hard = sim.ground === 'granite' && sim.phase === 'bore' && sim.running ? Math.min(1, sim.rpm / 2) : 0
    let spawn = hard * dt * 900
    const headM = this.machine.head.matrixWorld
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert()
    let flick = 0
    for (let i = 0; i < this.sparkL.length; i++) {
      if (this.sparkL[i] > 0) {
        this.sparkL[i] -= dt * 2.2
        this.sparkV[i * 3 + 1] -= dt * 9.8 * 1.2
        pos.setXYZ(i, pos.getX(i) + this.sparkV[i * 3] * dt, pos.getY(i) + this.sparkV[i * 3 + 1] * dt, pos.getZ(i) + this.sparkV[i * 3 + 2] * dt)
        al.setX(i, Math.max(0, this.sparkL[i]))
        flick += this.sparkL[i]
      } else if (spawn > 0) {
        spawn--
        const gpt = this.machine.gauge[Math.floor(Math.random() * this.machine.gauge.length)]
        v.copy(gpt).applyMatrix4(headM).applyMatrix4(inv)
        pos.setXYZ(i, v.x, v.y, v.z)
        const out = v.clone().setX(0).normalize()
        const tang = new THREE.Vector3(0, -out.z, out.y)
        const sp = 4 + Math.random() * 8
        this.sparkV[i * 3] = -1 - Math.random() * 4
        this.sparkV[i * 3 + 1] = (out.y * 0.6 + tang.y * 0.9) * sp + Math.random() * 2
        this.sparkV[i * 3 + 2] = (out.z * 0.6 + tang.z * 0.9) * sp + Math.random() * 3
        this.sparkL[i] = 0.5 + Math.random() * 0.5
        al.setX(i, this.sparkL[i])
      } else al.setX(i, 0)
    }
    pos.needsUpdate = true; al.needsUpdate = true
    this.sparkLight.intensity = Math.min(1, flick / 60) * (0.6 + Math.random() * 0.8) * 0.02
    // belt texture: nothing to scroll, the chunks do the moving
    void this.beltMat
  }
}

export function groundColor(g: Ground) {
  return g === 'clay' ? new THREE.Color(0.36, 0.25, 0.17) : g === 'sand' ? new THREE.Color(0.66, 0.52, 0.3) : new THREE.Color(0.55, 0.52, 0.5)
}
