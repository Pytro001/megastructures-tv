import * as THREE from 'three'

/**
 * Materials for the tunnel boring machine model.
 *
 * Every solid part can be cut by a plane z = const in world space. Fragments
 * past the plane are discarded and the back faces that show through the
 * opening are shaded as the flat machined face of the section, so a solid
 * reads as cut steel or concrete for any position of the plane without any
 * cap geometry. Two cut groups exist: the machine, which the visitor cuts
 * with the slider, and the tunnel, which is always cut down its axis.
 * A world space grime layer dirties everything near the face so nothing
 * looks factory fresh.
 */

export interface CutGroup { z: { value: number }; glow: { value: number } }
export const CUT_M: CutGroup = { z: { value: 50 }, glow: { value: 0 } }
export const CUT_T: CutGroup = { z: { value: 0 }, glow: { value: 0 } }
export const NO_CUT: CutGroup = { z: { value: 1e5 }, glow: { value: 0 } }

/** shared uniforms for highlights: which system glows */
export const HL = {
  muck: { value: 0 }, thrust: { value: 0 }, ring: { value: 0 }, cut: { value: 0 }, time: { value: 0 },
  /** world x of the face, for the grime gradient */
  face: { value: 0 },
  /** world x where the block ends: the backup and the lining stop there */
  clipX: { value: -1e5 },
}

export const NOISE_GLSL = /* glsl */ `
float tb_h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tb_n(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tb_h(i), tb_h(i + vec3(1,0,0)), f.x), mix(tb_h(i + vec3(0,1,0)), tb_h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(tb_h(i + vec3(0,0,1)), tb_h(i + vec3(1,0,1)), f.x), mix(tb_h(i + vec3(0,1,1)), tb_h(i + vec3(1,1,1)), f.x), f.y), f.z); }
float tb_fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * tb_n(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
vec3 tb_bump(vec3 pos, vec3 n, float h, float k){
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - g * k);
}
`

export interface CutOpts {
  cut?: CutGroup
  /** colour of the section face */
  cap?: number
  capMetal?: number
  /** 0..1, how much dirt collects on it */
  grime?: number
  /** world scale noise for a brushed or cast surface, 0 = none */
  bump?: number
  bumpScale?: number
  /** which highlight uniform makes it glow, and in what colour */
  hl?: keyof typeof HL
  hlColor?: number
  /** extra shader code: uniforms, GLSL helpers, colour, discard */
  uniforms?: Record<string, { value: unknown }>
  pars?: string
  color?: string
  discard?: string
}

