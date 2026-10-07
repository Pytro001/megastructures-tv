import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { LAYER_GLOW } from '../render/layers'

/**
 * The studio look for an exhibit: a machined console it stands on, with live
 * instrument displays set into its front face (round gauges, dot-matrix charts,
 * chevrons), warm amber LED strips, soft warm key light and a few low-poly
 * props to give the background something to blur. Everything is drawn on
 * canvases redrawn a few times a second.
 */

export interface ConsoleOpts {
  w: number; d: number; h: number
  accent: string // css colour for the displays
  warm?: string
  /** draw the front display; W x H canvas pixels */
  draw: (g: CanvasRenderingContext2D, W: number, H: number, t: number, ui: DisplayKit) => void
  rate?: number
}

export interface DisplayKit {
  gauge: (cx: number, cy: number, r: number, v: number, label: string, value: string, col?: string) => void
  dots: (x: number, y: number, w: number, h: number, vals: number[], col?: string, label?: string) => void
  chevrons: (x: number, y: number, n: number, phase: number, dir: 1 | -1, col?: string) => void
  text: (s: string, x: number, y: number, size: number, col?: string, align?: CanvasTextAlign, weight?: number) => void
  panel: (x: number, y: number, w: number, h: number) => void
}

export function makeConsole(o: ConsoleOpts) {
  const G = new THREE.Group()
  const top = new THREE.MeshStandardMaterial({ color: 0x4a4540, metalness: 0.35, roughness: 0.42 })
  const body = new THREE.MeshStandardMaterial({ color: 0x1d1b1a, metalness: 0.55, roughness: 0.36 })
  const trim = new THREE.MeshStandardMaterial({ color: 0x8c7a5c, metalness: 0.9, roughness: 0.28 })
  const base = new THREE.Mesh(new RoundedBoxGeometry(o.w, o.h, o.d, 6, 0.05), body)
  base.position.y = o.h / 2; base.castShadow = base.receiveShadow = true; G.add(base)
  const slab = new THREE.Mesh(new RoundedBoxGeometry(o.w + 0.04, 0.06, o.d + 0.04, 6, 0.025), top)
  slab.position.y = o.h + 0.03; slab.castShadow = slab.receiveShadow = true; G.add(slab)
  const foot = new THREE.Mesh(new RoundedBoxGeometry(o.w - 0.1, 0.06, o.d - 0.1, 4, 0.02), trim)
  foot.position.y = 0.03; G.add(foot)
  // the front display, set into the face at a slight backward tilt
  const W = 2048, H = Math.round(2048 * (o.h * 0.62) / (o.w * 0.9))
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 0.9, o.h * 0.62), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: true }))
  scr.position.set(0, o.h * 0.5, o.d / 2 + 0.004); scr.layers.set(LAYER_GLOW); G.add(scr)
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(o.w * 0.92, o.h * 0.66, 0.012, 3, 0.005), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, metalness: 0.3, roughness: 0.2 }))
  bezel.position.set(0, o.h * 0.5, o.d / 2 - 0.002); G.add(bezel)
  // amber LED lines: under the slab lip and along the foot
  const warm = new THREE.Color(o.warm ?? '#ffb15a')
  const led = (y: number, z: number, w: number, k: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(k) })); m.position.set(0, y, z); m.layers.set(LAYER_GLOW); G.add(m); return m }
  led(o.h - 0.008, o.d / 2 + 0.02, o.w, 3.2)
  led(0.075, o.d / 2 - 0.03, o.w - 0.12, 2.4)

  const kit: DisplayKit = {
    panel(x, y, w, h) {
      g.fillStyle = 'rgba(255,255,255,0.025)'; g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 3
      g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill(); g.stroke()
    },
    text(s, x, y, size, col = '#e9e4da', align = 'left', weight = 600) {
      g.font = `${weight} ${size}px "DM Mono", ui-monospace, monospace`; g.fillStyle = col; g.textAlign = align; g.shadowColor = col; g.shadowBlur = 0
      g.fillText(s, x, y); g.textAlign = 'left'
    },
    gauge(cx, cy, r, v, label, value, col = o.accent) {
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25
      g.lineCap = 'round'
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = r * 0.16
      g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke()
      // dashed tick ring
      for (let i = 0; i <= 40; i++) {
        const a = a0 + (a1 - a0) * (i / 40), on = i / 40 <= v
        g.strokeStyle = on ? col : 'rgba(255,255,255,0.12)'; g.lineWidth = i % 5 === 0 ? 5 : 3
        g.shadowColor = col; g.shadowBlur = on ? 18 : 0
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2); g.lineTo(cx + Math.cos(a) * r * (i % 5 === 0 ? 1.36 : 1.3), cy + Math.sin(a) * r * (i % 5 === 0 ? 1.36 : 1.3)); g.stroke()
      }
      g.strokeStyle = col; g.lineWidth = r * 0.16; g.shadowColor = col; g.shadowBlur = 30
      g.beginPath(); g.arc(cx, cy, r, a0, a0 + (a1 - a0) * Math.max(0.001, Math.min(1, v))); g.stroke()
      g.shadowBlur = 0
      kit.text(value, cx, cy + r * 0.12, r * 0.42, '#f6f1e8', 'center', 700)
      kit.text(label, cx, cy + r * 0.62, r * 0.17, 'rgba(233,228,218,0.6)', 'center', 500)
    },
    dots(x, y, w, h, vals, col = o.accent, label) {
      const cols = vals.length, rows = 14, cw = w / cols, rh = h / rows
      for (let i = 0; i < cols; i++) {
        const n = Math.round(Math.max(0, Math.min(1, vals[i])) * rows)
        for (let j = 0; j < rows; j++) {
          const on = j < n
          g.fillStyle = on ? col : 'rgba(255,255,255,0.07)'; g.shadowColor = col; g.shadowBlur = on ? 10 : 0
          g.beginPath(); g.arc(x + i * cw + cw / 2, y + h - j * rh - rh / 2, Math.min(cw, rh) * 0.3, 0, Math.PI * 2); g.fill()
        }
      }
      g.shadowBlur = 0
      if (label) kit.text(label, x, y - 18, 26, 'rgba(233,228,218,0.6)', 'left', 500)
    },
    chevrons(x, y, n, phase, dir, col = o.accent) {
      for (let i = 0; i < n; i++) {
        const a = 0.25 + 0.75 * Math.max(0, Math.sin((i / n - phase * dir) * Math.PI * 2))
        g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = 9; g.lineCap = 'round'; g.shadowColor = col; g.shadowBlur = 16
        const cx = x + i * 46 * dir
        g.beginPath(); g.moveTo(cx - 12 * dir, y - 22); g.lineTo(cx + 12 * dir, y); g.lineTo(cx - 12 * dir, y + 22); g.stroke()
      }
      g.globalAlpha = 1; g.shadowBlur = 0
    },
  }
  let acc = 1e9
  const rate = o.rate ?? 15
  return {
    group: G,
    topY: o.h + 0.06,
    update(t: number, dt: number) {
      acc += dt
      if (acc < 1 / rate) return
      acc = 0
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d0c0c'); bg.addColorStop(1, '#070707')
      g.fillStyle = bg; g.fillRect(0, 0, W, H)
      o.draw(g, W, H, t, kit)
      tex.needsUpdate = true
    },
  }
}

