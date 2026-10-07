import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { dotTexture } from '../tbm/mats'
import { fmtE, fmtLen, type Impact } from './sim'
import { HALF, Y0 } from './terrain'
import { VEX } from './geo'

/**
 * The room: the same dark studio as the tunnel boring machine, with a
 * round plinth for the 40 km block, a brass scale along its front edge, three
 * wall screens (energy, crater, damage) and an iron meteorite on a pedestal
 * with one face cut and etched to show its Widmanstatten crystals.
 */

export const S = 1 / 60000
export const PT = 0.74
export const MODEL_OFF = new THREE.Vector3(0, PT - Y0 * S, 0)
export const toWorld = (x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(x * S, y * S, z * S).add(MODEL_OFF)

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const }

/** what the plinth shows: how long the scale rail is, what the plate says, how tall the block is (world m) */
export interface LabOpts { railKm: number; plate: string; blockH: number }

export class Lab {
  readonly root = new THREE.Group()
  readonly key: THREE.SpotLight
  readonly rim: THREE.SpotLight
  readonly top: THREE.SpotLight
  readonly fill: THREE.SpotLight
  readonly hemi: THREE.HemisphereLight
  readonly screens: Screens
  readonly meteorite = new THREE.Group()
  private dust: THREE.Points
  private dustV: Float32Array
  private ring: THREE.Mesh

