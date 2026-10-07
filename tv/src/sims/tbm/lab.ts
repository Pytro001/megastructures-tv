import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { TBM, GROUNDS, type Sim, type Ground } from './sim'
import { lathe } from './machine'
import { dotTexture } from './mats'

/**
 * The room the model stands in: a dark lab with a long bench, a scale rail
 * along its front edge, three wall screens that draw the process live, a
 * real 17 inch disc cutter on its own pedestal, core samples of the three
 * grounds, and a lighting rig of a key, a cool rim, a warm top and practicals.
 */

export const S = 1 / 30
export const PT = 0.62 // bench top
/** world position of a model point (real metres) */
export const MODEL_OFF = new THREE.Vector3(22 * S, PT + 14 * S, 0)
export const toWorld = (x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(x * S, y * S, z * S).add(MODEL_OFF)

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const }

export class Lab {
  readonly root = new THREE.Group()
  readonly key: THREE.SpotLight
  readonly rim: THREE.SpotLight
  readonly top: THREE.SpotLight
  readonly fill: THREE.SpotLight
  readonly screens: Screens
  private cores: { mesh: THREE.Mesh; ring: THREE.Mesh; g: Ground }[] = []
  readonly discProp = new THREE.Group()
  private dust: THREE.Points
  private dustV: Float32Array

