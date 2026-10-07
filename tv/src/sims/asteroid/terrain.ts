import * as THREE from 'three'
import { CRATER_GLSL, type Crater } from './crater'
import { NOISE_GLSL } from '../tbm/mats'
import { HALF, VEX } from './geo'

/** grid cells per side of the land and sea meshes; TV performance mode halves both (a quarter of the triangles) */
export const TERRAIN_LOD = { land: 420, sea: 380 }

/**
 * The 120 x 120 km block on the plinth: ocean, shelf, coast, city, hills and
 * mountains, drawn three times taller than life, cut down to 5 km under the
 * deep sea floor. Ground heights come from one baked texture; the crater is
 * added on the GPU around the point of impact. The sea is its own surface,
 * moved by the tsunami field (arrival time and height per point, solved on
 * the CPU) and, in the first minutes, by the cavity the rock punches into it.
 * The cut face shows the rock layers, the water column, breccia, melt and the
 * shock front.
 */

export { HALF }
/** bottom of the block, in display units (real metres x VEX); pages may set it before building the terrain */
export let Y0 = -16000
export function setY0(v: number) { Y0 = v }

export const FX = {
  uT: { value: -10 }, uL: { value: 1000 },
  uBurn: { value: 0 }, uBlast: { value: 0 }, uBlastMax: { value: 0 }, uShockR: { value: -1 },
  uMeltR: { value: 0 }, uMeltT: { value: 0 }, uMeltGlow: { value: 0 },
  uCutZ: { value: HALF + 10 }, uHl: { value: 0 }, uTime: { value: 0 },
  uMap: { value: null as THREE.Texture | null }, uRays: { value: 1 },
  uHeight: { value: null as THREE.Texture | null },
  uWave: { value: null as THREE.Texture | null },
  uImp: { value: new THREE.Vector2() },
  /** wave period, s; cavity diameter and depth, m; water depth at the impact, m */
  uP: { value: 120 }, uCav: { value: 0 }, uCavD: { value: 0 }, uDep: { value: 0 }, uCavT: { value: 10 },
  uWaveOn: { value: 0 },
  /** real ground height under the impact point */
  uImpH: { value: 0 },
  /** radius of the fine patch around the impact; the coarse grid leaves a hole for it */
  uPatchR: { value: 0 },
  /** earthquake: rupture progress 0..1, peak seafloor uplift (m), trench x (m), show the plates, strain 0..1 */
  uQuake: { value: 0 }, uUplift: { value: 0 }, uTrenchX: { value: -45000 }, uSlab: { value: 0 }, uStrain: { value: 0 },
  /** how much taller the open ocean wave is drawn (tapers to 1 near the shore) */
  uEtaX: { value: 1 },
}

