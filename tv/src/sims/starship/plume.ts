import * as THREE from 'three'
import { GLSL_NOISE, NOISE3D } from 'megastructures-engine/core/noise'
import { GEO } from '../raptor/raptor'

/**
 * The exhaust of a whole cluster in one ray march. Near the nozzles every
 * engine has its own jet (found without a loop over all 33: per ring, the
 * nearest engine follows from the angle), with the violet core, shock
 * diamonds and pink Mach disks of the single Raptor exhibit. A few metres
 * down the jets merge into one column: white hot, then yellow, then orange,
 * with flame tongues where the fuel rich exhaust meets air and burns again.
 * Thinner air lets every jet open up, so with altitude the plume grows wide
 * and faint, which is how it really looks on the way up.
 */

const VERT = /* glsl */ `
varying vec3 vL;
void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const FRAG = /* glsl */ `
precision highp float;
${GLSL_NOISE}
varying vec3 vL;
uniform vec3 uCamL;
uniform vec4 uRings[3];
uniform vec3 uRingOn;
uniform float uLen, uRmax, uRcl, uExp, uCell, uStr, uHot, uSpread, uAfter, uVac, uInt, uTime, uSteps, uShock;

vec3 ramp(float T){
  vec3 c0 = vec3(0.6, 0.1, 0.01), c1 = vec3(1.0, 0.3, 0.03), c2 = vec3(1.0, 0.48, 0.08), c3 = vec3(1.0, 0.72, 0.3), c4 = vec3(1.0, 0.93, 0.8);
  if (T < 0.25) return mix(c0, c1, T / 0.25);
  if (T < 0.5) return mix(c1, c2, (T - 0.25) / 0.25);
  if (T < 0.78) return mix(c2, c3, (T - 0.5) / 0.28);
  return mix(c3, c4, (T - 0.78) / 0.22);
}

// one Raptor's jet, in exit radius units: X downstream, R from its axis
vec3 jet(float X, float R, float tu){
  float L = uCell;
  float b = uExp * (1.0 - 0.35 * exp(-X / 1.6)) + 0.35 * exp(-X / 1.6) * 1.0;
  float A = (uExp - 1.0) * 0.4 + 0.04;
  float bb = max(0.35, (b - A * cos(6.2831853 * X / L) * exp(-X / (2.4 * L))) * (1.0 + 0.02 * X));
  float inside = smoothstep(bb * 1.06, bb * 0.84, R);
  float k0 = floor(X / L - 0.55 + 0.5);
  float xk = (k0 + 0.55) * L;
  float strk = uStr * exp(-max(k0, 0.0) * 0.62) * step(-0.5, k0);
  float dx = (X - xk) / (0.15 * L);
  float bd = min(bb, 1.3);
  float spindle = exp(-dx * dx) * exp(-pow(R / (0.24 * bd * (1.0 - 0.3 * dx * dx)), 2.0));
  float disk = exp(-dx * dx * 6.0) * exp(-pow(R / (0.12 * bd), 2.0));
  float ph = fract(X / L);
  float rs = bb * abs(1.0 - 2.0 * ph);
  float sheet = exp(-pow((R - rs) / (0.1 * bb), 2.0)) * inside * exp(-X / (2.6 * L));
  vec3 e = vec3(0.0);
  e += vec3(1.0, 0.9, 0.86) * disk * strk * 22.0;
  e += vec3(1.0, 0.62, 0.7) * spindle * strk * 6.0;
  e += vec3(0.75, 0.5, 1.0) * sheet * 0.18 * uShock;
  // the violet body of the jet, brightest right out of the bell
  e += vec3(0.55, 0.4, 1.0) * inside * (0.03 + 0.25 * exp(-X / 1.4)) * (0.75 + 0.5 * tu);
  e += vec3(0.85, 0.7, 1.0) * exp(-X / 0.3) * exp(-pow(R / 0.97, 8.0)) * 2.0;
  // the hot core of each jet: a pink white flame a few exit diameters long, visible from far away
  e += vec3(1.0, 0.74, 0.86) * exp(-pow(R / (0.55 * bb), 2.0)) * exp(-X / 7.0) * smoothstep(0.0, 0.6, X) * 1.6;
  return e / max(1.0, bb * bb * 0.7);
}

