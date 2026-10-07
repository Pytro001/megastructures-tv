import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { TBM, type Sim, type Ground as GroundKind } from './sim'
import { cutify, NO_CUT } from './mats'
import { lathe } from './machine'

/**
 * The block of ground on the bench, in real metres: 80 m of tunnel route,
 * from 14 m under the axis up to the street 20 m above it, 24 m deep, cut
 * open down the tunnel axis. The strata are one 3D function, so every face
 * of the block agrees. On top: a street with houses, trees and traffic that
 * rides the settlement trough (drawn 20x so a few centimetres can be seen).
 */

export const Y0 = -14, ZB = -24
export const EXAG = 20
const GI: Record<GroundKind, number> = { clay: 0, sand: 1, granite: 2 }

const STRATA = /* glsl */ `
uniform float uXf, uGA, uGB, uGMix;
vec3 horizon(float k, vec3 p, out float bump){
  vec3 c;
  if (k < 0.5) { // stiff clay: blue grey, smooth, with fissures and claystones
    float n = tb_fbm(p * vec3(0.35, 0.9, 0.35));
    c = mix(vec3(0.27, 0.25, 0.23), vec3(0.42, 0.33, 0.25), n);
    c *= 0.85 + 0.25 * smoothstep(0.62, 0.7, tb_n(p * vec3(0.4, 3.0, 0.4)));
    float fis = smoothstep(0.03, 0.0, abs(tb_n(p * 0.7) - 0.5)) * 0.5;
    c *= 1.0 - fis * 0.5;
    bump = n * 0.3 + fis * 0.3;
  } else if (k < 1.5) { // water bearing sand and gravel
    float n = tb_fbm(p * 1.4);
    c = mix(vec3(0.5, 0.39, 0.23), vec3(0.68, 0.55, 0.34), n);
    float lam = 0.5 + 0.5 * sin(p.y * 7.0 + tb_n(p * 0.5) * 6.0);
    c *= 0.9 + 0.12 * lam;
    float peb = smoothstep(0.7, 0.76, tb_n(p * 4.5));
    c = mix(c, vec3(0.55, 0.52, 0.48) * (0.7 + 0.5 * tb_n(p * 20.0)), peb);
    bump = n * 0.4 + peb * 0.8;
  } else { // granite: fine feldspar, quartz and biotite crystals, a few joints
    float n = tb_fbm(p * 0.6);
    c = mix(vec3(0.38, 0.35, 0.35), vec3(0.5, 0.45, 0.44), n);
    float fel = smoothstep(0.62, 0.7, tb_n(p * 16.0 + 7.0));
    c = mix(c, vec3(0.72, 0.53, 0.47), fel * 0.6);
    float qz = smoothstep(0.66, 0.72, tb_n(p * 21.0 + 19.0));
    c = mix(c, vec3(0.8, 0.8, 0.78), qz * 0.5);
    float bio = smoothstep(0.72, 0.78, tb_n(p * 26.0 + 3.0));
    c = mix(c, vec3(0.1, 0.1, 0.11), bio * 0.85);
    float joint = smoothstep(0.015, 0.0, abs(tb_n(p * vec3(0.12, 0.5, 0.12)) - 0.5));
    c *= 1.0 - joint * 0.45;
    bump = n * 0.4 + fel * 0.3 + bio * 0.2 + joint * 0.6;
  }
  return c;
}
vec3 strata(vec3 p, out float bump){
  float w = 0.9 * sin(p.x * 0.07 + 1.3) + 0.5 * sin(p.x * 0.19 + p.z * 0.21) + 1.6 * (tb_fbm(p * 0.05) - 0.5);
  float y = p.y + w;
  vec3 c; bump = 0.0;
  if (y > 18.7) { // topsoil and road base
    c = mix(vec3(0.12, 0.09, 0.07), vec3(0.2, 0.15, 0.1), tb_fbm(p * 2.0)); bump = 0.4;
  } else if (y > 14.2) { // made ground: rubble, brick, old pipes
    float n = tb_fbm(p * 1.2);
    c = mix(vec3(0.27, 0.23, 0.19), vec3(0.38, 0.33, 0.27), n);
    float st = smoothstep(0.7, 0.76, tb_n(p * 7.0));
    c = mix(c, mix(vec3(0.46, 0.44, 0.41), vec3(0.42, 0.26, 0.2), step(0.6, tb_n(p * 3.1 + 4.0))), st * 0.8);
    bump = n * 0.5 + st;
  } else if (y > 8.0) { // terrace sand with a water table near the bottom
    float n = tb_fbm(p * 1.1);
    c = mix(vec3(0.6, 0.47, 0.28), vec3(0.74, 0.6, 0.38), n);
    c *= 0.9 + 0.1 * sin(p.y * 9.0 + n * 4.0);
    c *= mix(0.72, 1.0, smoothstep(9.5, 11.5, y)); // wet below the water table
    bump = n * 0.4;
  } else if (y > -8.5) {
    float b1, b2;
    vec3 a = horizon(uGA, p, b1), b = horizon(uGB, p, b2);
    // the new ground sweeps in from the face outwards when it changes
    c = mix(a, b, uGMix); bump = mix(b1, b2, uGMix);
  } else { // bedrock: dark mudstone
    float n = tb_fbm(p * vec3(0.3, 1.2, 0.3));
    c = mix(vec3(0.16, 0.17, 0.18), vec3(0.27, 0.27, 0.28), n);
    c *= 0.85 + 0.15 * sin(p.y * 4.0 + n * 3.0);
    bump = n * 0.5;
  }
  // a dark wet band just above each boundary
  return c;
}
`

