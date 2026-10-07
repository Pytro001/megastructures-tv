import * as THREE from 'three'
import { surf, type SurfOpts } from 'megastructures-engine/core/materials'
import { CutState, CUT_PROJ, GLSL_CUT_FRAG, GLSL_CUT_FRAG_PARS, GLSL_CUT_VERT, GLSL_CUT_VERT_PARS } from 'megastructures-engine/core/cut'
import { GLSL_NOISE, NOISE3D } from 'megastructures-engine/core/noise'
import { FLUIDS, FLUID_TIME, FLUID_ON, type FluidKind } from '../raptor/fluid'
import { B, S0, TANKS } from './dims'

/** live values every vehicle shader reads */
export const VU = {
  /** liquid surface heights: booster LOX, booster CH4, ship LOX, ship CH4 */
  uLevels: { value: new THREE.Vector4(30, 60, S0 + 20, S0 + 29) },
  /** soot from hot staging on the booster's top and the ship's base, 0..1 */
  uScorch: { value: 0 },
  /** orange light from the plume on the base heat shields, booster and ship */
  uBaseGlow: { value: new THREE.Vector2(1, 0) },
  uTime: FLUID_TIME,
}

/** patch a surf material: extra uniforms, and code after given chunks */
function extend(m: THREE.MeshStandardMaterial, key: string, uniforms: Record<string, { value: unknown }>, pars: string, chunks: Record<string, string>) {
  const prev = m.onBeforeCompile
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r)
    Object.assign(sh.uniforms, uniforms)
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>\n${pars}`)
    for (const [k, code] of Object.entries(chunks)) f = f.replace(k, `${k}\n${code}`)
    sh.fragmentShader = f
  }
  const pk = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => pk() + '|' + key
  // the cut cap material is made lazily from the same options; patch it the same way
  const mk = m.userData.makeBack as (() => THREE.MeshStandardMaterial) | undefined
  if (mk) m.userData.makeBack = () => extend(mk(), key, uniforms, pars, chunks)
  return m
}

const TANK_GLSL = /* glsl */ `
uniform vec4 uLevels; uniform float uScorch; uniform vec2 uBaseGlow;
float sHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// how cold the outside skin is at this height: 1 below a liquid surface, 0 above
float coldAt(float y){
  float c = 0.0;
  c = max(c, step(${(TANKS.B.lox.y0 + 1.5).toFixed(2)}, y) * step(y, ${TANKS.B.lox.yTop.toFixed(2)}) * step(y, uLevels.x));
  c = max(c, step(${TANKS.B.ch4.yBot.toFixed(2)}, y) * step(y, uLevels.y));
  c = max(c, step(${(TANKS.S.lox.y0 + 1.5).toFixed(2)}, y) * step(y, ${TANKS.S.lox.yTop.toFixed(2)}) * step(y, uLevels.z));
  c = max(c, step(${TANKS.S.ch4.yBot.toFixed(2)}, y) * step(y, uLevels.w));
  return c;
}
`

/**
 * Stainless steel skin: rings of 1.83 m welded on top of each other, a few
 * vertical seams, heat tint along the welds, and frost wherever the
 * propellant behind the wall is colder than the air (so the frost line on the
 * outside is the liquid level inside).
 */
export function steel(cut: CutState, o: Partial<SurfOpts> & { frost?: boolean; welds?: boolean; base?: number } = {}) {
  const m = surf({
    name: o.name ?? 'steel', color: o.color ?? 0xbdc1c6, metalness: 1, roughness: o.roughness ?? 0.36, detail: o.detail ?? 0.55, roughVar: 0.45, colorVar: 0.07,
    anisotropy: o.anisotropy ?? 0.15, anisotropyRotation: Math.PI / 2, bump: o.bump ?? 0.0006, cut, capColor: 0xc9ccd1, capRoughness: 0.4, capMetalness: 0.6,
    envMapIntensity: o.envMapIntensity ?? 1,
  })
  const frost = o.frost ?? true, welds = o.welds ?? true
  return extend(m, `steel${+frost}${+welds}${o.base ?? 0}`, VU as unknown as Record<string, { value: unknown }>, TANK_GLSL, {
    '#include <color_fragment>': /* glsl */ `