vec3 emit(vec3 p, out float ext){
  float x = p.y;
  vec2 q = vec2(p.x, -p.z);
  float r = length(q);
  float ang = atan(q.y, q.x);
  float tu = n3(vec3(x * 0.035 - uTime * 0.9, p.x * 0.06, p.z * 0.06));
  float tu2 = n3(vec3(x * 0.11 - uTime * 2.6, p.x * 0.2 + 3.1, p.z * 0.2 + 1.7));
  float turb = tu * 0.6 + tu2 * 0.4;
  vec3 e = vec3(0.0);
  ext = 0.0;

  // ---------- near field: each engine's own jet ----------
  float wJ = exp(-x / (7.0 + 9.0 * uVac));
  if (wJ > 0.01) {
    for (int k = 0; k < 3; k++) {
      vec4 Rg = uRings[k];
      float on = uRingOn[k];
      if (Rg.x < 0.5 || on < 0.01) continue;
      float st = 6.2831853 / Rg.x;
      float idx = floor((ang - Rg.z) / st + 0.5);
      float a = Rg.z + idx * st;
      vec2 c = vec2(cos(a), sin(a)) * Rg.y;
      float d = length(q - c);
      // the neighbour on the other side too, where jets overlap
      float a2 = a + (mod(ang - a + 3.14159, 6.28318) - 3.14159 > 0.0 ? st : -st);
      float d2 = length(q - vec2(cos(a2), sin(a2)) * Rg.y);
      float re = Rg.w;
      e += jet(x / re, d / re, tu2) * on * wJ / re;
      #ifdef NEIGHBOURS
      e += jet(x / re, d2 / re, tu2) * on * wJ / re * step(0.5, Rg.x - 1.5);
      #endif
    }
  }

  // ---------- the merged column ----------
  float Rc = uRcl * (1.0 + uSpread * x) + 0.5;
  float merge = smoothstep(0.0, 6.0 + 10.0 * uVac, x);
  float u = r / Rc;
  // big eddies and fine streaks, both carried downstream
  float nb = n3(vec3(x * 0.011 - uTime * 1.1, p.x * 0.035 + 0.3, p.z * 0.035));
  float ns = n3(vec3(x * 0.026 - uTime * 2.7, p.x * 0.16 + 1.7, p.z * 0.16 + 0.4));
  float nf = n3(vec3(x * 0.07 - uTime * 6.0, p.x * 0.5, p.z * 0.5 + 2.2));
  float Tf = exp(-x / uHot);
  float Te = clamp(Tf * (1.1 - 0.5 * u * u) + (nb - 0.5) * 0.36 + (ns - 0.5) * 0.16, 0.0, 1.0);
  float edge = Rc * (1.0 + (nb - 0.5) * 0.9 + (ns - 0.5) * 0.4) * smoothstep(-2.0, 8.0, x);
  // lumpy, patchy luminosity: hot pockets and cooler gaps
  float pockets = smoothstep(0.25, 0.75, nb * 0.55 + ns * 0.3 + nf * 0.15);
  float body = smoothstep(edge * 1.05, edge * 0.5, r) * (0.35 + 0.9 * pockets + 0.2 * nf);
  float fadeEnd = exp(-max(x - uLen * 0.6, 0.0) / (uLen * 0.3));
  float I = (0.05 + 0.5 * Te * Te + 2.6 * Te * Te * Te * Te) * body * merge * fadeEnd;
  e += ramp(Te) * I * (1.0 - uVac * 0.85);
  // afterburning: tongues of orange flame on the outside, where hot fuel rich gas meets air
  float tongue = smoothstep(0.42, 0.9, nb * 0.6 + ns * 0.4);
  float mantle = exp(-pow((r / edge - 1.0) / 0.22, 2.0)) * smoothstep(5.0, 25.0, x) * exp(-x / (uLen * 0.5));
  e += vec3(1.0, 0.36, 0.08) * mantle * tongue * uAfter * 1.2;
  // base glow where the outer jets turn in
  e += vec3(1.0, 0.6, 0.38) * exp(-x / 1.8) * exp(-pow(r / (uRcl + 0.4), 8.0)) * 0.5 * (1.0 - uVac);

  // ---------- thin air: a wide faint violet cloud ----------
  float bv = uRcl + 1.0 + x * 0.55;
  vec3 ev = vec3(0.5, 0.38, 1.0) * exp(-pow(r / bv, 2.0) * 1.6) * exp(-x / 70.0) / (bv * 0.12) * (0.7 + 0.6 * turb) * 0.3;
  ev += vec3(0.6, 0.45, 1.0) * exp(-pow((r - bv * 0.8) / (0.2 * bv), 2.0)) * exp(-x / 60.0) * (0.6 + 0.6 * tu2) * 0.35;
  e += ev * uVac * 0.06;

  ext = body * merge * (0.001 + 0.006 * (1.0 - Te)) * fadeEnd * (1.0 - uVac);
  return e;
}