function earthMat(u: Record<string, { value: unknown }>, extraDiscard = '') {
  return cutify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0 }), {
    cut: NO_CUT, uniforms: u, pars: STRATA, bump: 0.0001,
    discard: extraDiscard,
    color: /* glsl */ `{ float bmp; diffuseColor.rgb = strata(vOP, bmp); }`,
  })
}

export class Ground {
  readonly root = new THREE.Group()
  readonly u = { uXf: { value: 0 }, uGA: { value: 0 }, uGB: { value: 0 }, uGMix: { value: 1 } }
  private top: THREE.Mesh
  private topGeo: THREE.PlaneGeometry
  private edges: { geo: THREE.BufferGeometry; z?: number; x?: number }[] = []
  private face: THREE.Mesh
  readonly buildings: { mesh: THREE.Group; x: number; z: number; w: number; d: number; mat: THREE.MeshStandardMaterial; tilt: number }[] = []
  private cars: THREE.InstancedMesh
  private carLights: THREE.InstancedMesh
  private carState: { lane: number; x: number; v: number; c: THREE.Color }[] = []
  readonly street = new THREE.Group()
  private groundNow: GroundKind = 'clay'
  /** the worst building's angular distortion */
  worst = 0
  /** heights of the street above the face, real metres, for the foam */
  surfaceAtFace = 0