const NOISE_V = NOISE_GLSL.slice(0, NOISE_GLSL.indexOf('vec3 tb_bump'))
const SHARED = /* glsl */ `
${NOISE_V}
${CRATER_GLSL}
#define VEX ${VEX.toFixed(1)}
float sq(float x){ return x * x; }
#define HALFW ${HALF.toFixed(1)}
uniform float uT, uL, uBurn, uBlast, uBlastMax, uShockR, uMeltR, uMeltT, uMeltGlow, uCutZ, uHl, uTime, uRays;
uniform float uP, uCav, uCavD, uDep, uCavT, uWaveOn, uImpH, uPatchR, uQuake, uUplift, uTrenchX, uSlab, uStrain, uEtaX;
uniform vec2 uImp;
uniform sampler2D uHeight, uWave;
vec2 uvOf(vec2 p){ return p / (2.0 * HALFW) + 0.5; }
float groundR(vec2 p){ return texture2D(uHeight, uvOf(p)).r; }
float rImp(vec2 p){ return length(p - uImp); }
/** real height of the solid surface: the map, flattened under the crater, plus the crater */
/** vertical ground motion of a megathrust: uplift over the rupture, a little subsidence at the coast */
float deform(vec2 p){
  if (uSlab < 0.5) return 0.0;
  float d = p.x - uTrenchX;
  float up = uUplift * (exp(-sq((d - 22000.0) / 15000.0)) - 0.18 * exp(-sq((d - 58000.0) / 12000.0)));
  float drag = -uUplift * 0.25 * exp(-sq((d - 30000.0) / 18000.0)); // the locked plate drags the edge down
  return up * uQuake + drag * uStrain * (1.0 - uQuake);
}
float solidR(vec2 p){
  float r = rImp(p);
  float g = groundR(p) + deform(p) * 30.0;
  float inside = uAir < 0.5 && uR > 0.0 ? smoothstep(uR * 1.3, uR * 0.9, r) * smoothstep(0.0, 0.3, uE) : 0.0;
  return mix(g, uImpH, inside) + craterH(r);
}
float packet(float x){
  if (x < 0.0) return 0.0;
  return exp(-sq((x - 0.22) / 0.16)) - 0.6 * exp(-sq((x - 0.7) / 0.2)) + 0.32 * exp(-sq((x - 1.25) / 0.2)) - 0.15 * exp(-sq((x - 1.8) / 0.22));
}
/** real height of the water surface, or -1e5 where there is no water */
float waterR(vec2 p, float solid){
  if (uDep <= 0.0 && solid >= 0.0 && uWaveOn < 0.5) return -1e5;
  vec4 w = texture2D(uWave, uvOf(p));
  float eta = 0.0;
  bool land = w.b > 0.5;
  if (uWaveOn > 0.5 && w.r >= 0.0 && uT > 0.0) {
    float ph = uT - w.r;
    if (!land) eta = w.g * packet(ph / uP) * mix(1.0, uEtaX, smoothstep(10.0, 900.0, -w.a));
    else eta = w.g * smoothstep(0.0, 45.0, ph) * (1.0 - smoothstep(240.0, 900.0, ph));
  }
  // the cavity punched into the sea, its rim, and the collapse
  if (uCav > 0.0 && uT > 0.0) {
    float r = rImp(p);
    float g = min(1.0, pow(uT / uCavT, 0.4));
    float col = smoothstep(uCavT, uCavT * 2.6, uT);
    float rc = max(uCav * 0.5 * g, 1.0), dc = uCavD * g;
    float cav = r < rc ? -dc * (1.0 - (r / rc) * (r / rc)) : dc * 0.35 * pow(rc / r, 3.0);
    eta += cav * (1.0 - col);
    // the central jet when it closes
    eta += uCavD * 0.25 * exp(-sq(r / (uCav * 0.12))) * smoothstep(uCavT, uCavT * 1.6, uT) * (1.0 - smoothstep(uCavT * 2.0, uCavT * 4.0, uT));
  }
  if (land) return eta > solid + 0.05 ? eta : -1e5;
  return solid < eta ? eta : -1e5;
}
float surfD(vec2 p){ return solidR(p) * VEX; }
`