  constructor() {
    const R = this.root
    // floor: dark polished concrete
    const floorTex = (() => {
      const [c, g] = canvas(1024, 1024)
      g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 1024, 1024)
      for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.03})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3) }
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3
      for (let i = 0; i <= 1024; i += 256) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke() }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
    })()
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.3, metalness: 0.2 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
    R.add(floor)
    // walls: dark panels with light slots
    const wallTex = (() => {
      const [c, g] = canvas(1024, 512)
      g.fillStyle = '#16181b'; g.fillRect(0, 0, 1024, 512)
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`; g.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2) }
      g.fillStyle = '#0c0d0f'
      for (let x = 0; x < 1024; x += 128) g.fillRect(x, 0, 4, 512)
      g.fillRect(0, 300, 1024, 3)
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1); t.colorSpace = THREE.SRGBColorSpace; return t
    })()
    const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75, metalness: 0.1 })
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), wallM); back.position.set(0, 2.5, -2.4); back.receiveShadow = true; R.add(back)
    const left = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), wallM); left.rotation.y = Math.PI / 2; left.position.set(-6, 2.5, 2.6); R.add(left)
    const right = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), wallM); right.rotation.y = -Math.PI / 2; right.position.set(6, 2.5, 2.6); R.add(right)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.6, 2.6); R.add(ceil)
    // vertical light slots and ceiling strips (emissive, they make the reflections)
    const slot = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xcfe2ff, emissiveIntensity: 1.1 })
    const slots: THREE.BufferGeometry[] = []
    for (const x of [-4.6, -3.0, 3.0, 4.6]) slots.push(new THREE.BoxGeometry(0.05, 3.4, 0.03).translate(x, 2.3, -2.38))
    for (const z of [-1.2, 0.8, 2.8]) slots.push(new THREE.BoxGeometry(6.0, 0.03, 0.1).translate(0, 4.58, z))
    R.add(new THREE.Mesh(mergeGeometries(slots), slot))
    // a warm skirting line glowing along the back wall
    R.add(new THREE.Mesh(new THREE.BoxGeometry(14, 0.02, 0.03).translate(0, 0.08, -2.37), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff9a4a, emissiveIntensity: 2 })))

    this.buildBench()
    this.screens = new Screens()
    R.add(this.screens.root)
    this.buildDiscProp()
    this.buildCores()

    // lights
    this.key = new THREE.SpotLight(0xfff0e0, 60, 14, 0.5, 0.75, 1.5)
    this.key.position.set(2.6, 4.2, 3.4); this.key.target.position.set(-0.1, 1.15, -0.3)
    this.key.castShadow = true; this.key.shadow.mapSize.set(4096, 4096); this.key.shadow.bias = -0.00008; this.key.shadow.normalBias = 0.006
    this.key.shadow.camera.near = 2; this.key.shadow.camera.far = 10
    R.add(this.key, this.key.target)
    this.rim = new THREE.SpotLight(0x8fb8ff, 70, 12, 0.6, 0.8, 1.5)
    this.rim.position.set(-2.8, 3.6, -2.2); this.rim.target.position.set(0.2, 1.1, 0)
    R.add(this.rim, this.rim.target)
    this.top = new THREE.SpotLight(0xffd2a0, 30, 8, 0.55, 0.9, 1.6)
    this.top.position.set(-0.4, 4.3, -0.2); this.top.target.position.set(-0.2, 1.7, -0.4)
    R.add(this.top, this.top.target)
    this.fill = new THREE.SpotLight(0xb8d4ff, 10, 10, 0.7, 1, 1.6)
    this.fill.position.set(-3.2, 1.6, 3.6); this.fill.target.position.set(0, 1.0, 0)
    R.add(this.fill, this.fill.target)
    R.add(new THREE.HemisphereLight(0x8a96aa, 0x15120e, 0.25))

    // dust in the light
    const n = 700
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(n * 3)
    this.dustV = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 6; p[i * 3 + 1] = Math.random() * 4; p[i * 3 + 2] = (Math.random() - 0.5) * 5 + 0.5; for (let k = 0; k < 3; k++) this.dustV[i * 3 + k] = (Math.random() - 0.5) * 0.02 }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), size: 0.012, color: 0xfff1df, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
    R.add(this.dust)
  }

  private buildBench() {
    const R = this.root
    const top = new THREE.MeshPhysicalMaterial({ color: 0x1a1b1e, roughness: 0.32, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 })
    const body = new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.55, metalness: 0.5 })
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9953f, roughness: 0.28, metalness: 1 })
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 1.55).translate(0, PT - 0.03, -0.27), top)
    slab.receiveShadow = true; slab.castShadow = true
    R.add(slab)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.15, PT - 0.12, 1.4).translate(0, (PT - 0.12) / 2 + 0.06, -0.27), body)
    cab.receiveShadow = true
    R.add(cab)
    R.add(new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.06, 1.35).translate(0, 0.03, -0.27), new THREE.MeshStandardMaterial({ color: 0x0a0a0b })))
    // underglow
    R.add(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.012, 0.02).translate(0, 0.075, 0.43), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x5ed8ff, emissiveIntensity: 3 })))
    // brass inlay along the front edge
    R.add(new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.012, 0.012).translate(0, PT - 0.012, 0.5), brass))
    // the scale rail: one tick per metre of the real tunnel, numbers every ten
    const [c, g] = canvas(4096, 128)
    g.fillStyle = '#d7dadf'; g.fillRect(0, 0, 4096, 128)
    g.fillStyle = '#16181b'
    const L = TBM.X1 - TBM.X0
    for (let m = 0; m <= L; m++) {
      const x = 8 + (m / L) * (4096 - 16)
      const h = m % 10 === 0 ? 60 : m % 5 === 0 ? 40 : 24
      g.fillRect(x - 1.5, 0, 3, h)
      if (m % 10 === 0) { g.font = '600 36px "DM Mono", monospace'; g.textAlign = 'center'; g.fillText(`${m} m`, Math.min(4030, Math.max(60, x)), 104) }
    }
    const rt = new THREE.CanvasTexture(c); rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = 8
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L * S, 0.012, 0.05), [body, body, new THREE.MeshStandardMaterial({ map: rt, roughness: 0.35, metalness: 0.6 }), body, body, body])
    rail.position.set((TBM.X0 + L / 2 + 22) * S, PT + 0.006, 0.07)
    rail.receiveShadow = true
    R.add(rail)
    // a brass name plate
    const [pc, pg] = canvas(1024, 256)
    pg.fillStyle = '#b8863a'; pg.fillRect(0, 0, 1024, 256)
    const grad = pg.createLinearGradient(0, 0, 1024, 256); grad.addColorStop(0, 'rgba(255,255,255,0.25)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.2)')
    pg.fillStyle = grad; pg.fillRect(0, 0, 1024, 256)
    pg.fillStyle = '#2a1d0c'; pg.textAlign = 'center'
    pg.font = '700 74px Outfit, sans-serif'; pg.fillText('EPB TUNNEL BORING MACHINE', 512, 110)
    pg.font = '500 46px "DM Mono", monospace'; pg.fillText('Ø 12.0 m   ·   scale 1:30', 512, 190)
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = 8
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.008), [brass, brass, brass, brass, new THREE.MeshStandardMaterial({ map: pt, roughness: 0.3, metalness: 0.9 }), brass])
    plate.rotation.x = -1.1
    plate.position.set(0.0, PT + 0.03, 0.34)
    plate.castShadow = true
    R.add(plate)
    // a dark steel edge frame around the cut face of the block
    const frame: THREE.BufferGeometry[] = []
    const x0 = (TBM.X0 + 22) * S, x1 = (TBM.X1 + 22) * S, y0 = PT, y1 = PT + 34 * S
    frame.push(new THREE.BoxGeometry(x1 - x0 + 0.02, 0.012, 0.012).translate((x0 + x1) / 2, y0 + 0.004, 0.006))
    frame.push(new THREE.BoxGeometry(0.012, y1 - y0, 0.012).translate(x0 - 0.006, (y0 + y1) / 2, 0.006))
    frame.push(new THREE.BoxGeometry(0.012, y1 - y0, 0.012).translate(x1 + 0.006, (y0 + y1) / 2, 0.006))
    frame.push(new THREE.BoxGeometry(0.012, y1 - y0, 0.012).translate(x0 - 0.006, (y0 + y1) / 2, -0.8 - 0.006))
    frame.push(new THREE.BoxGeometry(0.012, y1 - y0, 0.012).translate(x1 + 0.006, (y0 + y1) / 2, -0.8 - 0.006))
    const fm = new THREE.Mesh(mergeGeometries(frame), brass); fm.castShadow = true
    R.add(fm)
  }

  private buildDiscProp() {
    const P = this.discProp
    const steel = new THREE.MeshStandardMaterial({ color: 0xa8aeb4, roughness: 0.2, metalness: 1 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.4, metalness: 0.8 })
    const ped = new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, roughness: 0.4, metalness: 0.3, clearcoat: 0.5 })
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.0, 0.42).translate(0, 0.5, 0), ped)
    col.castShadow = col.receiveShadow = true
    P.add(col)
    P.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.012, 0.44).translate(0, 1.006, 0), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff9a4a, emissiveIntensity: 0.6 })))
    // a 432 mm (17 inch) disc cutter: ring, hub, shaft and saddle
    const disc = new THREE.Group()
    const ring = new THREE.Mesh(lathe([[0.13, -0.038], [0.18, -0.04], [0.205, -0.014], [0.216, -0.004], [0.216, 0.004], [0.205, 0.014], [0.18, 0.04], [0.13, 0.038]], 96), steel)
    const hub = new THREE.Mesh(lathe([[0.04, -0.06], [0.135, -0.06], [0.135, 0.06], [0.04, 0.06]], 64), dark)
    const bolts: THREE.BufferGeometry[] = []
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; bolts.push(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 8).rotateZ(Math.PI / 2).translate(0, 0.09 * Math.cos(a), 0.09 * Math.sin(a))) }
    disc.add(ring, hub, new THREE.Mesh(mergeGeometries(bolts), steel))
    disc.traverse(o => { (o as THREE.Mesh).castShadow = true })
    disc.name = 'disc'
    // that disc's axis is x; stand it upright in a saddle
    const saddle = new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(0.2, 0.1, 0.06).translate(0, 1.05, 0.1),
      new THREE.BoxGeometry(0.2, 0.1, 0.06).translate(0, 1.05, -0.1),
      new THREE.BoxGeometry(0.24, 0.03, 0.3).translate(0, 1.015, 0),
      new THREE.BoxGeometry(0.06, 0.27, 0.05).translate(0, 1.18, 0.1),
      new THREE.BoxGeometry(0.06, 0.27, 0.05).translate(0, 1.18, -0.1),
    ]), dark)
    saddle.castShadow = true
    disc.rotation.y = Math.PI / 2
    disc.position.set(0, 1.26, 0)
    P.add(saddle, disc)
    P.position.set(2.35, 0, -0.35)
    P.rotation.y = -0.5
    this.root.add(P)
  }

  private buildCores() {
    const kinds: Ground[] = ['clay', 'sand', 'granite']
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.14).translate(-1.25, PT + 0.015, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.7 }))
    base.castShadow = true
    this.root.add(base)
    kinds.forEach((g, i) => {
      const c = GROUNDS[g].color
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: g === 'granite' ? 0.35 : 0.9, map: coreTex(g) })
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 32).translate(-1.38 + i * 0.13, PT + 0.13, 0.3), mat)
      m.castShadow = true
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.048, 0.058, 40).rotateX(-Math.PI / 2).translate(-1.38 + i * 0.13, PT + 0.032, 0.3), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x5ed8ff, emissiveIntensity: 0 }))
      this.root.add(m, ring)
      this.cores.push({ mesh: m, ring, g })
    })
  }

  update(sim: Sim, dt: number, t: number) {
    for (const c of this.cores) {
      const on = c.g === sim.ground ? 1 : 0
      const m = c.ring.material as THREE.MeshStandardMaterial
      m.emissiveIntensity += (on * 6 - m.emissiveIntensity) * Math.min(1, dt * 6)
    }
    const d = this.discProp.getObjectByName('disc')!
    d.rotation.x += dt * 0.35
    const p = this.dust.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + this.dustV[i * 3 + 1] * dt + Math.sin(t * 0.3 + i) * 0.0004
      if (y > 4) y = 0.1; if (y < 0.05) y = 3.9
      p.setXYZ(i, p.getX(i) + this.dustV[i * 3] * dt, y, p.getZ(i) + this.dustV[i * 3 + 2] * dt)
    }
    p.needsUpdate = true
    this.screens.update(sim, t)
  }
}

function coreTex(g: Ground) {
  const [c, x] = canvas(128, 256)
  const col = GROUNDS[g].color.map(v => Math.round(v * 255))
  x.fillStyle = `rgb(${col.join(',')})`; x.fillRect(0, 0, 128, 256)
  for (let i = 0; i < 2500; i++) {
    const k = g === 'granite' ? (Math.random() < 0.3 ? '20,20,22' : Math.random() < 0.5 ? '230,160,140' : '240,240,235') : g === 'sand' ? '255,240,200' : '60,50,45'
    x.fillStyle = `rgba(${k},${g === 'granite' ? 0.8 : 0.15})`; const s = g === 'granite' ? 3 : 2
    x.fillRect(Math.random() * 128, Math.random() * 256, s, s)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

/* ------------------------------------------------------------ the wall screens */

class Screens {
  readonly root = new THREE.Group()
  private c: { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture }[] = []
  private last = -1
  constructor() {
    const W = 1.15, H = 0.65
    const frameM = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.4, metalness: 0.6 })
    const edgeM = new THREE.MeshStandardMaterial({ color: 0, emissive: 0x5ed8ff, emissiveIntensity: 1.6 })
    for (let i = 0; i < 3; i++) {
      const [cv, g] = canvas(1024, 580)
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
      const x = (i - 1) * 1.45
      const fr = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, H + 0.06, 0.04), frameM); fr.position.set(x, 2.55, -2.36)
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }))
      scr.position.set(x, 2.55, -2.335)
      const e = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(W + 0.06, 0.006, 0.01).translate(0, -(H + 0.06) / 2, 0.02), new THREE.BoxGeometry(W + 0.06, 0.006, 0.01).translate(0, (H + 0.06) / 2, 0.02)]), edgeM)
      e.position.set(x, 2.55, -2.36)
      this.root.add(fr, scr, e)
      this.c.push({ cv, g, tex })
    }
  }
  update(sim: Sim, t: number) {
    // redraw at 15 fps; they are slow diagrams, not video
    const f = Math.floor(t * 15)
    if (f === this.last) return
    this.last = f
    this.drawCutter(this.c[0].g, sim, t)
    this.drawPressure(this.c[1].g, sim, t)
    this.drawRing(this.c[2].g, sim, t)
    for (const c of this.c) c.tex.needsUpdate = true
  }
  private bg(g: CanvasRenderingContext2D, title: string, sub: string) {
    const W = 1024, H = 580
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#04121e'); gr.addColorStop(1, '#020810')
    g.fillStyle = gr; g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(94,216,255,0.08)'; g.lineWidth = 1
    for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
    for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
    g.fillStyle = '#8fe6ff'; g.font = '700 38px Outfit, sans-serif'; g.textAlign = 'left'; g.fillText(title, 36, 62)
    g.fillStyle = 'rgba(160,220,255,0.6)'; g.font = '500 22px "DM Mono", monospace'; g.fillText(sub, 36, 96)
    g.shadowColor = '#5ed8ff'
  }
  private drawCutter(g: CanvasRenderingContext2D, sim: Sim, t: number) {
    this.bg(g, 'Disc cutters', `${TBM.CUTTERS} discs · 250 kN each · ${sim.pen.toFixed(1)} mm a turn`)
    // rock face in section, two discs rolling into it, chips breaking between the grooves
    const y0 = 360
    g.fillStyle = sim.ground === 'granite' ? '#3a3f48' : sim.ground === 'sand' ? '#5b4a2e' : '#3d3029'
    g.fillRect(0, y0, 1024, 220)
    g.strokeStyle = '#5ed8ff'; g.lineWidth = 3; g.shadowBlur = 14
    const pen = Math.min(40, sim.pen * 1.6)
    for (const cx of [330, 690]) {
      const roll = (t * sim.rpm * 2) % (Math.PI * 2)
      g.beginPath(); g.arc(cx, y0 - 110 + pen, 120, 0, Math.PI * 2); g.stroke()
      g.beginPath(); g.moveTo(cx, y0 - 110 + pen); g.lineTo(cx + Math.cos(roll) * 110, y0 - 110 + pen + Math.sin(roll) * 110); g.stroke()
      // crushed zone under the tip
      g.fillStyle = 'rgba(255,170,80,0.85)'
      g.beginPath(); g.ellipse(cx, y0 + 4 + pen * 0.4, 26, 10 + pen * 0.3, 0, 0, Math.PI * 2); g.fill()
      // cracks fanning out
      g.strokeStyle = 'rgba(255,190,110,0.8)'; g.lineWidth = 2
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, y0 + 8); g.quadraticCurveTo(cx + s * 70, y0 + 40, cx + s * 180, y0 + 8 + 10 * Math.sin(t * 3)); g.stroke() }
      g.strokeStyle = '#5ed8ff'; g.lineWidth = 3
    }
    // the chip between the grooves lifting away
    const lift = (t * 0.8) % 1
    g.fillStyle = `rgba(255,200,130,${0.9 - lift * 0.8})`
    g.beginPath(); g.moveTo(420, y0 - lift * 40); g.lineTo(600, y0 - lift * 40); g.lineTo(560, y0 + 18 - lift * 40); g.lineTo(460, y0 + 18 - lift * 40); g.closePath(); g.fill()
    g.shadowBlur = 0
    g.fillStyle = 'rgba(160,220,255,0.75)'; g.font = '500 22px "DM Mono", monospace'
    g.fillText('track spacing 85 mm', 400, 530)
  }
  private drawPressure(g: CanvasRenderingContext2D, sim: Sim, t: number) {
    this.bg(g, 'Face support', `${sim.g.name} · needs ${sim.g.need.toFixed(1)} bar`)
    const cx = 512, cy = 380, R = 190
    const max = 6
    const ang = (p: number) => Math.PI * (1 + p / max)
    g.lineWidth = 26; g.lineCap = 'butt'
    // zones: losing ground / balanced / heave
    const need = sim.g.need
    const zones: [number, number, string][] = [[0, need * 0.8, 'rgba(255,90,70,0.6)'], [need * 0.8, need * 1.25, 'rgba(80,255,170,0.7)'], [need * 1.25, max, 'rgba(255,190,70,0.55)']]
    for (const [a, b, c] of zones) { g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, R, ang(Math.min(a, max)), ang(Math.min(b, max))); g.stroke() }
    g.lineWidth = 2; g.strokeStyle = 'rgba(160,220,255,0.6)'
    for (let p = 0; p <= max; p++) { const a = ang(p); g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30)); g.lineTo(cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 16)); g.stroke(); g.fillStyle = 'rgba(160,220,255,0.8)'; g.font = '500 20px "DM Mono", monospace'; g.textAlign = 'center'; g.fillText(String(p), cx + Math.cos(a) * (R + 40), cy + Math.sin(a) * (R + 40) + 7) }
    const a = ang(Math.min(max, sim.pressure)) + Math.sin(t * 20) * 0.004
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.shadowColor = '#5ed8ff'; g.shadowBlur = 18
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 20), cy + Math.sin(a) * (R - 20)); g.stroke()
    g.shadowBlur = 0
    g.fillStyle = '#ffffff'; g.font = '700 64px Outfit, sans-serif'; g.textAlign = 'center'; g.fillText(`${sim.pressure.toFixed(2)} bar`, cx, cy + 80)
    const st = sim.faceState
    g.fillStyle = st === 'balanced' || st === 'self supporting' ? '#50ffaa' : st === 'heaving' || st === 'blowing out' ? '#ffbe46' : '#ff6a50'
    g.font = '600 30px Outfit, sans-serif'; g.fillText(st.toUpperCase(), cx, cy + 128)
    g.textAlign = 'left'
  }
  private drawRing(g: CanvasRenderingContext2D, sim: Sim, t: number) {
    this.bg(g, 'Ring build', `ring ${(sim.rings + 1).toLocaleString('en-US')} · 7 segments and a key`)
    const cx = 512, cy = 340, ro = 200, ri = 160
    const order = [3, 2, 4, 1, 5, 0, 6, 7]
    const big = (Math.PI * 2 - (20 / 360) * Math.PI * 2) / 7, k0 = (10 / 360) * Math.PI * 2
    const span = (i: number): [number, number] => (i === 7 ? [-k0, k0] : [k0 + big * i, k0 + big * (i + 1)])
    for (let i = 0; i < 8; i++) {
      const when = order.indexOf(i)
      const done = sim.phase === 'ring' ? sim.build - when >= 0.82 : sim.stroke > 0 ? 1 : 0
      const moving = sim.phase === 'ring' && Math.floor(sim.build) === when
      const [a, b] = span(i)
      const A = a - Math.PI / 2 + 0.012, Bn = b - Math.PI / 2 - 0.012
      g.beginPath(); g.arc(cx, cy, ro, A, Bn); g.arc(cx, cy, ri, Bn, A, true); g.closePath()
      g.fillStyle = done ? (i === 7 ? 'rgba(124,240,192,0.9)' : 'rgba(124,240,192,0.55)') : moving ? `rgba(255,200,90,${0.5 + 0.4 * Math.sin(t * 8)})` : 'rgba(94,216,255,0.08)'
      g.fill(); g.strokeStyle = 'rgba(124,240,192,0.8)'; g.lineWidth = 2; g.stroke()
    }
    g.fillStyle = '#ffffff'; g.font = '700 46px Outfit, sans-serif'; g.textAlign = 'center'
    g.fillText(sim.phase === 'ring' ? `segment ${Math.min(8, Math.floor(sim.build) + 1)} of 8` : `boring ${(sim.stroke * 1000).toFixed(0)} / 2000 mm`, cx, cy + 14)
    g.fillStyle = 'rgba(160,220,255,0.7)'; g.font = '500 22px "DM Mono", monospace'
    g.fillText(`${((sim.rings * 2) / 1000).toFixed(2)} km of tunnel behind it`, cx, 540)
    g.textAlign = 'left'
  }
}