  constructor() {
    const R = this.root
    const L = TBM.X1 - TBM.X0
    // the cut face down the tunnel axis, with the bore strip open behind the face
    const front = new THREE.PlaneGeometry(L, TBM.Z0 - Y0, 200, 1)
    front.translate(TBM.X0 + L / 2, (TBM.Z0 + Y0) / 2, 0)
    R.add(new THREE.Mesh(front, earthMat(this.u, 'if (abs(vOP.y) < 6.0 && vOP.x < uXf + 0.15) discard;')))
    this.edges.push({ geo: front, z: 0 })
    // back and ends
    const back = new THREE.PlaneGeometry(L, TBM.Z0 - Y0, 200, 1)
    back.rotateY(Math.PI); back.translate(TBM.X0 + L / 2, (TBM.Z0 + Y0) / 2, ZB)
    R.add(new THREE.Mesh(back, earthMat(this.u)))
    this.edges.push({ geo: back, z: ZB })
    const endA = new THREE.PlaneGeometry(-ZB, TBM.Z0 - Y0, 60, 1)
    endA.rotateY(-Math.PI / 2); endA.translate(TBM.X0, (TBM.Z0 + Y0) / 2, ZB / 2)
    R.add(new THREE.Mesh(endA, earthMat(this.u, 'if (length(vOP.yz) < 6.0) discard;')))
    this.edges.push({ geo: endA, x: TBM.X0 })
    const endB = new THREE.PlaneGeometry(-ZB, TBM.Z0 - Y0, 60, 1)
    endB.rotateY(Math.PI / 2); endB.translate(TBM.X1, (TBM.Z0 + Y0) / 2, ZB / 2)
    R.add(new THREE.Mesh(endB, earthMat(this.u)))
    this.edges.push({ geo: endB, x: TBM.X1 })
    // the bore: the inside of a half cylinder, and the face at its end
    const bore = lathe([[6.0, TBM.X1], [6.0, TBM.X0]], 64, Math.PI / 2, Math.PI)
    R.add(new THREE.Mesh(bore, earthMat(this.u, 'if (vOP.x > uXf + 0.15) discard;')))
    const fg = new THREE.CircleGeometry(6.0, 64, Math.PI / 2, Math.PI)
    fg.rotateY(-Math.PI / 2)
    this.face = new THREE.Mesh(fg, earthMat(this.u))
    R.add(this.face)
    // the street on top
    this.topGeo = new THREE.PlaneGeometry(L, -ZB, 240, 48)
    this.topGeo.rotateX(-Math.PI / 2)
    this.topGeo.translate(TBM.X0 + L / 2, TBM.Z0, ZB / 2)
    this.top = new THREE.Mesh(this.topGeo, new THREE.MeshStandardMaterial({ map: streetTexture(), roughness: 0.78, metalness: 0, emissiveMap: streetGlow(), emissive: 0xffffff, emissiveIntensity: 0.0 }))
    this.top.receiveShadow = true
    R.add(this.top)
    R.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.receiveShadow = true })
    R.add(this.street)
    this.buildCity()
    // traffic
    const carG = mergeGeometries([
      new THREE.BoxGeometry(4.3, 0.9, 1.8).translate(0, 0.65, 0),
      new THREE.BoxGeometry(2.4, 0.7, 1.6).translate(-0.3, 1.4, 0),
    ])
    this.cars = new THREE.InstancedMesh(carG, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.6, clearcoat: 1 }), 14)
    const lightG = mergeGeometries([new THREE.BoxGeometry(0.1, 0.18, 0.4).translate(2.16, 0.75, 0.6), new THREE.BoxGeometry(0.1, 0.18, 0.4).translate(2.16, 0.75, -0.6)])
    this.carLights = new THREE.InstancedMesh(lightG, new THREE.MeshStandardMaterial({ color: 0, emissive: 0xfff1d6, emissiveIntensity: 6 }), 14)
    const pal = [0xc8102e, 0xf2f2f2, 0x1f3a5f, 0x222222, 0xb8b8b8, 0xe0a100, 0x2f6b4f]
    for (let i = 0; i < 14; i++) {
      const lane = i % 2
      this.carState.push({ lane, x: TBM.X0 + ((i * 37) % 80), v: (lane ? -1 : 1) * (9 + (i % 4) * 1.5), c: new THREE.Color(pal[i % pal.length]) })
      this.cars.setColorAt(i, this.carState[i].c)
    }
    this.cars.castShadow = true
    this.street.add(this.cars, this.carLights)
  }

  private buildCity() {
    // houses along the far side of the street, stepping in height
    const plots: [number, number, number, number, number][] = [] // x, z centre, width, depth, storeys
    let x = TBM.X0 + 3
    let i = 0
    while (x < TBM.X1 - 6) {
      const w = 7 + ((i * 7) % 5) * 1.6
      const d = 9 + ((i * 3) % 3) * 1.5
      const st = 2 + ((i * 5) % 3)
      plots.push([x + w / 2, -12.6 - d / 2 + 4.5, w, d, st])
      x += w + 1.2 + ((i * 11) % 3) * 1.4
      i++
    }
    const walls = [0xb5654a, 0xd8cbb0, 0x8e8a83, 0xc9a77c, 0x6f7c86, 0xe2ddd2, 0xa0523d]
    plots.forEach(([cx, cz, w, d, st], k) => {
      const h = st * 3.2 + 0.6
      const g = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({ color: walls[k % walls.length], roughness: 0.85, map: windowTexture(st, k), emissiveMap: windowGlow(st, k), emissive: 0xffd9a0, emissiveIntensity: 1.6 })
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), mat)
      body.castShadow = true; body.receiveShadow = true
      g.add(body)
      const roofM = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.7 })
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3).translate(0, h + 0.2, 0), roofM)
      roof.castShadow = true
      g.add(roof)
      for (let j = 0; j < 2; j++) {
        const hv = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.1).translate((j - 0.5) * w * 0.4, h + 0.85, (j ? -1 : 1) * d * 0.15), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6 }))
        hv.castShadow = true
        g.add(hv)
      }
      g.position.set(cx, TBM.Z0, cz)
      this.street.add(g)
      this.buildings.push({ mesh: g, x: cx, z: cz, w, d, mat, tilt: 0 })
    })
    // trees and street lamps along the pavement
    const trunk: THREE.BufferGeometry[] = [], crown: THREE.BufferGeometry[] = [], poles: THREE.BufferGeometry[] = []
    for (let tx = TBM.X0 + 4; tx < TBM.X1 - 2; tx += 7.5) {
      const z = -9.3
      trunk.push(new THREE.CylinderGeometry(0.15, 0.22, 2.6, 8).translate(tx, TBM.Z0 + 1.3, z))
      const c = new THREE.IcosahedronGeometry(1.6 + ((tx * 13) % 5) * 0.12, 1)
      c.scale(1, 1.15, 1); c.translate(tx, TBM.Z0 + 3.6, z)
      crown.push(c)
      poles.push(new THREE.CylinderGeometry(0.08, 0.1, 5.5, 8).translate(tx + 3.7, TBM.Z0 + 2.75, -8.4))
      poles.push(new THREE.BoxGeometry(1.4, 0.12, 0.12).translate(tx + 3.1, TBM.Z0 + 5.5, -8.4))
    }
    const tr = new THREE.Mesh(mergeGeometries(trunk), new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.9 }))
    const cr = new THREE.Mesh(mergeGeometries(crown), new THREE.MeshStandardMaterial({ color: 0x3f6b35, roughness: 0.85, flatShading: true }))
    const pl = new THREE.Mesh(mergeGeometries(poles), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.7 }))
    tr.castShadow = cr.castShadow = pl.castShadow = true
    this.trees = [tr, cr, pl]
    this.street.add(tr, cr, pl)
    const heads: THREE.BufferGeometry[] = []
    for (let tx = TBM.X0 + 4; tx < TBM.X1 - 2; tx += 7.5) heads.push(new THREE.BoxGeometry(0.6, 0.12, 0.3).translate(tx + 2.5, TBM.Z0 + 5.42, -8.4))
    this.street.add(new THREE.Mesh(mergeGeometries(heads), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffe0b0, emissiveIntensity: 8 })))
  }
  private trees: THREE.Mesh[] = []

  /** the street height at a point, real metres, exaggerated */
  topY(sim: Sim, x: number, z: number) { return TBM.Z0 + sim.settle(x, z) * EXAG }

  setGround(g: GroundKind) {
    if (g === this.groundNow) return
    // whatever shows most right now becomes the old ground
    if ((this.u.uGMix.value as number) >= 0.5) this.u.uGA.value = this.u.uGB.value
    this.u.uGB.value = GI[g]
    this.u.uGMix.value = 0
    this.groundNow = g
  }

  update(sim: Sim, dt: number) {
    this.u.uXf.value = sim.xf
    this.u.uGMix.value = Math.min(1, (this.u.uGMix.value as number) + dt * 1.2)
    if (this.u.uGMix.value >= 1) this.u.uGA.value = this.u.uGB.value
    this.face.position.x = sim.xf + 0.15
    // street surface
    const p = this.topGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setY(i, this.topY(sim, p.getX(i), p.getZ(i)))
    p.needsUpdate = true
    this.topGeo.computeVertexNormals()
    // top edges of the cut faces follow it
    for (const e of this.edges) {
      const ep = e.geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < ep.count; i++) if (ep.getY(i) > TBM.Z0 - 6) ep.setY(i, this.topY(sim, ep.getX(i), ep.getZ(i)))
      ep.needsUpdate = true
    }
    // houses sit on the trough, tilt with it and crack if it bends them
    this.worst = 0
    for (const b of this.buildings) {
      const hx = b.w / 2, hz = b.d / 2
      const a = this.topY(sim, b.x - hx, b.z + hz), c = this.topY(sim, b.x + hx, b.z + hz)
      const d = this.topY(sim, b.x - hx, b.z - hz), e = this.topY(sim, b.x + hx, b.z - hz)
      const mid = this.topY(sim, b.x, b.z + hz)
      b.mesh.position.y = Math.min(a, c, d, e)
      b.mesh.rotation.x = Math.atan2(((a + c) - (d + e)) / 2, b.d)
      b.mesh.rotation.z = Math.atan2(((c + e) - (a + d)) / 2, b.w)
      // angular distortion along the street face (sagging) in real terms, before exaggeration
      const sag = Math.abs(mid - (a + c) / 2) / EXAG / hx
      const tilt = Math.abs((a - d) / EXAG / b.d)
      const beta = Math.max(sag, tilt * 0.5)
      b.tilt = beta
      this.worst = Math.max(this.worst, beta)
      const harm = THREE.MathUtils.smoothstep(beta, 1 / 1000, 1 / 150)
      b.mat.emissive.setRGB(1, 0.85 - harm * 0.75, 0.63 - harm * 0.6)
      b.mat.emissiveIntensity = 1.6 + harm * 1.5
    }
    for (const t of this.trees) t.position.y = this.topY(sim, -20, -9.3) - TBM.Z0
    // traffic, slowing over a bad trough
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    for (let i = 0; i < this.carState.length; i++) {
      const c = this.carState[i]
      const z = c.lane ? -5.6 : -2.2
      const dip = Math.abs(this.topY(sim, c.x, z) - TBM.Z0)
      c.x += c.v * dt * (dip > 1.2 ? 0.25 : 1) * 0.35
      if (c.x > TBM.X1 - 2) c.x = TBM.X0 + 2
      if (c.x < TBM.X0 + 2) c.x = TBM.X1 - 2
      const y0 = this.topY(sim, c.x - 1.5, z), y1 = this.topY(sim, c.x + 1.5, z)
      q.setFromEuler(new THREE.Euler(0, c.v < 0 ? Math.PI : 0, Math.atan2(y1 - y0, 3) * (c.v < 0 ? -1 : 1)))
      m.compose(new THREE.Vector3(c.x, (y0 + y1) / 2, z), q, new THREE.Vector3(1, 1, 1))
      this.cars.setMatrixAt(i, m); this.carLights.setMatrixAt(i, m)
    }
    this.cars.instanceMatrix.needsUpdate = true
    this.carLights.instanceMatrix.needsUpdate = true
    this.surfaceAtFace = this.topY(sim, sim.xf, -3)
  }
}