/* ---------------------------------------------------------------- ground surface */
const TOP_FRAG = /* glsl */ `
vec3 shade(vec3 p, inout vec3 em, inout float rough){
  float r = rImp(p.xz);
  vec3 c = texture2D(uMap, uvOf(p.xz)).rgb;
  rough = 0.9;
  float hr = p.y / VEX;
  float rim = mix(uRt * (1.0 - pow(1.0 - clamp(uE, 0.0, 1.0), 2.5)), uR, uM);
  if (uAir < 0.5 && rim > 1.0) {
    float x = r / rim;
    float a = atan(p.z - uImp.y, p.x - uImp.x);
    float ray = pow(tb_n(vec3(a * 9.0, 0.0, 1.0)), 3.0) * 1.6;
    float ej = clamp(1.0 / (x * x * x) * (1.0 + ray * uRays), 0.0, 1.0) * step(1.0, x) * smoothstep(0.05, 0.4, uE);
    vec3 ejc = mix(vec3(0.4, 0.36, 0.31), vec3(0.6, 0.56, 0.5), tb_fbm(p * 0.002));
    c = mix(c, ejc, clamp(ej * 1.4, 0.0, 1.0));
    if (x < 1.0) {
      c = mix(vec3(0.22, 0.2, 0.18), vec3(0.42, 0.38, 0.34), tb_fbm(p * 0.0015 + 4.0));
      float m = smoothstep(uMeltR, uMeltR * 0.7, r) * step(0.01, uMeltR);
      float n = tb_fbm(vec3((p.xz - uImp) * 0.001, uTime * 0.05));
      c = mix(c, vec3(0.06, 0.05, 0.05), m);
      em += mix(vec3(1.0, 0.25, 0.03), vec3(1.0, 0.75, 0.3), n) * m * uMeltGlow * (0.6 + 1.4 * n) * 5.0;
    }
  }
  // thermal pulse and fires, on land only
  if (uT > 0.0 && uBurn > 0.0 && hr > 0.5) {
    float b = smoothstep(uBurn, uBurn * 0.8, r) * smoothstep(0.0, 0.6, uT);
    c = mix(c, c * vec3(0.2, 0.17, 0.15), b * 0.85);
    float f = smoothstep(0.72, 0.86, tb_n(vec3(p.xz * 0.002, floor(uTime * 6.0) * 0.17))) * smoothstep(0.4, 0.7, tb_n(vec3(p.xz * 0.0003, 2.0)));
    em += vec3(1.0, 0.38, 0.08) * f * b * smoothstep(0.5, 2.0, uT) * (1.0 - smoothstep(900.0, 1800.0, uT)) * 1.4;
  }
  // wet ground the flood left behind
  vec4 w = texture2D(uWave, uvOf(p.xz));
  if (uWaveOn > 0.5 && w.b > 0.5 && w.r >= 0.0 && uT > w.r && w.g > hr) { c *= 0.55; c = mix(c, vec3(0.32, 0.27, 0.2), 0.4); rough = 0.4; }
  if (uBlast > 0.0 && uBlast < uBlastMax * 1.02 && hr > 0.0) c = mix(c, vec3(0.75, 0.7, 0.62), exp(-sq((r - uBlast) / max(300.0, uBlast * 0.03))) * 0.6);
  if (uShockR > 0.0) em += vec3(0.7, 0.85, 1.0) * exp(-sq((r - uShockR) / max(100.0, uShockR * 0.04))) * 4.0 * exp(-uT * 0.8);
  return c;
}
`