float stFrost = 0.0, stWeld = 0.0;
if (!cutCap) {
  float y = vObj.y;
  float ang = atan(vObj.z, vObj.x);
  ${welds ? `
  float ring = floor(y / 1.83);
  float dy = abs(y - (ring + 0.5) * 1.83) - 0.915;
  stWeld = exp(-pow(dy / 0.011, 2.0));
  float tintB = exp(-pow(dy / 0.07, 2.0)) * (0.5 + 0.5 * n3(vObj * 0.9));
  // three vertical seams per ring, staggered
  float seamA = sHash(vec2(ring, 3.1)) * 6.2832;
  float seam = 0.0;
  for (int k = 0; k < 3; k++) { float a = mod(ang - seamA - float(k) * 2.0944 + 9.4248, 6.2832) - 3.1416; seam = max(seam, exp(-pow(a * 4.5 / 0.013, 2.0))); }
  stWeld = max(stWeld, seam * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.02, 0.92, 0.74), tintB * 0.45);
  diffuseColor.rgb *= 1.0 - stWeld * 0.35;
  // slightly different sheet from ring to ring
  diffuseColor.rgb *= 0.95 + 0.1 * sHash(vec2(ring, floor(mod(ang - seamA + 6.2832, 6.2832) / 2.0944)));
  ` : ''}
  ${o.base ? `
  // the base of the booster: soot pushed back up by the plume at altitude
  float soot = smoothstep(${(o.base + 4).toFixed(1)}, ${o.base.toFixed(1)}, y + (n3(vObj * vec3(0.4, 0.06, 0.4)) - 0.5) * 3.0);
  diffuseColor.rgb *= 1.0 - soot * 0.7;
  ` : ''}
  ${frost ? `
  float cold = coldAt(y);
  // frost: nearly everywhere the liquid is behind the wall, streaked by the airflow, thin near the level
  float streak = n3(vObj * vec3(1.6, 0.05, 1.6));
  float fpatch = fbm2(vObj * vec3(0.35, 0.12, 0.35));
  stFrost = cold * smoothstep(0.18, 0.42, fpatch + stWeld * 0.2) * (0.72 + 0.28 * streak);
  vec3 frostC = vec3(0.84, 0.88, 0.93) * (0.9 + 0.16 * n3(vObj * 5.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, frostC, stFrost);
  ` : ''}
  // hot staging scorches the top of the booster and the ship's skirt
  float sc = uScorch * (smoothstep(${(B.hsr0 - 4).toFixed(1)}, ${B.hsr1.toFixed(1)}, y) * step(y, ${(S0 + 2.2).toFixed(1)}) * smoothstep(${(S0 + 2.2).toFixed(1)}, ${(S0 + 0.2).toFixed(1)}, y + 0.0) + smoothstep(${(B.hsr0 - 4).toFixed(1)}, ${B.hsr0.toFixed(1)}, y) * step(y, ${B.hsr1.toFixed(1)}));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.32, 0.28, 0.26), clamp(sc, 0.0, 1.0) * (0.6 + 0.4 * n3(vObj * 0.8)));
}
`,
    '#include <metalnessmap_fragment>': /* glsl */ `
if (!cutCap) {
  roughnessFactor = mix(roughnessFactor, 0.55, stWeld * 0.6);
  roughnessFactor = mix(roughnessFactor, 0.92, stFrost);
  metalnessFactor = mix(metalnessFactor, 0.0, stFrost);
}
`,
  })
}

/**
 * The ship's heat shield: about 18,000 black hexagonal tiles on the windward
 * half, small gaps between them, a few lighter replacement tiles.
 */
export function tiles(cut: CutState, o: { sector?: number; flap?: boolean } = {}) {
  const m = surf({ name: 'tiles', color: 0x141516, metalness: 0, roughness: 0.66, detail: 3, roughVar: 0.3, colorVar: 0.12, cut, capColor: 0xe9e6df, capRoughness: 0.9, capMetalness: 0 })
  const sector = o.sector ?? 1.72
  return extend(m, `tiles${o.flap ? 'f' : ''}`, VU as unknown as Record<string, { value: unknown }>, TANK_GLSL + /* glsl */ `
vec3 hexCell(vec2 p){
  // returns (distance to edge, cell id)
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = p - g;
  vec2 q = abs(g);
  float d = 0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
  return vec3(d, sHash(id * 0.37), 0.0);
}`, {
    '#include <color_fragment>': /* glsl */ `