  constructor(readonly o: LabOpts = { railKm: 120, plate: `120 × 120 km  ·  1:60,000  ·  height ×${VEX}`, blockH: -Y0 * S }) {
    const R = this.root
    const floorTex = (() => {
      const [c, g] = canvas(1024, 1024)
      g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 1024, 1024)
      for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.03})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3) }
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3
      for (let i = 0; i <= 1024; i += 256) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke() }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
    })()
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.3, metalness: 0.2 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
    R.add(floor)
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
    const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), wallM); back.position.set(0, 3, -3.2); back.receiveShadow = true; R.add(back)
    const left = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallM); left.rotation.y = Math.PI / 2; left.position.set(-7, 3, 2.8); R.add(left)
    const right = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallM); right.rotation.y = -Math.PI / 2; right.position.set(7, 3, 2.8); R.add(right)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.6, 2.8); R.add(ceil)
    const slot = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xcfe2ff, emissiveIntensity: 1.0 })
    const slots: THREE.BufferGeometry[] = []
    for (const x of [-5.4, -3.8, 3.8, 5.4]) slots.push(new THREE.BoxGeometry(0.05, 3.8, 0.03).translate(x, 2.6, -3.18))
    for (const z of [-1.8, 0.6, 3.0]) slots.push(new THREE.BoxGeometry(7.0, 0.03, 0.1).translate(0, 5.58, z))
    R.add(new THREE.Mesh(mergeGeometries(slots), slot))
    R.add(new THREE.Mesh(new THREE.BoxGeometry(16, 0.02, 0.03).translate(0, 0.08, -3.17), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff9a4a, emissiveIntensity: 2 })))

    this.ring = this.buildPlinth()
    this.screens = new Screens()
    R.add(this.screens.root)
    this.buildMeteorite()

    this.key = new THREE.SpotLight(0xfff0e0, 70, 16, 0.5, 0.75, 1.5)
    this.key.position.set(3.0, 5.0, 3.6); this.key.target.position.set(0, 1.0, 0)
    this.key.castShadow = true; this.key.shadow.mapSize.set(4096, 4096); this.key.shadow.bias = -0.00006; this.key.shadow.normalBias = 0.004
    this.key.shadow.camera.near = 3; this.key.shadow.camera.far = 12
    R.add(this.key, this.key.target)
    this.rim = new THREE.SpotLight(0x8fb8ff, 80, 14, 0.6, 0.8, 1.5)
    this.rim.position.set(-3.4, 4.2, -3.0); this.rim.target.position.set(0.2, 1.0, 0)
    R.add(this.rim, this.rim.target)
    this.top = new THREE.SpotLight(0xffd2a0, 36, 9, 0.6, 0.9, 1.6)
    this.top.position.set(-0.3, 5.0, 0.2); this.top.target.position.set(0, 1.0, 0)
    R.add(this.top, this.top.target)
    this.fill = new THREE.SpotLight(0xb8d4ff, 12, 12, 0.7, 1, 1.6)
    this.fill.position.set(-3.6, 1.8, 4.2); this.fill.target.position.set(0, 1.0, 0)
    R.add(this.fill, this.fill.target)
    this.hemi = new THREE.HemisphereLight(0x8a96aa, 0x15120e, 0.25)
    R.add(this.hemi)

    const n = 800, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3)
    this.dustV = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 7; p[i * 3 + 1] = Math.random() * 4.5; p[i * 3 + 2] = (Math.random() - 0.5) * 6; for (let k = 0; k < 3; k++) this.dustV[i * 3 + k] = (Math.random() - 0.5) * 0.02 }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), size: 0.012, color: 0xfff1df, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }))
    R.add(this.dust)
  }

  private buildPlinth() {
    const R = this.root
    const body = new THREE.MeshPhysicalMaterial({ color: 0x1c1d21, roughness: 0.4, metalness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 })
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9953f, roughness: 0.28, metalness: 1 })
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.64, PT - 0.02, 96).translate(0, (PT - 0.02) / 2, 0), body)
    plinth.receiveShadow = true; plinth.castShadow = true
    R.add(plinth)
    R.add(new THREE.Mesh(new THREE.CylinderGeometry(1.61, 1.61, 0.03, 96).translate(0, PT - 0.015, 0), new THREE.MeshPhysicalMaterial({ color: 0x0f1012, roughness: 0.25, metalness: 0.5, clearcoat: 1 })))
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.61, 0.006, 8, 160).rotateX(Math.PI / 2).translate(0, PT, 0), brass)
    R.add(ring)
    const led = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.008, 6, 160).rotateX(Math.PI / 2).translate(0, 0.07, 0), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff7a3a, emissiveIntensity: 3 }))
    R.add(led)
    // a scale along the front edge of the block: one tick a kilometre
    const [c, g] = canvas(4096, 128)
    g.fillStyle = '#c99a48'; g.fillRect(0, 0, 4096, 128)
    g.fillStyle = '#2a1d0c'
    const RK = this.o.railKm, st = RK / 60, big = RK / 6
    for (let i = 0; i <= 60; i++) {
      const km = i * st
      const x = 8 + (km / RK) * 4080
      const major = Math.abs(km / big - Math.round(km / big)) < 1e-6
      g.fillRect(x - 2, 0, 4, major ? 64 : i % 5 === 0 ? 44 : 26)
      if (major) { g.font = '600 38px "DM Mono", monospace'; g.textAlign = 'center'; g.fillText(`${+km.toFixed(1)} km`, Math.min(4020, Math.max(70, x)), 108) }
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
    const L = 2 * HALF * S
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.006, 0.04), [brass, brass, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.9 }), brass, brass, brass])
    rail.position.set(0, PT + 0.003, HALF * S + 0.04)
    rail.receiveShadow = true
    R.add(rail)
    // the name plate
    const [pc, pg] = canvas(1024, 256)
    pg.fillStyle = '#b8863a'; pg.fillRect(0, 0, 1024, 256)
    const grad = pg.createLinearGradient(0, 0, 1024, 256); grad.addColorStop(0, 'rgba(255,255,255,0.25)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.2)')
    pg.fillStyle = grad; pg.fillRect(0, 0, 1024, 256)
    pg.fillStyle = '#2a1d0c'; pg.textAlign = 'center'
    pg.font = '700 78px Outfit, sans-serif'; pg.fillText('ASTEROID IMPACT', 512, 112)
    pg.font = '500 38px "DM Mono", monospace'; pg.fillText(this.o.plate, 512, 192)
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = 8
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.085, 0.008), [brass, brass, brass, brass, new THREE.MeshStandardMaterial({ map: pt, roughness: 0.3, metalness: 0.9 }), brass])
    plate.rotation.x = -1.1
    plate.position.set(0, PT + 0.03, 1.3)
    plate.castShadow = true
    R.add(plate)
    // a thin brass frame on the block's vertical edges
    const fr: THREE.BufferGeometry[] = []
    const h = this.o.blockH, e = HALF * S
    for (const [x, z] of [[-e, -e], [e, -e], [-e, e], [e, e]]) fr.push(new THREE.BoxGeometry(0.008, h, 0.008).translate(x, PT + h / 2, z))
    R.add(new THREE.Mesh(mergeGeometries(fr), brass))
    return led
  }

  private buildMeteorite() {
    const M = this.meteorite
    const ped = new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, roughness: 0.4, metalness: 0.3, clearcoat: 0.5 })
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.05, 0.4).translate(0, 0.525, 0), ped)
    col.castShadow = col.receiveShadow = true
    M.add(col)
    M.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.42).translate(0, 1.056, 0), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff9a4a, emissiveIntensity: 0.6 })))
    // an iron meteorite: a lump with thumbprint pits (regmaglypts), dark fusion crust
    const g = new THREE.IcosahedronGeometry(0.13, 6)
    const p = g.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3(), centres = Array.from({ length: 40 }, () => new THREE.Vector3().randomDirection())
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const d = v.clone().normalize()
      let k = 1 + 0.12 * Math.sin(d.x * 4 + 1) * Math.sin(d.y * 3) + 0.08 * Math.sin(d.z * 5 + 2)
      for (const c of centres) { const a = d.angleTo(c); if (a < 0.28) k -= 0.05 * (1 - a / 0.28) ** 2 * 2 }
      v.multiplyScalar(k).multiply(new THREE.Vector3(1.3, 0.75, 1))
      // flatten one face where it was cut and etched
      if (v.z > 0.085) v.z = 0.085
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    const crust = new THREE.MeshStandardMaterial({ color: 0x2a2725, roughness: 0.55, metalness: 0.75 })
    const rock = new THREE.Mesh(g, crust)
    rock.castShadow = true
    // the etched face: Widmanstatten lamellae
    const [c, x] = canvas(512, 512)
    x.fillStyle = '#9fa3a6'; x.fillRect(0, 0, 512, 512)
    for (const ang of [0.15, 1.2, 2.2]) {
      for (let i = 0; i < 70; i++) {
        x.save(); x.translate(256, 256); x.rotate(ang)
        const off = (Math.random() - 0.5) * 700, len = 80 + Math.random() * 300, w = 3 + Math.random() * 9
        x.fillStyle = Math.random() < 0.5 ? 'rgba(210,214,218,0.9)' : 'rgba(110,114,118,0.8)'
        x.fillRect(off, (Math.random() - 0.5) * 700, len, w)
        x.restore()
      }
    }
    const et = new THREE.CanvasTexture(c); et.colorSpace = THREE.SRGBColorSpace
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.105, 64), new THREE.MeshStandardMaterial({ map: et, roughness: 0.18, metalness: 1 }))
    face.scale.set(1.15, 0.62, 1)
    face.position.z = 0.0855
    const lump = new THREE.Group()
    lump.add(rock, face)
    lump.position.set(0, 1.16, 0)
    lump.rotation.y = 0.5
    lump.name = 'lump'
    M.add(lump)
    M.position.set(2.15, 0, -0.9)
    M.rotation.y = -0.6
    this.root.add(M)
  }

  update(im: Impact, dt: number, t: number) {
    const lump = this.meteorite.getObjectByName('lump')!
    lump.rotation.y += dt * 0.25
    const p = this.dust.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + this.dustV[i * 3 + 1] * dt + Math.sin(t * 0.3 + i) * 0.0004
      if (y > 4.5) y = 0.1; if (y < 0.05) y = 4.4
      p.setXYZ(i, p.getX(i) + this.dustV[i * 3] * dt, y, p.getZ(i) + this.dustV[i * 3 + 2] * dt)
    }
    p.needsUpdate = true
    this.screens.update(im, t)
    void this.ring
  }
}