/** Warm studio dressing for a bay: amber strip lights on the wall, a warm key light and some low-poly props. */
export function makeStudioBay(o: { wallZ: number; width: number; seed?: number; props?: boolean }) {
  const G = new THREE.Group()
  const amber = (k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb15a').multiplyScalar(k) })
  for (const [y, k] of [[1.05, 2.6], [3.2, 1.8]] as const) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(o.width, 0.03, 0.03), amber(k)); s.position.set(0, y, o.wallZ + 0.1); s.layers.set(LAYER_GLOW); G.add(s)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(o.width, 0.5), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vU; void main(){ float a = exp(-pow((vU.y - 0.5) / 0.14, 2.0)) * smoothstep(0.0, 0.1, vU.x) * smoothstep(1.0, 0.9, vU.x); gl_FragColor = vec4(vec3(1.0, 0.62, 0.28) * a * 0.35, 1.0); }',
    }))
    halo.position.set(0, y, o.wallZ + 0.09); halo.layers.set(LAYER_GLOW); G.add(halo)
  }
  // warm key light from above and a cool rim from the side
  const key = new THREE.SpotLight(0xffd6a8, 38, 14, 0.75, 0.8, 1.6); key.position.set(1.8, 5.4, 3.4); key.target.position.set(0, 0.8, 0); G.add(key, key.target)
  const rim = new THREE.SpotLight(0x9fc8ff, 34, 12, 0.7, 0.9, 1.6); rim.position.set(-3.4, 3.6, -2.4); rim.target.position.set(0, 1.2, 0); G.add(rim, rim.target)
  if (o.props !== false) {
    let s = o.seed ?? 3
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    const glowM = (c: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) })
    const cordM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 1, roughness: 0.3 })
    // pendant globes hanging from the ceiling at different heights, behind the exhibit
    for (let i = 0; i < 9; i++) {
      const x = -4.6 + i * 1.15 + (rnd() - 0.5) * 0.3, z = o.wallZ + 1.0 + rnd() * 1.6, y = 2.7 + rnd() * 1.4
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 7 - y, 6), cordM); cord.position.set(x, y + (7 - y) / 2, z); G.add(cord)
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.06, 16), brass); cap.position.set(x, y + 0.13, z); G.add(cap)
      const r = 0.09 + rnd() * 0.05
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), glowM('#ffc88a', 2.2 + rnd())); bulb.position.set(x, y, z); bulb.layers.set(LAYER_GLOW); G.add(bulb)
    }
    // backlit wood slat panels on both sides
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.55 })
    for (const sx of [-1, 1]) {
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 4.4), glowM('#ff9a4a', 0.9)); back.position.set(sx * 5.4, 2.2, o.wallZ + 0.05); back.layers.set(LAYER_GLOW); G.add(back)
      for (let k = 0; k < 14; k++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(0.07, 4.4, 0.08), wood); slat.position.set(sx * 5.4 - 0.8 + k * 0.123, 2.2, o.wallZ + 0.12); slat.castShadow = true; G.add(slat) }
      // a tall light column in front of each panel
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 16), glowM('#9fd8ff', 2.6)); col.position.set(sx * 4.3, 1.3, o.wallZ + 1.1); col.layers.set(LAYER_GLOW); G.add(col)
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 24), brass); foot.position.set(sx * 4.3, 0.02, o.wallZ + 1.1); G.add(foot)
    }
    // neon rings on the wall above the posters
    for (const [x, c] of [[-2.4, '#7fd8ff'], [2.4, '#c3a6ff']] as const) {
      for (let k = 0; k < 3; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62 - k * 0.14, 0.014, 8, 96), glowM(c, 3 - k * 0.6)); ring.position.set(x, 4.45, o.wallZ + 0.08); ring.layers.set(LAYER_GLOW); G.add(ring) }
    }
    // floor uplights washing the wall
    for (let i = 0; i < 6; i++) {
      const x = -3.7 + i * 1.48
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 20), brass); cup.position.set(x, 0.025, o.wallZ + 0.35); G.add(cup)
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), glowM('#ffd2a0', 3)); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.052, o.wallZ + 0.35); disc.layers.set(LAYER_GLOW); G.add(disc)
      const wash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec2 vU; void main(){ float a = (1.0 - vU.y) * exp(-pow((vU.x - 0.5) / (0.12 + vU.y * 0.25), 2.0)); gl_FragColor = vec4(vec3(1.0, 0.7, 0.4) * a * 0.45, 1.0); }',
      }))
      wash.position.set(x, 1.1, o.wallZ + 0.06); wash.layers.set(LAYER_GLOW); G.add(wash)
    }
  }
  return { group: G, lights: [key, rim] as THREE.Light[] }
}