${o.flap ? '' : `{
  vec3 P = cutCap ? cutHit : vObj;
  float ang = atan(P.z, P.x);
  float wob = 0.06 * sin(P.y * 0.9) + 0.04 * sin(P.y * 2.3 + 1.0);
  if (abs(ang) > ${sector.toFixed(3)} + wob) discard;
}`}
float tGap = 0.0;
if (!cutCap) {
  ${o.flap ? 'vec2 tp = vec2(vObj.z, vObj.y) / 0.31;' : 'vec2 tp = vec2(atan(vObj.z, vObj.x) * 4.5, vObj.y) / 0.31;'}
  vec3 hc = hexCell(tp);
  tGap = 1.0 - smoothstep(0.015, 0.045, hc.x);
  float shade = 0.82 + 0.36 * hc.y;
  float light = step(0.985, hc.y);
  diffuseColor.rgb *= shade;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.42, 0.41), light);
  diffuseColor.rgb *= 1.0 - tGap * 0.7;
  float scT = uScorch * smoothstep(${(S0 + 3).toFixed(1)}, ${S0.toFixed(1)}, vObj.y);
  diffuseColor.rgb *= 1.0 - scT * 0.4;
}
`,
    '#include <metalnessmap_fragment>': /* glsl */ `
if (!cutCap) roughnessFactor = mix(roughnessFactor, 0.95, tGap);
`,
  })
}

/** dark heat shield plates at the bottom of each stage: they glow orange in the plume's light */
export function baseShield(cut: CutState, which: 0 | 1) {
  const m = surf({ name: 'baseshield', color: 0x2a2928, metalness: 0.2, roughness: 0.78, detail: 2.2, roughVar: 0.3, colorVar: 0.2, cut, capColor: 0x9a9a98, capMetalness: 0.1, emissive: 0xff6a24, emissiveIntensity: 1 })
  return extend(m, 'base' + which, VU as unknown as Record<string, { value: unknown }>, TANK_GLSL, {
    '#include <emissivemap_fragment>': /* glsl */ `
if (!cutCap) {
  float g = ${which ? 'uBaseGlow.y' : 'uBaseGlow.x'};
  float n = fbm2(vObj * 0.9);
  totalEmissiveRadiance *= g * (0.2 + 0.8 * smoothstep(0.35, 0.8, n)) * 0.35;
} else totalEmissiveRadiance *= 0.0;
`,
  })
}

/**
 * Liquid propellant in a tank. Drawn only where the section cut opens it:
 * the cut face of the liquid glows in its colour, drifts down toward the
 * outlet, and stops at the liquid surface (the ullage gas above it is a
 * second mesh with the same shape).
 */
export function liquid(cut: CutState, kind: FluidKind, levelIdx: 0 | 1 | 2 | 3, ullage = false) {
  const F = FLUIDS[kind]
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uCutPlane: cut.uPlane, uCutPlane2: cut.uPlane2, uCutGlow: cut.uGlow, uCutProj: CUT_PROJ, uNoise3D: NOISE3D,
      uColor: { value: F.color }, uEmph: F.emph, uTime: FLUID_TIME, uOn: FLUID_ON, uLevels: VU.uLevels,
    },
    vertexShader: /* glsl */ `
#include <common>
${GLSL_CUT_VERT_PARS}
varying vec3 vViewPosition;
#include <clipping_planes_pars_vertex>
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = -mvPosition.xyz;
  ${GLSL_CUT_VERT}
}`,
    fragmentShader: /* glsl */ `