/** patch a standard or physical material to follow a cut group */
export function cutify<T extends THREE.MeshStandardMaterial>(m: T, o: CutOpts = {}): T {
  const cut = o.cut ?? CUT_M
  const cap = new THREE.Color(o.cap ?? 0x8c9096)
  const hlU = o.hl ? HL[o.hl] : { value: 0 }
  const hlC = new THREE.Color(o.hlColor ?? 0x5ed8ff)
  m.side = THREE.DoubleSide
  m.shadowSide = THREE.FrontSide
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCutZ = cut.z
    sh.uniforms.uCutGlow = cut.glow
    sh.uniforms.uCap = { value: cap }
    sh.uniforms.uCapMetal = { value: o.capMetal ?? 0.9 }
    sh.uniforms.uGrime = { value: o.grime ?? 0 }
    sh.uniforms.uBump = { value: o.bump ?? 0 }
    sh.uniforms.uBumpS = { value: o.bumpScale ?? 40 }
    sh.uniforms.uHl = hlU
    sh.uniforms.uHlC = { value: hlC }
    sh.uniforms.uTime = HL.time
    sh.uniforms.uFace = HL.face
    sh.uniforms.uClipX = HL.clipX
    if (o.uniforms) Object.assign(sh.uniforms, o.uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vOP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          #endif
          vOP = wp.xyz;
          vWP = (modelMatrix * wp).xyz; }`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vOP;
        uniform float uCutZ, uCutGlow, uCapMetal, uGrime, uBump, uBumpS, uHl, uTime, uFace, uClipX;
        uniform vec3 uCap, uHlC;
        ${NOISE_GLSL}
        ${o.pars ?? ''}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vWP.z > uCutZ || vWP.x < uClipX) discard;
        ${o.discard ?? ''}
        bool tbCap = !gl_FrontFacing;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${o.color ?? ''}
        float tbG = 0.0;
        if (uGrime > 0.0) {
          float gn = tb_fbm(vWP * 90.0);
          float nearFace = smoothstep(-0.12, 0.01, vWP.x - uFace);
          tbG = uGrime * smoothstep(0.5, 0.9, gn * 0.75 + nearFace * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.15, 0.11), tbG * 0.7);
        }
        if (tbCap) diffuseColor.rgb = uCap * (0.92 + 0.08 * tb_n(vWP * 900.0));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.9, tbG);
        if (uBump > 0.0) roughnessFactor *= 0.85 + 0.3 * tb_n(vWP * uBumpS * 2.3);
        if (tbCap) roughnessFactor = 0.32 + 0.1 * tb_n(vec3(vWP.xy * 4000.0, 0.0));`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.0, tbG);
        if (tbCap) metalnessFactor = uCapMetal;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (tbCap) normal = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
        else if (uBump > 0.0) normal = tb_bump(-vViewPosition, normal, tb_fbm(vWP * uBumpS), uBump * 0.012);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float e = 1.0 - smoothstep(0.0, 0.0035, uCutZ - vWP.z);
          totalEmissiveRadiance += vec3(0.35, 0.85, 1.0) * e * uCutGlow * 7.0;
          if (uHl > 0.001) {
            float pulse = 0.65 + 0.35 * sin(uTime * 3.0 - vWP.x * 40.0);
            float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
            totalEmissiveRadiance += uHlC * uHl * (0.08 + 0.7 * fres) * pulse;
          } }`)
  }
  const key = `tbcut-${cut === CUT_M ? 'm' : cut === CUT_T ? 't' : 'n'}-${o.hl ?? ''}-${(o.pars ?? '') + (o.color ?? '') + (o.discard ?? '')}`
  m.customProgramCacheKey = () => key
  return m
}

const std = (p: THREE.MeshStandardMaterialParameters, o?: CutOpts) => cutify(new THREE.MeshStandardMaterial(p), o)
const phys = (p: THREE.MeshPhysicalMaterialParameters, o?: CutOpts) => cutify(new THREE.MeshPhysicalMaterial(p), o)

/** the machine's palette */
export function machineMats() {
  return {
    head: phys({ color: 0xe9a514, metalness: 0.25, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }, { cap: 0x9aa0a8, grime: 0.9, bump: 0.25, bumpScale: 45 }),
    headDark: std({ color: 0x2b2d31, metalness: 0.7, roughness: 0.42 }, { cap: 0x8c9198, grime: 0.6, bump: 0.2 }),
    cutter: std({ color: 0x9aa1a8, metalness: 1, roughness: 0.22 }, { cap: 0xb5bac0, grime: 0.25 }),
    cutterHub: std({ color: 0x33363b, metalness: 0.9, roughness: 0.38 }, { cap: 0x9ea3a9 }),
    carbide: std({ color: 0xc8ccd0, metalness: 1, roughness: 0.16 }, { cap: 0xc8ccd0 }),
    shield: phys({ color: 0x6d7379, metalness: 0.82, roughness: 0.36, clearcoat: 0.15 }, { cap: 0xa3a8ae, grime: 0.55, bump: 0.35, bumpScale: 28 }),
    shieldPaint: phys({ color: 0x1d2a3a, metalness: 0.35, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 }, { cap: 0x9aa0a8, grime: 0.35, bump: 0.15 }),
    steel: std({ color: 0x8a9096, metalness: 0.9, roughness: 0.32 }, { cap: 0xb0b5ba, bump: 0.15 }),
    darkSteel: std({ color: 0x24272b, metalness: 0.8, roughness: 0.45 }, { cap: 0x8d9298 }),
    motor: phys({ color: 0x2f5d8a, metalness: 0.4, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }, { cap: 0x9aa0a8 }),
    orange: phys({ color: 0xe0561b, metalness: 0.3, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }, { cap: 0x9aa0a8 }),
    barrel: phys({ color: 0xd8a017, metalness: 0.35, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 }, { cap: 0xb0b5ba, hl: 'thrust', hlColor: 0xffa13a }),
    chrome: std({ color: 0xe6eaee, metalness: 1, roughness: 0.06 }, { cap: 0xd0d4d8, hl: 'thrust', hlColor: 0xffa13a }),
    rubber: std({ color: 0x141416, metalness: 0, roughness: 0.85 }, { cap: 0x222226 }),
    screwTube: phys({ color: 0x8b1f1a, metalness: 0.35, roughness: 0.4, clearcoat: 0.5 }, { cap: 0xa0a5aa, grime: 0.4, hl: 'muck', hlColor: 0xffb347 }),
    screwFlight: std({ color: 0xa7adb3, metalness: 1, roughness: 0.3 }, { cap: 0xc0c5ca, grime: 0.7 }),
    white: phys({ color: 0xe8e9e6, metalness: 0.1, roughness: 0.45, clearcoat: 0.3 }, { cap: 0xb5b8bb, grime: 0.2 }),
    erector: phys({ color: 0xe9a514, metalness: 0.25, roughness: 0.4, clearcoat: 0.4 }, { cap: 0x9aa0a8, grime: 0.2, hl: 'ring', hlColor: 0x7cf0c0 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2b8, emissiveIntensity: 9 }),
    lampCool: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xbfe6ff, emissiveIntensity: 7 }),
    redLamp: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2a1a, emissiveIntensity: 10 }),
    greenLamp: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x39ff88, emissiveIntensity: 8 }),
  }
}
export type MachineMats = ReturnType<typeof machineMats>

/** the tunnel's palette: always cut down the axis */
export function tunnelMats() {
  const o = { cut: CUT_T }
  return {
    segment: std({ color: 0xbdb8ad, metalness: 0, roughness: 0.82 }, { ...o, cap: 0x9c978d, capMetal: 0, bump: 0.5, bumpScale: 70, hl: 'ring', hlColor: 0x7cf0c0 }),
    key: std({ color: 0xc9c2b3, metalness: 0, roughness: 0.8 }, { ...o, cap: 0x9c978d, capMetal: 0, bump: 0.5, bumpScale: 70, hl: 'ring', hlColor: 0x7cf0c0 }),
    grout: std({ color: 0x6f7468, metalness: 0, roughness: 0.95 }, { ...o, cap: 0x5d6258, capMetal: 0, bump: 0.6, bumpScale: 50 }),
    gantry: phys({ color: 0xe8e9e6, metalness: 0.15, roughness: 0.45, clearcoat: 0.3 }, { ...o, cap: 0xb5b8bb, grime: 0.15 }),
    rail: std({ color: 0xe9b316, metalness: 0.3, roughness: 0.45 }, { ...o, cap: 0xa0a5aa }),
    steel: std({ color: 0x80868c, metalness: 0.9, roughness: 0.34 }, { ...o, cap: 0xb0b5ba }),
    dark: std({ color: 0x26292d, metalness: 0.7, roughness: 0.5 }, { ...o, cap: 0x8d9298 }),
    cabinet: phys({ color: 0x3a4a5c, metalness: 0.4, roughness: 0.38, clearcoat: 0.4 }, { ...o, cap: 0x9aa0a8 }),
    tank: phys({ color: 0x2f7a55, metalness: 0.3, roughness: 0.35, clearcoat: 0.5 }, { ...o, cap: 0x9aa0a8 }),
    tankBlue: phys({ color: 0x2a5d96, metalness: 0.3, roughness: 0.35, clearcoat: 0.5 }, { ...o, cap: 0x9aa0a8 }),
    orange: phys({ color: 0xe0561b, metalness: 0.3, roughness: 0.38, clearcoat: 0.6 }, { ...o, cap: 0x9aa0a8 }),
    duct: std({ color: 0xd9d4c4, metalness: 0, roughness: 0.7 }, { ...o, cap: 0xb8b3a4, capMetal: 0, bump: 0.4, bumpScale: 20 }),
    belt: std({ color: 0x18191b, metalness: 0, roughness: 0.75 }, { ...o, cap: 0x2a2b2e, capMetal: 0, hl: 'muck', hlColor: 0xffb347 }),
    pipeR: phys({ color: 0xb3261e, metalness: 0.3, roughness: 0.35, clearcoat: 0.5 }, { ...o, cap: 0xa0a5aa }),
    pipeB: phys({ color: 0x2569b8, metalness: 0.3, roughness: 0.35, clearcoat: 0.5 }, { ...o, cap: 0xa0a5aa }),
    pipeG: phys({ color: 0x2e8a4e, metalness: 0.3, roughness: 0.35, clearcoat: 0.5 }, { ...o, cap: 0xa0a5aa }),
    cable: std({ color: 0x111214, metalness: 0.1, roughness: 0.6 }, { ...o, cap: 0x333333 }),
    hivis: std({ color: 0xff7a1a, metalness: 0, roughness: 0.6, emissive: 0x2a0d00 }, { ...o, cap: 0xff7a1a, capMetal: 0 }),
    helmet: std({ color: 0xf2f2ee, metalness: 0, roughness: 0.35 }, { ...o, cap: 0xf2f2ee, capMetal: 0 }),
    skin: std({ color: 0x8a5a3c, metalness: 0, roughness: 0.6 }, { ...o, cap: 0x8a5a3c, capMetal: 0 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2b8, emissiveIntensity: 7 }),
  }
}
export type TunnelMats = ReturnType<typeof tunnelMats>

/** a soft round sprite for sparks, dust and glows */
export function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}