/* ---------------------------------------------------------------- cut face and sides */
const SECTION_FRAG = /* glsl */ `
vec3 strata(float y, vec3 p){
  vec3 c; float n = tb_fbm(p * 0.0015);
  float lines = 0.92 + 0.08 * sin(y * 0.03 + n * 4.0);
  if (y > -400.0) c = mix(vec3(0.5, 0.42, 0.32), vec3(0.62, 0.54, 0.42), n);
  else if (y > -1600.0) c = mix(vec3(0.66, 0.64, 0.58), vec3(0.78, 0.76, 0.7), n);
  else if (y > -2600.0) c = mix(vec3(0.6, 0.41, 0.28), vec3(0.72, 0.5, 0.33), n);
  else if (y > -3800.0) c = mix(vec3(0.24, 0.25, 0.27), vec3(0.33, 0.34, 0.36), n);
  else { c = mix(vec3(0.42, 0.36, 0.35), vec3(0.56, 0.47, 0.45), n); c = mix(c, vec3(0.12), smoothstep(0.7, 0.75, tb_n(p * 0.02)) * 0.6); }
  return c * lines;
}
vec3 shade(vec3 p, inout vec3 em, inout float rough){
  rough = 0.85;
  vec2 q = p.xz;
  float r = rImp(q);
  float solid = solidR(q) * VEX;
  // above the rock: the water column
  if (p.y > solid + 1.0) {
    float wr = waterR(q, solid / VEX);
    float depth = (wr * VEX - p.y) / VEX;
    vec3 sea = mix(vec3(0.05, 0.32, 0.42), vec3(0.01, 0.05, 0.12), smoothstep(0.0, 3000.0, depth));
    em += sea * 0.12;
    rough = 0.2;
    return sea;
  }
  float yr = p.y / VEX; // real depth
  if (uSlab > 0.5) {
    // the subduction zone: the ocean plate dives under the continent from the trench
    float dT = q.x - uTrenchX;
    float sea = groundR(vec2(uTrenchX, q.y));
    float top = dT < 0.0 ? groundR(q) : sea - dT * 0.18 - dT * dT * 1.2e-6;
    float n = tb_fbm(p * 0.0012);
    if (yr < top) {
      float depthIn = top - yr;
      vec3 oc = mix(vec3(0.035, 0.045, 0.07), vec3(0.09, 0.1, 0.14), n);
      oc *= 0.9 + 0.1 * sin((yr + dT * 0.18) * 0.004 + n * 3.0);
      vec3 mantle = mix(vec3(0.32, 0.2, 0.12), vec3(0.5, 0.26, 0.1), n);
      vec3 c = depthIn < 6500.0 ? oc : mantle;
      if (depthIn >= 6500.0) em += vec3(1.0, 0.35, 0.08) * 0.6 * smoothstep(6500.0, 11000.0, depthIn);
      // the fault surface: glows where it is locked, flashes as the rupture runs along it
      float onFault = exp(-sq(depthIn / 700.0)) * step(0.0, dT) * step(dT, 90000.0);
      em += vec3(1.0, 0.55, 0.15) * onFault * uStrain * (1.0 - uQuake) * 2.5;
      float front = uQuake * 90000.0;
      em += vec3(0.75, 0.9, 1.0) * onFault * exp(-sq((dT - front) / 8000.0)) * step(0.001, uQuake) * (1.0 - step(0.999, uQuake)) * 8.0;
      return c;
    }
  }
  float base = groundR(q);
  float h = craterH(r);
  float crater = uAir < 0.5 && uRt > 0.0 ? 1.0 : 0.0;
  float w = exp((yr - uImpH) / max(uR * 0.45, 300.0));
  float ys = yr - base - h * w * crater; // depth below the original surface, bent by the crater
  vec3 c = strata(ys, p);
  if (crater > 0.5) {
    float g = 1.0 - pow(1.0 - clamp(uE, 0.0, 1.0), 2.5);
    float rt = max(uRt * g, 1.0), dt = uDt * g;
    float tb = uImpH - dt * (1.0 - (r / rt) * (r / rt));
    float hh = solid / VEX;
    if (uM > 0.0 && r < rt && yr > tb && yr < hh - 1.0) {
      float blk = tb_n(p * 0.005);
      vec3 br = mix(vec3(0.33, 0.29, 0.26), vec3(0.62, 0.56, 0.5), blk);
      c = mix(c, mix(br, strata(ys - 900.0 * blk, p), 0.35), smoothstep(0.0, 0.25, uM));
    }
    if (uMeltR > 1.0 && r < uMeltR && yr > hh - uMeltT && uM > 0.05) {
      float n = tb_fbm(vec3(q * 0.001, yr * 0.01 + uTime * 0.03));
      c = vec3(0.07, 0.06, 0.06);
      em += mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.7, 0.25), n) * uMeltGlow * (0.5 + n) * 5.0;
      rough = 0.35;
    }
    float d = length(vec2(r, yr - uImpH + uL * 0.6));
    float a = max(uL, 1.0);
    if (uHl > 0.001) {
      float P = 400.0 * pow(max(d / a, 0.3), -2.6);
      vec3 z = P > 60.0 ? vec3(1.0, 0.3, 0.1) : P > 10.0 ? vec3(1.0, 0.75, 0.2) : P > 2.0 ? vec3(0.35, 0.8, 1.0) : vec3(0.0);
      float lp = log(P), line = 0.0;
      for (int k = 0; k < 3; k++) { float lv = log(k == 0 ? 60.0 : k == 1 ? 10.0 : 2.0); line = max(line, 1.0 - smoothstep(0.0, 0.05, abs(lp - lv))); }
      c = mix(c, z, uHl * 0.18 * step(0.01, length(z)));
      em += (z + vec3(0.2)) * line * uHl * 1.5;
    }
    if (uShockR > 0.0) {
      float sh = exp(-sq((d - uShockR) / max(60.0, uShockR * 0.05)));
      em += vec3(0.75, 0.88, 1.0) * sh * 6.0 * exp(-uT * 0.6);
      em += vec3(1.0, 0.5, 0.2) * smoothstep(uShockR, 0.0, d) * 2.0 * exp(-uT * 2.0) * step(d, uShockR);
    }
  }
  return c;
}
`