#include <common>
${GLSL_CUT_FRAG_PARS}
${GLSL_NOISE}
#include <clipping_planes_pars_fragment>
varying vec3 vViewPosition;
uniform vec3 uColor; uniform float uEmph, uTime, uOn; uniform vec4 uLevels;
void main() {
  vec4 diffuseColor = vec4(1.0);
  #include <clipping_planes_fragment>
  ${GLSL_CUT_FRAG}
  if (!cutCap) discard;
  vec3 P = cutHit;
  float lv = uLevels[${levelIdx}];
  float wave = (n3(vec3(P.x * 0.08 + uTime * 0.05, uTime * 0.08, P.z * 0.08)) - 0.5) * 0.35;
  float d = P.y - (lv + wave);
  ${ullage ? 'if (d < 0.0) discard;' : 'if (d > 0.0) discard;'}
  float thick = length(vObj - cutHit);
  vec3 col;
  ${ullage ? `
  // pressurant gas: hot oxygen or methane from the engines, swirling in from the top
  float sw = n3(vec3(P.x * 0.06, P.y * 0.05 - uTime * 0.12, P.z * 0.06 + uTime * 0.03));
  float I = (0.05 + 0.12 * sw) * min(thick, 6.0) * 0.3 + exp(-d * 1.4) * 0.35;
  col = mix(uColor, vec3(1.0), 0.3) * I;
  gl_FragColor = vec4(col * uEmph * uOn, 1.0);
  ` : `
  // looking into a body of liquid: thin at the wall, deep in the middle (Beer Lambert through the far half)
  float k = 1.0 - exp(-thick * 0.45);
  // it drains toward the outlet at the bottom centre: flow lines that converge as they go down
  float rr = length(P.xz);
  float ph = P.y * 0.22 + uTime * 0.55 + rr * 0.08;
  float bands = smoothstep(0.15, 0.85, abs(fract(ph) * 2.0 - 1.0));
  float st = n3(vec3(P.x * 0.07, P.y * 0.03 + uTime * 0.05, P.z * 0.07));
  float fine = n3(vec3(P.x * 0.45, P.y * 0.18 + uTime * 0.3, P.z * 0.45));
  // specks carried down with the flow
  vec2 sg = vec2(P.x * 3.0, P.y * 3.0 + uTime * 1.6);
  vec2 sc = floor(sg), sf = fract(sg) - 0.5;
  float sh = fract(sin(dot(sc, vec2(12.9898, 78.233))) * 43758.5453);
  float speck = step(0.93, sh) * smoothstep(0.18, 0.0, length(sf));
  vec3 shallow = mix(uColor, vec3(1.0), 0.12);
  vec3 c0 = mix(shallow * 1.3, uColor * 0.55, k);
  float I = (0.75 + 0.25 * bands) * (0.75 + 0.45 * st) * (0.9 + 0.2 * fine);
  float skin = exp(d * 4.0) * 2.4 + exp(d * 0.7) * 0.35;
  col = (c0 * I * 1.5 + uColor * skin * 2.0 + vec3(0.9, 0.97, 1.0) * speck * 1.2) * uEmph * uOn;
  gl_FragColor = vec4(col, 1.0);
  `}
}`,
    side: THREE.DoubleSide,
    defines: cut.capsOn ? { CAPS: 1 } : {},
    clipping: true,
    transparent: ullage,
    depthWrite: !ullage,
    blending: ullage ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  m.clippingPlanes = cut.planes
  m.userData.caps = cut.capsOn
  cut.materials.add(m)
  m.userData.kind = kind
  return m
}

/** the liquid surface itself: a disc at the level, clipped by the cut, a mirror with a glow under it */
export function liquidSurface(cut: CutState, kind: FluidKind) {
  const F = FLUIDS[kind]
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: F.color }, uEmph: F.emph, uTime: FLUID_TIME, uOn: FLUID_ON, uNoise3D: NOISE3D },
    vertexShader: /* glsl */ `
varying vec3 vW; varying vec3 vO;
#include <clipping_planes_pars_vertex>
void main(){ vO = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <clipping_planes_vertex>
}`,
    fragmentShader: /* glsl */ `
${GLSL_NOISE}
#include <clipping_planes_pars_fragment>
uniform vec3 uColor; uniform float uEmph, uTime, uOn;
varying vec3 vW; varying vec3 vO;
void main(){
  #include <clipping_planes_fragment>
  float r = length(vO.xz);
  float rip = n3(vec3(vO.x * 0.25 + uTime * 0.05, uTime * 0.1, vO.z * 0.25));
  float rim = smoothstep(3.6, 4.45, r);
  vec3 V = normalize(cameraPosition - vW);
  float fr = pow(1.0 - abs(V.y), 4.0);
  vec3 c = uColor * (0.5 + 0.6 * rip + rim * 0.8) + vec3(0.8, 0.9, 1.0) * fr * 0.4;
  gl_FragColor = vec4(c * uEmph * uOn * 0.9, 1.0);
}`,
    side: THREE.DoubleSide,
    clipping: true,
  })
  m.clippingPlanes = cut.planes
  return m
}

export { GLSL_NOISE }