/* ------------------------------------------------------------ wall screens */

class Screens {
  readonly root = new THREE.Group()
  private c: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture }[] = []
  private last = -1
  /** seconds since the impact, set by the page */
  tImpact = -10
  /** tsunami run-up at the city, m, and its arrival, s */
  runup = 0
  arrival = -1
  constructor() {
    const W = 1.5, H = 0.84
    const frameM = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.4, metalness: 0.6 })
    const edgeM = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff9a4a, emissiveIntensity: 1.4 })
    for (let i = 0; i < 3; i++) {
      const [cv, g] = canvas(1024, 574)
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
      const x = (i - 1) * 1.9
      const fr = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, H + 0.06, 0.04), frameM); fr.position.set(x, 2.85, -3.16)
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }))
      scr.position.set(x, 2.85, -3.135)
      const e = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(W + 0.06, 0.006, 0.01).translate(0, -(H + 0.06) / 2, 0.02), new THREE.BoxGeometry(W + 0.06, 0.006, 0.01).translate(0, (H + 0.06) / 2, 0.02)]), edgeM)
      e.position.set(x, 2.85, -3.16)
      this.root.add(fr, scr, e)
      this.c.push({ g, tex })
    }
  }
  update(im: Impact, t: number) {
    const f = Math.floor(t * 12)
    if (f === this.last) return
    this.last = f
    this.energy(this.c[0].g, im)
    this.crater(this.c[1].g, im)
    this.damage(this.c[2].g, im)
    for (const c of this.c) c.tex.needsUpdate = true
  }
  private bg(g: CanvasRenderingContext2D, title: string, sub: string) {
    const W = 1024, H = 574
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a0c06'); gr.addColorStop(1, '#0a0503')
    g.fillStyle = gr; g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(255,150,80,0.07)'; g.lineWidth = 1
    for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
    for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
    g.fillStyle = '#ffc48a'; g.font = '700 40px Outfit, sans-serif'; g.textAlign = 'left'; g.fillText(title, 36, 64)
    g.fillStyle = 'rgba(255,200,150,0.6)'; g.font = '500 22px "DM Mono", monospace'; g.fillText(sub, 36, 100)
  }
  private energy(g: CanvasRenderingContext2D, im: Impact) {
    this.bg(g, 'Energy', `${fmtE(im.e)} · ${Math.round(im.hiroshima).toLocaleString('en-US')} Hiroshimas`)
    const items: [string, number][] = [['Hiroshima', 0.015], ['Tsar Bomba', 50], ['Krakatoa', 200], ['All nuclear arms', 6000], ['This impact', im.e]]
    const lo = -3, hi = 9
    items.sort((a, b) => a[1] - b[1])
    items.forEach(([n, e], i) => {
      const y = 150 + i * 78
      const w = Math.max(6, ((Math.log10(Math.max(e, 1e-3)) - lo) / (hi - lo)) * 640)
      const me = n === 'This impact'
      g.fillStyle = me ? '#ff8a3a' : 'rgba(255,200,150,0.25)'
      g.fillRect(300, y, w, 40)
      g.fillStyle = me ? '#ffffff' : 'rgba(255,220,190,0.85)'; g.font = `${me ? 700 : 500} 26px Outfit, sans-serif`; g.textAlign = 'right'
      g.fillText(n, 280, y + 30)
      g.textAlign = 'left'; g.font = '500 22px "DM Mono", monospace'; g.fillText(fmtE(e), 310 + w, y + 29)
    })
  }
  private crater(g: CanvasRenderingContext2D, im: Impact) {
    if (im.water > 0 && !im.airburst) {
      this.bg(g, 'Ocean impact', `cavity ${fmtLen(im.dtcw)} · rim wave ${fmtLen(im.arw)}`)
      const cx = 512, sy = 220, sc = 300 / Math.max(im.dtcw * 0.6, 1)
      const dep = Math.min(260, im.water * sc * 1.0)
      g.fillStyle = '#0d3b52'; g.fillRect(0, sy, 1024, dep)
      g.fillStyle = '#3b2617'; g.fillRect(0, sy + dep, 1024, 574 - sy - dep)
      // the cavity, dashed
      g.fillStyle = '#1a0c06'; g.beginPath()
      const rc = im.dtcw / 2 * sc, dc = Math.min(dep + 20, im.dtcw * 0.3 * sc)
      g.ellipse(cx, sy, rc, dc, 0, 0, Math.PI); g.fill()
      g.strokeStyle = '#ffb070'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, sy, rc, dc, 0, 0, Math.PI); g.stroke()
      g.fillStyle = '#9fe2ff'; g.beginPath(); g.moveTo(cx - rc - 60, sy); g.quadraticCurveTo(cx - rc, sy - im.arw * sc * 1.5 - 8, cx - rc + 30, sy); g.fill()
      g.beginPath(); g.moveTo(cx + rc + 60, sy); g.quadraticCurveTo(cx + rc, sy - im.arw * sc * 1.5 - 8, cx + rc - 30, sy); g.fill()
      g.fillStyle = 'rgba(255,200,150,0.7)'; g.font = '500 20px "DM Mono", monospace'; g.textAlign = 'center'
      g.fillText(`sea ${fmtLen(im.water)} deep · sea floor hit at ${im.vSeafloor.toFixed(1)} km/s`, 512, 548)
      return
    }
    if (im.airburst) {
      this.bg(g, 'No crater', `it exploded ${fmtLen(im.zBurst)} up`)
      g.fillStyle = 'rgba(255,200,150,0.15)'; g.fillRect(0, 430, 1024, 144)
      const y = 430 - Math.min(330, im.zBurst / 120)
      g.fillStyle = '#ffd0a0'; g.beginPath(); g.arc(512, y, 30, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(255,200,150,0.5)'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(512, y); g.lineTo(512, 430); g.stroke(); g.setLineDash([])
      return
    }
    this.bg(g, im.complex ? 'Complex crater' : 'Simple crater', `${fmtLen(im.dfr)} across · ${fmtLen(im.depth)} deep`)
    const cx = 512, gy = 300, sc = 380 / Math.max(im.dfr / 2, 1)
    g.fillStyle = '#3b2617'; g.fillRect(0, gy, 1024, 274)
    g.strokeStyle = '#ffb070'; g.lineWidth = 4
    g.beginPath()
    for (let x = -480; x <= 480; x += 4) {
      const r = Math.abs(x) / sc
      const R = im.dfr / 2
      let h = 0
      if (r < R) h = im.complex ? (r < R * 0.5 ? -im.depth + im.depth * 0.6 * Math.exp(-((r / R / 0.11) ** 2)) : -im.depth * (1 - (r - R * 0.5) / (R * 0.5))) : -im.depth * (1 - (r / R) ** 2)
      else h = im.dfr * 0.03 * (R / r) ** 3
      const y = gy - h * sc * 2.5
      if (x === -480) g.moveTo(cx + x, y); else g.lineTo(cx + x, y)
    }
    g.stroke()
    // transient crater, dashed
    g.setLineDash([10, 10]); g.strokeStyle = 'rgba(255,200,150,0.6)'; g.lineWidth = 2
    g.beginPath()
    const rt = im.dtc / 2, dt = im.dtc / (2 * Math.SQRT2)
    for (let x = -rt * sc; x <= rt * sc; x += 4) { const r = Math.abs(x) / sc; const y = gy + dt * (1 - (r / rt) ** 2) * sc * 2.5 * 0.5; if (x <= -rt * sc + 4) g.moveTo(cx + x, y); else g.lineTo(cx + x, y) }
    g.stroke(); g.setLineDash([])
    g.fillStyle = 'rgba(255,200,150,0.7)'; g.font = '500 20px "DM Mono", monospace'; g.textAlign = 'center'
    g.fillText('transient crater (dashed) · depth x2.5', 512, 548)
  }
  private damage(g: CanvasRenderingContext2D, im: Impact) {
    this.bg(g, 'Damage', im.water > 0 && this.runup > 0 ? `tsunami ${fmtLen(this.runup)} at the city · after ${Math.round(this.arrival / 60)} min` : `quake M ${im.quake > 0 ? im.quake.toFixed(1) : 'none'} · fireball ${fmtLen(im.fireball)}`)
    const cx = 380, cy = 340
    const rings: [string, number, string][] = [['windows', im.r1, 'rgba(120,200,255,0.5)'], ['houses down', im.r3, 'rgba(255,200,80,0.6)'], ['burns', im.rBurn, 'rgba(255,120,40,0.6)'], ['concrete gone', im.r20, 'rgba(255,60,40,0.8)'], ['crater', im.dfr / 2, 'rgba(255,255,255,0.9)']]
    const maxR = Math.max(...rings.map(r => r[1]), 1)
    const sc = 200 / maxR
    // this table, for scale
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.setLineDash([6, 6]); g.strokeRect(cx - HALF * sc, cy - HALF * sc, 2 * HALF * sc, 2 * HALF * sc); g.setLineDash([])
    rings.forEach(([n, r, c], i) => {
      if (r <= 0) return
      g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, Math.max(2, r * sc), 0, Math.PI * 2); g.stroke()
      g.fillStyle = c; g.font = '600 24px Outfit, sans-serif'; g.textAlign = 'left'
      g.fillText(`${n}  ${fmtLen(r)}`, 640, 180 + i * 62)
    })
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '500 20px "DM Mono", monospace'
    g.fillText('dashed: this table', 640, 500)
  }
}