/* ---------------------------------------------------------------- the sea */
const WATER_FRAG = /* glsl */ `
varying float vDepth; varying float vEta; varying float vSlope; varying float vLand; varying float vWet;
`

function patch(base: THREE.Material, mode: 'top' | 'side' | 'water', crater: Crater, grid = false) {
  base.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, crater.u, FX)
    const vtop = mode === 'top'
      ? `vec3 transformed = vec3(position.x, surfD(position.xz), position.z); vP = transformed;`
      : mode === 'side'
        ? `vec3 transformed = position; float fr = step(5.0, aTop); if (fr > 0.5) transformed.z = min(uCutZ, HALFW);
           if (aTop - fr * 10.0 > 0.5) { float s = solidR(transformed.xz); float wv = waterR(transformed.xz, s); transformed.y = max(s, wv) * VEX; }
           vP = transformed;`
        : `vec3 transformed = position; float s = solidR(position.xz); float wv = waterR(position.xz, s);
           vLand = groundR(position.xz) >= 0.0 ? 1.0 : 0.0;
           vDepth = wv - s; vEta = wv; vWet = wv > -1e4 ? 1.0 : 0.0;
           transformed.y = (wv > -1e4 ? wv : s - 2.0) * VEX;
           { float e = 300.0; float s1 = solidR(position.xz + vec2(e, 0.0)), s2 = solidR(position.xz + vec2(0.0, e));
             float w1 = waterR(position.xz + vec2(e, 0.0), s1), w2 = waterR(position.xz + vec2(0.0, e), s2);
             if (w1 < -1e4) w1 = wv; if (w2 < -1e4) w2 = wv;
             vec3 nn = normalize(vec3(-(w1 - wv) * VEX, e, -(w2 - wv) * VEX));
             objectNormal = nn; vSlope = 1.0 - nn.y; }
           vP = transformed;`
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SHARED}\nattribute float aTop;\nvarying vec3 vP;\n${mode === 'water' ? WATER_FRAG : ''}`)
      .replace('#include <beginnormal_vertex>', mode === 'top' ? `
        vec3 objectNormal;
        { vec2 p = position.xz; float e = max(150.0, rImp(p) * 0.003);
          float hx = surfD(p + vec2(e, 0.0)) - surfD(p - vec2(e, 0.0));
          float hz = surfD(p + vec2(0.0, e)) - surfD(p - vec2(0.0, e));
          objectNormal = normalize(vec3(-hx, 2.0 * e, -hz)); }
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif` : mode === 'water' ? 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);' : '#include <beginnormal_vertex>')
      .replace('#include <begin_vertex>', vtop)
    if (mode === 'water') {
      // the normal is computed in begin_vertex, after defaultnormal_vertex ran: redo the transform
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vNormal = normalize(normalMatrix * objectNormal);`)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${SHARED}\nvarying vec3 vP;\n${WATER_FRAG}`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          if (vWet < 0.5 || vP.z > uCutZ + 1.0 || abs(vP.x) > HALFW + 1.0 || abs(vP.z) > HALFW + 1.0) discard;
          #ifdef GRID
          if (uPatchR > 0.0 && rImp(vP.xz) < uPatchR * 0.97) discard;
          #endif`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float dd = clamp(vDepth, 0.0, 4000.0);
          vec3 shallow = vec3(0.06, 0.34, 0.38), deep = vec3(0.01, 0.06, 0.14);
          diffuseColor.rgb = mix(shallow, deep, smoothstep(0.0, 900.0, dd));
          diffuseColor.a = mix(0.5, 0.94, smoothstep(0.0, 120.0, dd));
          // flood water over land is brown with mud and wreckage
          vec3 mud = mix(vec3(0.09, 0.08, 0.055), vec3(0.15, 0.14, 0.1), tb_n(vec3(vP.xz * 0.002, uTime * 0.1)));
          diffuseColor.rgb = mix(diffuseColor.rgb, mud, vLand);
          diffuseColor.a = mix(diffuseColor.a, mix(0.55, 0.85, smoothstep(0.0, 40.0, vDepth)), vLand);
          // foam only where a crest is breaking, not on the cavity walls
          float foam = (1.0 - vLand) * smoothstep(0.003, 0.02, vSlope) * (1.0 - smoothstep(0.08, 0.2, vSlope)) * step(0.0, vEta) * smoothstep(1.0, 30.0, vEta);
          foam += vLand * (1.0 - smoothstep(0.0, 6.0, vDepth)) * 0.5;
          // the bore: a breaking white front where the wave stands up over the shelf
          foam += (1.0 - vLand) * smoothstep(2.0, 8.0, vEta) * (1.0 - smoothstep(30.0, 600.0, vDepth)) * 1.2;
          foam *= 0.4 + 0.6 * tb_n(vec3(vP.xz * 0.004, uTime * 0.3));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.84, 0.86), clamp(foam, 0.0, 0.75));`)
    } else {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${SHARED}\nvarying vec3 vP;\nuniform sampler2D uMap;\n${mode === 'top' ? TOP_FRAG : SECTION_FRAG}`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          if (vP.z > uCutZ + 1.0 || abs(vP.x) > HALFW + 1.0 || abs(vP.z) > HALFW + 1.0) discard;
          #ifdef GRID
          if (uPatchR > 0.0 && rImp(vP.xz) < uPatchR * 0.97) discard;
          #endif`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 tbEm = vec3(0.0); float tbRough = 0.9;
          diffuseColor.rgb = shade(vP, tbEm, tbRough);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = tbRough;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tbEm;')
    }
  }
  if (grid) (base as THREE.MeshStandardMaterial).defines = { GRID: 1 }
  base.customProgramCacheKey = () => 'ast2-' + mode + (grid ? 'g' : '')
  return base
}