void main(){
  vec3 ro = uCamL;
  vec3 rd = normalize(vL - uCamL);
  // bounding cylinder around +y, y in [0, uLen * 1.25]
  float yMax = uLen * 1.25;
  float a = dot(rd.xz, rd.xz);
  float b = 2.0 * dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - uRmax * uRmax;
  float disc = b * b - 4.0 * a * c;
  if (disc <= 0.0 || a < 1e-9) discard;
  float sq = sqrt(disc);
  float t0 = (-b - sq) / (2.0 * a), t1 = (-b + sq) / (2.0 * a);
  float ty0 = (0.0 - ro.y) / rd.y, ty1 = (yMax - ro.y) / rd.y;
  if (ty0 > ty1) { float tt = ty0; ty0 = ty1; ty1 = tt; }
  t0 = max(max(t0, ty0), 0.0);
  t1 = min(min(t1, ty1), length(vL - uCamL) + 0.01);
  if (t1 <= t0) discard;
  // two segments: the first 20 m below the nozzles get most of the samples
  float tn = (20.0 - ro.y) / rd.y;
  float jit = ign(gl_FragCoord.xy + fract(uTime * 7.13) * 64.0);
  vec3 acc = vec3(0.0);
  float Tr = 1.0;
  for (int s = 0; s < 2; s++) {
    float a0 = t0, a1 = t1;
    bool nearFirst = rd.y > 0.0 ? ro.y < 20.0 : ro.y > 20.0;
    bool nearSeg = (s == 0) == nearFirst;
    // near segment is where y < 20
    if (rd.y > 0.0) { if (nearSeg) a1 = min(t1, tn); else a0 = max(t0, tn); }
    else { if (nearSeg) a0 = max(t0, tn); else a1 = min(t1, tn); }
    if (a1 <= a0) continue;
    float n = nearSeg ? uSteps : uSteps * 0.7;
    float dt = (a1 - a0) / n;
    for (int i = 0; i < 72; i++) {
      if (float(i) >= n) break;
      vec3 p = ro + rd * (a0 + (float(i) + jit) * dt);
      float rr = length(p.xz);
      if (rr > uRcl * (1.3 + uSpread * p.y * 1.4) + 3.0 + uVac * (2.0 + p.y * 0.6)) continue;
      float ex;
      vec3 e = emit(p, ex) * smoothstep(uRmax, uRmax * 0.6, rr);
      acc += Tr * e * dt;
      Tr *= exp(-ex * dt);
    }
  }
  float flick = 0.94 + 0.06 * n3(vec3(uTime * 3.1, 0.2, 0.7)) + 0.03 * sin(uTime * 47.0);
  gl_FragColor = vec4(acc * uInt * flick, 1.0 - Tr);
}
`

export interface Ring { count: number; radius: number; phase: number; re: number }

export class ClusterPlume {
  readonly mesh: THREE.Mesh
  readonly mat: THREE.ShaderMaterial
  readonly lights: THREE.PointLight[] = []
  /** smoothed state */
  s = { exp: 1.3, cell: 3.2, str: 0.8, hot: 40, spread: 0.03, after: 1, vac: 0, int: 1, len: 140 }
  constructor(rings: Ring[], readonly clusterR: number, private lightParent: THREE.Object3D) {
    const len = 260, rmax = 70
    const g = new THREE.CylinderGeometry(clusterR + 8, rmax, len * 1.25, 48, 1, false)
    g.translate(0, (len * 1.25) / 2, 0)
    const ru = rings.map(r => new THREE.Vector4(r.count, r.radius, r.phase, r.re))
    while (ru.length < 3) ru.push(new THREE.Vector4(0, 0, 0, 1))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uCamL: { value: new THREE.Vector3() },
        uRings: { value: ru }, uRingOn: { value: new THREE.Vector3(1, 1, 1) },
        uLen: { value: 140 }, uRmax: { value: rmax }, uRcl: { value: clusterR },
        uExp: { value: 1.3 }, uCell: { value: 3.2 }, uStr: { value: 0.8 }, uHot: { value: 40 }, uSpread: { value: 0.03 }, uAfter: { value: 1 }, uVac: { value: 0 }, uInt: { value: 1 },
        uTime: { value: 0 }, uSteps: { value: 44 }, uShock: { value: 1 },
        uNoise3D: NOISE3D,
      },
      side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    })
    this.mesh = new THREE.Mesh(g, this.mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 5
    // the plume points away from the vehicle: local +y is vehicle -y
    this.mesh.rotation.x = Math.PI
    for (const [c, y] of [[0xffb070, 6], [0xff8a40, 28]] as const) {
      const L = new THREE.PointLight(c, 0, 160, 1.4)
      L.userData.y = y
      lightParent.add(L)
      this.lights.push(L)
    }
  }
  /** place the exit plane (vehicle frame y) */
  at(y: number) { this.mesh.position.set(0, y, 0); for (const L of this.lights) L.position.set(0, y - (L.userData.y as number), 0) }

  /** pa: ambient pressure (Pa); throttle 0..1; ringOn: which rings run */
  update(dt: number, t: number, pa: number, throttle: number, on: number, ringOn: [number, number, number], cam: THREE.Camera) {
    const pe = 0.94e5 * Math.max(throttle, 0.3)
    const n = Math.min(Math.max(pe / Math.max(pa, 1), 0.3), 1e5)
    const vac = THREE.MathUtils.smoothstep(Math.log10(n), 1.1, 2.6)
    const beq = THREE.MathUtils.clamp(Math.pow(n, 0.3), 0.8, 3.2)
    const s = this.s
    const k = 1 - Math.exp(-dt * 3)
    const tgt = {
      exp: beq, cell: 3.0 * Math.pow(beq, 0.85), str: (0.55 + 1.0 * Math.min(Math.abs(Math.log(n)), 1.5)) * (1 - vac),
      hot: 38 + 30 * (1 - Math.min(1, pa / 101325)) * (1 - vac), spread: 0.022 + 0.05 * Math.min(1, Math.log10(n + 1) / 2),
      after: Math.min(1, pa / 40000) * (1 - vac), vac, int: on * (0.45 + 0.55 * throttle), len: 110 + 80 * (1 - Math.min(1, pa / 101325)),
    }
    for (const key of Object.keys(tgt) as (keyof typeof tgt)[]) s[key] += (tgt[key] - s[key]) * k
    const u = this.mat.uniforms
    u.uExp.value = s.exp; u.uCell.value = s.cell; u.uStr.value = s.str; u.uHot.value = s.hot; u.uSpread.value = s.spread
    u.uAfter.value = s.after; u.uVac.value = s.vac; u.uInt.value = s.int; u.uLen.value = s.len; u.uTime.value = t
    u.uRingOn.value.set(...ringOn)
    this.mesh.visible = s.int > 0.01
    this.mesh.updateMatrixWorld()
    const inv = this.mesh.matrixWorld.clone().invert()
    u.uCamL.value.copy(cam.position).applyMatrix4(inv)
    const flick = 0.9 + 0.1 * Math.sin(t * 29) * Math.sin(t * 13.7)
    this.lights[0].intensity = 700 * s.int * flick * (1 - s.vac * 0.5)
    this.lights[1].intensity = 500 * s.int * flick * (1 - s.vac * 0.7)
  }
}

export const RE_EXIT = GEO.Re