/* ------------------------------------------------------------ textures */

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const }

/** the plan of the street: 80 m by 24 m, x along u, z along v (v = 0 at z = 0, the cut) */
function streetTexture() {
  const W = 4096, H = 1229
  const [c, g] = canvas(W, H)
  const px = W / 80 // pixels per metre
  const zy = (z: number) => (-z) * px // z = 0 at the top of the canvas... flipped below
  // pavement and plots
  g.fillStyle = '#6d6a64'; g.fillRect(0, 0, W, H)
  // asphalt carriageway, z 0 .. -7.6
  g.fillStyle = '#2b2c2e'; g.fillRect(0, zy(0), W, zy(-7.6))
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * zy(-7.6), 3, 3) }
  // lane markings
  g.fillStyle = 'rgba(240,240,232,0.9)'
  for (let x = 0; x < W; x += px * 6) g.fillRect(x, zy(-3.8) - 3, px * 3, 6)
  g.fillRect(0, zy(-7.2) - 2, W, 4)
  // a zebra crossing
  for (let k = 0; k < 8; k++) g.fillRect(px * 52, zy(-0.4 - k * 0.9) - px * 0.25, px * 3.2, px * 0.5)
  // kerb and pavement slabs
  g.fillStyle = '#9b978f'; g.fillRect(0, zy(-7.6), W, px * 0.3)
  g.fillStyle = '#8b877f'; g.fillRect(0, zy(-7.9), W, px * 3.2)
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2
  for (let x = 0; x < W; x += px * 0.9) { g.beginPath(); g.moveTo(x, zy(-7.9)); g.lineTo(x, zy(-11.1)); g.stroke() }
  for (let z = -7.9; z > -11.1; z -= 0.9) { g.beginPath(); g.moveTo(0, zy(z)); g.lineTo(W, zy(z)); g.stroke() }
  // tree pits
  g.fillStyle = '#3a2c20'
  for (let x = 4 + 62; x < 140; x += 7.5) { g.fillRect(((x - 62) - 0.8) * px, zy(-8.5), 1.6 * px, 1.6 * px) }
  // back gardens and yards behind the houses
  g.fillStyle = '#4c5a3c'; g.fillRect(0, zy(-11.1), W, H)
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${70 + Math.random() * 50},${30 + Math.random() * 20},0.5)`; g.fillRect(Math.random() * W, zy(-11.1) + Math.random() * (H - zy(-11.1)), 4, 4) }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  // after the rotation v = 0 is the cut (z = 0) and v = 1 the back, like the canvas rows
  t.flipY = false
  return t
}
function streetGlow() {
  const [c, g] = canvas(256, 64); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 64)
  const t = new THREE.CanvasTexture(c); return t
}

/** facade: windows in rows, some lit */
function windowTexture(storeys: number, seed: number) {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2) }
  const rows = storeys, cols = 5
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = 18 + k * (220 / cols), y = 256 - (r + 1) * (240 / rows) + 10
    g.fillStyle = '#1d2228'; g.fillRect(x, y, 26, 240 / rows * 0.55)
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 2, y + 240 / rows * 0.55, 30, 3)
  }
  if (seed % 3 === 0) { g.fillStyle = '#5a2e22'; g.fillRect(100, 236 - 10, 40, 20) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}
function windowGlow(storeys: number, seed: number) {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256)
  let s = seed * 9301 + 49297
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const rows = storeys, cols = 5
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    if (rnd() < 0.45) continue
    const x = 18 + k * (220 / cols), y = 256 - (r + 1) * (240 / rows) + 10
    const warm = 0.6 + rnd() * 0.4
    g.fillStyle = `rgba(255,${Math.round(200 * warm)},${Math.round(140 * warm)},1)`; g.fillRect(x + 2, y + 2, 22, 240 / rows * 0.55 - 4)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}