function depthMat(mode: 'top' | 'side', crater: Crater) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, crater.u, FX)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SHARED}\nattribute float aTop;\nvarying vec3 vP;`)
      .replace('#include <begin_vertex>', mode === 'top'
        ? 'vec3 transformed = vec3(position.x, surfD(position.xz), position.z); vP = transformed;'
        : `vec3 transformed = position; float fr = step(5.0, aTop); if (fr > 0.5) transformed.z = min(uCutZ, HALFW); if (aTop - fr * 10.0 > 0.5) transformed.y = surfD(transformed.xz); vP = transformed;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vP;\nuniform float uCutZ;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (vP.z > uCutZ + 1.0 || abs(vP.x) > ${HALF + 1}.0 || abs(vP.z) > ${HALF + 1}.0) discard;`)
  }
  m.customProgramCacheKey = () => 'ast2d-' + mode
  return m
}

/** a square grid over the block */
function squareGrid(n: number) {
  const pos: number[] = [], idx: number[] = []
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pos.push(-HALF + (i / n) * 2 * HALF, 0, -HALF + (j / n) * 2 * HALF)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HALF * 2)
  return g
}

/** a polar patch around the impact for the crater, added on top of the square grid */
function polarPatch(rmax: number) {
  const NR = 160, NA = 220
  const pos: number[] = [0, 0, 0], idx: number[] = []
  for (let i = 1; i <= NR; i++) { const r = rmax * Math.pow(i / NR, 1.8); for (let j = 0; j < NA; j++) { const a = (j / NA) * Math.PI * 2; pos.push(r * Math.cos(a), 0, r * Math.sin(a)) } }
  for (let j = 0; j < NA; j++) idx.push(0, 1 + ((j + 1) % NA), 1 + j)
  for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NA; j++) { const a = 1 + i * NA + j, b = 1 + i * NA + ((j + 1) % NA), c = a + NA, d = b + NA; idx.push(a, b, c, b, d, c) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.userData.unit = new Float32Array(pos)
  g.setIndex(idx)
  g.computeVertexNormals()
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HALF * 2)
  return g
}

export class Terrain {
  readonly root = new THREE.Group()
  readonly front: THREE.Mesh
  readonly water: THREE.Mesh
  private patch: THREE.Mesh
  private patchW: THREE.Mesh
  constructor(readonly crater: Crater, map: THREE.Texture, height: THREE.Texture, wave: THREE.Texture) {
    FX.uMap.value = map
    FX.uHeight.value = height
    FX.uWave.value = wave
    const topMat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 'top', crater, true)
    const patchMat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 'top', crater)
    const grid = new THREE.Mesh(squareGrid(TERRAIN_LOD.land), topMat)
    grid.receiveShadow = true; grid.castShadow = true
    grid.customDepthMaterial = depthMat('top', crater)
    this.root.add(grid)
    // the crater gets its own fine polar patch centred on the impact, drawn a hair higher
    this.patch = new THREE.Mesh(polarPatch(1), patchMat)
    this.patch.customDepthMaterial = depthMat('top', crater)
    this.patch.receiveShadow = true
    this.patch.renderOrder = 1
    this.root.add(this.patch)
    // the sea
    const wp = { color: 0xffffff, roughness: 0.12, metalness: 0, transparent: true, clearcoat: 0.25, clearcoatRoughness: 0.2, depthWrite: true, envMapIntensity: 0.35 }
    const waterMat = patch(new THREE.MeshPhysicalMaterial(wp), 'water', crater, true)
    const waterPatchMat = patch(new THREE.MeshPhysicalMaterial(wp), 'water', crater)
    this.water = new THREE.Mesh(squareGrid(TERRAIN_LOD.sea), waterMat)
    this.water.renderOrder = 2
    this.root.add(this.water)
    this.patchW = new THREE.Mesh(polarPatch(1), waterPatchMat)
    this.patchW.renderOrder = 2
    this.root.add(this.patchW)
    // the sides and the cut face
    const secMat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.FrontSide }), 'side', crater)
    const side = (rotY: number, x: number, z: number, front = false) => {
      const s = new THREE.PlaneGeometry(2 * HALF, -Y0, 600, 1)
      const top = new Float32Array(s.attributes.position.count)
      for (let i = 0; i < top.length; i++) top[i] = s.attributes.position.getY(i) > 0 ? 1 : 0
      const flag = new Float32Array(top.length)
      for (let i = 0; i < top.length; i++) flag[i] = top[i] + (front ? 10 : 0)
      s.setAttribute('aTop', new THREE.BufferAttribute(flag, 1))
      const p = s.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) p.setY(i, top[i] ? 0 : Y0)
      s.rotateY(rotY)
      s.translate(x, 0, z)
      s.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HALF * 2)
      const m = new THREE.Mesh(s, secMat)
      m.receiveShadow = true
      m.customDepthMaterial = depthMat('side', crater)
      this.root.add(m)
      return m
    }
    side(Math.PI, 0, -HALF)
    side(-Math.PI / 2, -HALF, 0)
    side(Math.PI / 2, HALF, 0)
    this.front = side(0, 0, HALF, true)
  }
  /** put the fine crater patch where the rock lands, sized to the crater or cavity */
  private fkey = ''
  focus(x: number, z: number, radius: number) {
    const k = `${x}|${z}|${radius.toFixed(0)}`
    if (k !== this.fkey) {
      this.fkey = k
      for (const m of [this.patch, this.patchW]) {
        const g = m.geometry, u = g.userData.unit as Float32Array, p = g.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < p.count; i++) p.setXYZ(i, x + u[i * 3] * radius, 0, z + u[i * 3 + 2] * radius)
        p.needsUpdate = true
      }
    }
    FX.uPatchR.value = radius > 1 ? radius : 0
    this.patch.visible = radius > 1
    this.patchW.visible = radius > 1
  }
  setCut(z: number) { FX.uCutZ.value = z }
}
