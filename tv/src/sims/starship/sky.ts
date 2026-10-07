import * as THREE from 'three'
import { GLSL_NOISE, NOISE3D } from 'megastructures-engine/core/noise'

/**
 * The world outside the vehicle, drawn per pixel: Rayleigh and Mie single
 * scattering for the sky (into a small lookup texture for the camera's
 * altitude), a deck of cumulus seen from above with self shadowing and a
 * silver lining toward the sun, a thin cirrus veil higher up, and the Gulf of
 * Mexico through the gaps. Earth's curvature is a parabolic drop, exact
 * enough to put the horizon in the right place from 7 km and from 70 km.
 */

export const RE = 6371000
export const CLOUD = { base: 3300, top: 5600, cirrus: 10500 }

/* ---------------- a tileable cloud texture: Worley billows and value noise, 512 x 512 ---------------- */
function cloudTexture() {
  const N = 512
  const data = new Uint8Array(N * N * 4)
  let seed = 9
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  function worley(cells: number) {
    const pts = new Float32Array(cells * cells * 2)
    for (let i = 0; i < pts.length; i++) pts[i] = rnd()
    const out = new Float32Array(N * N)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * cells, fy = (y / N) * cells
        const cx = Math.floor(fx), cy = Math.floor(fy)
        let d1 = 9
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) {
            const gx = cx + i, gy = cy + j
            const wx = ((gx % cells) + cells) % cells, wy = ((gy % cells) + cells) % cells
            const px = gx + pts[(wy * cells + wx) * 2], py = gy + pts[(wy * cells + wx) * 2 + 1]
            const d = (px - fx) ** 2 + (py - fy) ** 2
            if (d < d1) d1 = d
          }
        out[y * N + x] = Math.sqrt(Math.max(0, 1 - d1 * 1.7))
      }
    return out
  }
  function value(cells: number, oct: number) {
    const out = new Float32Array(N * N)
    let amp = 0.5, c = cells, tot = 0
    for (let o = 0; o < oct; o++) {
      const g = new Float32Array(c * c)
      for (let i = 0; i < g.length; i++) g[i] = rnd()
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const fx = (x / N) * c, fy = (y / N) * c
          const ix = Math.floor(fx), iy = Math.floor(fy)
          let tx = fx - ix, ty = fy - iy
          tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
          const a = g[(iy % c) * c + (ix % c)], b = g[(iy % c) * c + ((ix + 1) % c)]
          const d = g[((iy + 1) % c) * c + (ix % c)], e = g[((iy + 1) % c) * c + ((ix + 1) % c)]
          out[y * N + x] += amp * (a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty)
        }
      tot += amp; amp *= 0.5; c *= 2
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot
    return out
  }
  const w1 = worley(10), w2a = worley(24), w2b = worley(48), w3 = worley(96), v = value(4, 5)
  for (let i = 0; i < N * N; i++) {
    data[i * 4] = Math.round(w1[i] * 255)
    data[i * 4 + 1] = Math.round((w2a[i] * 0.65 + w2b[i] * 0.35) * 255)
    data[i * 4 + 2] = Math.round(v[i] * 255)
    data[i * 4 + 3] = Math.round(w3[i] * 255)
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

/* ---------------- single scattering from the camera's altitude into an equirect LUT ---------------- */
const ATMO_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uSun; uniform float uAlt;
const float Re = 6360e3, Ra = 6460e3, Hr = 8000.0, Hm = 1200.0;
const vec3 bR = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const float bM = 21e-6;
vec2 sphere(vec3 o, vec3 d, float r){ float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c; if (h < 0.0) return vec2(1e9, -1e9); h = sqrt(h); return vec2(-b - h, -b + h); }
vec3 scatter(vec3 dir){
  vec3 o = vec3(0.0, Re + uAlt, 0.0);
  vec2 t = sphere(o, dir, Ra);
  float tmax = t.y;
  vec2 g = sphere(o, dir, Re);
  if (g.x > 0.0) tmax = min(tmax, g.x);
  const int N = 24, M = 8;
  float ds = tmax / float(N), odR = 0.0, odM = 0.0;
  vec3 sR = vec3(0.0), sM = vec3(0.0);
  float mu = dot(dir, uSun);
  float pR = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu);
  float gg = 0.76;
  float pM = 3.0 / (8.0 * 3.14159) * ((1.0 - gg * gg) * (1.0 + mu * mu)) / ((2.0 + gg * gg) * pow(1.0 + gg * gg - 2.0 * gg * mu, 1.5));
  for (int i = 0; i < N; i++) {
    vec3 p = o + dir * (ds * (float(i) + 0.5));
    float h = length(p) - Re;
    float hr = exp(-h / Hr) * ds, hm = exp(-h / Hm) * ds;
    odR += hr; odM += hm;
    vec2 tl = sphere(p, uSun, Ra);
    float dl = tl.y / float(M), lR = 0.0, lM = 0.0; bool ok = true;
    for (int j = 0; j < M; j++) { vec3 q = p + uSun * (dl * (float(j) + 0.5)); float hq = length(q) - Re; if (hq < 0.0) { ok = false; break; } lR += exp(-hq / Hr) * dl; lM += exp(-hq / Hm) * dl; }
    if (ok) { vec3 tau = bR * (odR + lR) + bM * 1.1 * (odM + lM); vec3 att = exp(-tau); sR += att * hr; sM += att * hm; }
  }
  return 20.0 * (sR * bR * pR + sM * bM * pM);
}
void main(){
  float phi = (vUv.x - 0.5) * 6.2831853, th = (vUv.y - 0.5) * 3.14159265;
  vec3 d = vec3(cos(th) * cos(phi), sin(th), cos(th) * sin(phi));
  gl_FragColor = vec4(scatter(normalize(d)), 1.0);
}`

/** the sun's colour after the air between it and the camera */
export function sunColour(sunDir: THREE.Vector3, alt: number) {
  const Hr = 8000, Hm = 1200
  const bR = [5.8e-6, 13.5e-6, 33.1e-6], bM = 21e-6
  // optical depth along the ray by numerical integration over a round Earth
  const o = new THREE.Vector3(0, 6360e3 + alt, 0)
  let odR = 0, odM = 0
  const n = 200, L = 600e3
  for (let i = 0; i < n; i++) {
    const p = o.clone().addScaledVector(sunDir, ((i + 0.5) / n) * L)
    const h = p.length() - 6360e3
    if (h < 0) return new THREE.Color(0, 0, 0)
    odR += Math.exp(-h / Hr) * (L / n); odM += Math.exp(-h / Hm) * (L / n)
  }
  return new THREE.Color(Math.exp(-(bR[0] * odR + bM * 1.1 * odM)), Math.exp(-(bR[1] * odR + bM * 1.1 * odM)), Math.exp(-(bR[2] * odR + bM * 1.1 * odM)))
}

/* ---------------- the per pixel world ---------------- */
export const WORLD_GLSL = /* glsl */ `
${GLSL_NOISE}
uniform sampler2D tLut, tCloud;
uniform vec3 uSunDir, uSunCol;
uniform float uAlt, uTime, uSteps, uSunSize;
uniform vec2 uOff;
const float RE = ${RE.toFixed(1)};
const float CB = ${CLOUD.base.toFixed(1)}, CT = ${CLOUD.top.toFixed(1)}, CI = ${CLOUD.cirrus.toFixed(1)};

vec3 lut(vec3 d){ float phi = atan(d.z, d.x), th = asin(clamp(d.y, -1.0, 1.0)); return texture2D(tLut, vec2(phi / 6.2831853 + 0.5, th / 3.14159265 + 0.5)).rgb; }

// altitude of a point (vehicle frame, the camera sits at uAlt + o.y) with the Earth curving away
float altAt(vec3 p){ return p.y + uAlt + dot(p.xz, p.xz) / (2.0 * RE); }
// first t >= 0 where altAt(o + t d) = L, or -1
float hitLayer(vec3 o, vec3 d, float L, bool second){
  float a = dot(d.xz, d.xz) / (2.0 * RE);
  float b = d.y + dot(o.xz, d.xz) / RE;
  float c = altAt(o) - L;
  if (a < 1e-12) { float t = -c / b; return t > 0.0 ? t : -1.0; }
  float disc = b * b - 4.0 * a * c;
  if (disc < 0.0) return -1.0;
  float s = sqrt(disc);
  // stable roots
  float q = -0.5 * (b + sign(b) * s);
  float t1 = q / a, t2 = c / q;
  float tn = min(t1, t2), tf = max(t1, t2);
  if (second) return tf > 0.0 ? tf : -1.0;
  return tn > 0.0 ? tn : (tf > 0.0 ? tf : -1.0);
}

// cumulus: a height field of billows over a slowly varying coverage
float coverage(vec2 xz){
  vec2 uv = (xz + uOff) / 90000.0;
  float c = texture2D(tCloud, uv).b;
  float c2 = texture2D(tCloud, uv * 3.3 + 0.37).b;
  return smoothstep(0.28, 0.72, c * 0.7 + c2 * 0.3);
}
float gCov = 0.75;
float topAt(vec2 xz, float lod){
  vec2 uv = (xz + uOff) / 26000.0;
  // warp the billows by the slow coverage field so the tile never repeats visibly from high up
  uv += (texture2D(tCloud, uv * 0.11 + 0.17).bb - 0.5) * vec2(0.9, -0.7);
  float w1 = texture2D(tCloud, uv).r;
  float w2 = texture2D(tCloud, uv * 2.3 + 0.21).g;
  float w3 = lod < 0.5 ? texture2D(tCloud, uv * 7.1 + 0.53).a : 0.5;
  float sh = w1 * 0.6 + w2 * 0.28 + w3 * 0.12;
  float cov = gCov;
  float h = clamp((sh - (1.0 - cov) * 0.9) / max(cov * 0.9, 0.05), 0.0, 1.0);
  return CB + 300.0 + pow(h, 0.75) * (CT - CB - 300.0) - (1.0 - step(0.001, h)) * 900.0;
}
float density(vec3 p, float lod){
  float a = altAt(p);
  if (a > CT + 80.0 || a < CB) return 0.0;
  float top = topAt(p.xz, lod);
  float d = (top - a) / 260.0;
  if (d < -0.5) return 0.0;
  // cauliflower: 3D noise rounds and eats the surface a little
  if (lod < 0.5) {
    vec3 q = p + vec3(uOff.x, -uTime * 2.0, uOff.y);
    float n = n3(q * vec3(1.0 / 1300.0, 1.0 / 900.0, 1.0 / 1300.0)) * 0.7 + n3(q * (1.0 / 420.0) + 0.37) * 0.3;
    d += (n - 0.5) * 0.7;
  }
  return clamp(d, 0.0, 1.0) * 0.012 * smoothstep(CB, CB + 500.0, a);
}
float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }

vec3 ocean(vec3 o, vec3 d, float t){
  vec3 p = o + d * t;
  // long swell, small glints, a sun path on the water
  vec3 n = normalize(vec3((n3(vec3((p.xz + uOff) / 3000.0, uTime * 0.01)) - 0.5) * 0.08, 1.0, (n3(vec3((p.zx + uOff) / 2600.0, 3.0)) - 0.5) * 0.08));
  vec3 r = reflect(d, n);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(-d, n), 0.0), 5.0);
  vec3 sky = lut(vec3(r.x, abs(r.y), r.z));
  vec3 deep = vec3(0.004, 0.018, 0.03);
  float spec = pow(max(dot(r, uSunDir), 0.0), 900.0) * 60.0 + pow(max(dot(r, uSunDir), 0.0), 60.0) * 0.6;
  return mix(deep, sky, fres) + uSunCol * spec * fres;
}

// the whole world in one direction: sky, sun, cirrus, cumulus, sea; with haze over distance
vec3 world(vec3 o, vec3 d, float jitter, bool env){
  vec3 sky = lut(d);
  float cs = dot(d, uSunDir);
  vec3 col = sky;
  float tGround = hitLayer(o, d, 0.0, false);
  bool ground = tGround > 0.0;
  if (!ground) {
    // the sun: limb darkened disc and its aureole
    float sd = acos(clamp(cs, -1.0, 1.0));
    float disc = smoothstep(uSunSize, uSunSize * 0.92, sd);
    float limb = sqrt(max(0.0, 1.0 - pow(sd / uSunSize, 2.0)));
    col += uSunCol * disc * (0.4 + 0.6 * limb) * 9000.0 * (env ? 0.0 : 1.0);
    col += uSunCol * exp(-sd * 90.0) * 2.5;
  }
  // cirrus veil above the cumulus: thin, fibrous, bright
  {
    float tc = hitLayer(o, d, CI, false);
    if (tc > 0.0 && (!ground || tc < tGround)) {
      vec3 p = o + d * tc;
      vec2 q = (p.xz + uOff * 0.6 + vec2(uTime * 6.0, 0.0));
      vec2 w = vec2(texture2D(tCloud, q / 60000.0).b, texture2D(tCloud, q / 60000.0 + 0.5).b) - 0.5;
      q += w * 9000.0;
      float c = texture2D(tCloud, q / vec2(90000.0, 9000.0)).b * 0.6 + texture2D(tCloud, q / vec2(30000.0, 3000.0) + 0.3).b * 0.4;
      c = smoothstep(0.52, 0.78, c) * smoothstep(0.35, 0.65, texture2D(tCloud, q / 140000.0).b) * 0.42;
      float fade = exp(-tc / 260000.0);
      vec3 cc = uSunCol * (hg(cs, 0.7) * 7.0 + 1.6) + lut(vec3(0.0, 1.0, 0.0)) * 1.2;
      col = mix(col, cc, c * fade);
    }
  }
  // cumulus deck
  float t0, t1;
  float camA = altAt(o);
  if (camA > CT) { t0 = hitLayer(o, d, CT + 80.0, false); t1 = t0 < 0.0 ? -1.0 : hitLayer(o, d, CB, false); if (t1 < 0.0 && t0 > 0.0) t1 = hitLayer(o, d, CT + 80.0, true); }
  else { t0 = 0.0; t1 = hitLayer(o, d, CT + 80.0, false); }
  vec3 base = ground ? ocean(o, d, tGround) : col;
  if (ground) {
    float hz = 1.0 - exp(-tGround / mix(60000.0, 260000.0, smoothstep(5000.0, 60000.0, uAlt)));
    base = mix(base, sky, hz);
  }
  vec3 acc = vec3(0.0);
  float T = 1.0;
  if (t0 > 0.0 && t1 > t0) {
    float lod = t0 > 60000.0 ? 1.0 : 0.0;
    gCov = mix(0.55, 0.95, coverage((o + d * t0).xz));
    float len = min(t1 - t0, 9000.0);
    int n = int(uSteps);
    float dt = len / float(n);
    float t = t0 + dt * jitter;
    vec3 amb = lut(vec3(0.0, 1.0, 0.0)) * 1.1 + lut(normalize(vec3(-uSunDir.x, 0.15, -uSunDir.z))) * 0.35;
    // from high up the LUT holds a black sky; the clouds still sit under a blue one
    amb = mix(amb, vec3(0.32, 0.5, 0.95), smoothstep(12000.0, 35000.0, uAlt));
    float ph = mix(hg(cs, 0.72), hg(cs, -0.2), 0.45);
    for (int i = 0; i < 64; i++) {
      if (i >= n || T < 0.04) break;
      vec3 p = o + d * t;
      float den = density(p, lod);
      if (den > 0.0) {
        // shadow: march toward the sun through the height field
        float od = 0.0;
        for (int j = 1; j <= 3; j++) {
          vec3 q = p + uSunDir * (float(j * j) * 190.0);
          od += density(q, 1.0) * float(j * 2 - 1) * 190.0;
        }
        float sh = exp(-od * 1.1) * 0.75 + exp(-od * 0.25) * 0.25;
        float a = altAt(p);
        float hf = smoothstep(CB, CT, a);
        float powder = 1.0 - exp(-den * 2.0 * 260.0);
        vec3 L = uSunCol * sh * (ph * 6.0 * mix(0.6, 1.0, powder) + 0.55) * 3.2 + amb * (0.25 + 0.75 * hf);
        float ext = den * dt;
        float tr = exp(-ext);
        acc += T * L * (1.0 - tr);
        T *= tr;
      }
      t += dt;
    }
    // distance haze on the clouds
    float hz = 1.0 - exp(-t0 / mix(70000.0, 300000.0, smoothstep(5000.0, 60000.0, uAlt)));
    vec3 hzc = lut(normalize(vec3(d.x, max(d.y, -0.02), d.z)));
    acc = mix(acc, hzc * (1.0 - T), hz);
  }
  return acc + base * T;
}
`

const VERT_QUAD = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

export class Sky {
  readonly lutRT = new THREE.WebGLRenderTarget(256, 128, { type: THREE.HalfFloatType, wrapS: THREE.RepeatWrapping })
  readonly cloudTex = cloudTexture()
  readonly sun = new THREE.Vector3(0.6, 0.12, -0.8).normalize()
  readonly sunCol = new THREE.Color(1, 1, 1)
  alt = 7000
  readonly off = new THREE.Vector2()
  private lutMat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: new THREE.Vector3() }, uAlt: { value: 0 } }, vertexShader: VERT_QUAD, fragmentShader: ATMO_FRAG, depthTest: false, depthWrite: false })
  private lutScene = new THREE.Scene()
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private lastLut = { alt: -1, sun: new THREE.Vector3() }
  /** shared uniforms for the screen pass and the environment sphere */
  readonly u = {
    tLut: { value: this.lutRT.texture as THREE.Texture },
    tCloud: { value: this.cloudTex as THREE.Texture },
    uSunDir: { value: this.sun },
    uSunCol: { value: new THREE.Vector3() },
    uAlt: { value: 7000 },
    uTime: { value: 0 },
    uSteps: { value: 56 },
    uSunSize: { value: 0.0058 },
    uOff: { value: this.off },
    uNoise3D: NOISE3D,
  }
  /** screen pass: rendered at half resolution into rt, then stretched under the vehicle */
  readonly rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType })
  private screenMat: THREE.ShaderMaterial
  private screen = new THREE.Scene()
  readonly invVP = { value: new THREE.Matrix4() }
  /** 0 = the real sky, 1 = a clean dark studio behind the vehicle */
  readonly studio = { value: 0 }
  readonly skyScale = { value: 1 }
  readonly camPos = { value: new THREE.Vector3() }
  /** the background quad drawn into the main HDR buffer */
  readonly back = new THREE.Scene()
  /** a sphere for the environment map */
  readonly envScene = new THREE.Scene()
  private pmrem: THREE.PMREMGenerator
  envRT: THREE.WebGLRenderTarget | null = null
  private lastEnv = { alt: -1e9, sun: new THREE.Vector3(), off: new THREE.Vector2(1e9, 0) }

  constructor(private renderer: THREE.WebGLRenderer) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.lutMat); q.frustumCulled = false; this.lutScene.add(q)
    this.screenMat = new THREE.ShaderMaterial({
      uniforms: { ...this.u, uInvVP: this.invVP, uCam: this.camPos },
      vertexShader: VERT_QUAD,
      fragmentShader: /* glsl */ `
        ${WORLD_GLSL}
        uniform mat4 uInvVP; uniform vec3 uCam;
        varying vec2 vUv;
        void main(){
          vec4 w = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
          vec3 d = normalize(w.xyz / w.w - uCam);
          float j = ign(gl_FragCoord.xy);
          gl_FragColor = vec4(world(uCam, d, j, false), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    })
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.screenMat); sq.frustumCulled = false; this.screen.add(sq)
    const bm = new THREE.ShaderMaterial({
      uniforms: { tSky: { value: this.rt.texture }, uTexel: { value: new THREE.Vector2(1, 1) }, uStudio: this.studio, uSkyScale: this.skyScale },
      vertexShader: VERT_QUAD,
      // a small tent filter while stretching the half resolution sky: it melts the ray march dither
      fragmentShader: `uniform sampler2D tSky; uniform vec2 uTexel; uniform float uStudio, uSkyScale; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tSky, vUv).rgb * 0.36;
          c += texture2D(tSky, vUv + vec2(uTexel.x, 0.0)).rgb * 0.12; c += texture2D(tSky, vUv - vec2(uTexel.x, 0.0)).rgb * 0.12;
          c += texture2D(tSky, vUv + vec2(0.0, uTexel.y)).rgb * 0.12; c += texture2D(tSky, vUv - vec2(0.0, uTexel.y)).rgb * 0.12;
          c += texture2D(tSky, vUv + uTexel).rgb * 0.04; c += texture2D(tSky, vUv - uTexel).rgb * 0.04;
          c += texture2D(tSky, vUv + vec2(uTexel.x, -uTexel.y)).rgb * 0.04; c += texture2D(tSky, vUv + vec2(-uTexel.x, uTexel.y)).rgb * 0.04;
          // the clean studio behind the cutaway: deep blue, lighter in the middle, like the engine exhibit
          vec2 q = vUv - vec2(0.55, 0.5);
          float g = exp(-dot(q * vec2(1.3, 1.0), q * vec2(1.3, 1.0)) * 3.2);
          vec3 studio = mix(vec3(0.006, 0.009, 0.02), vec3(0.03, 0.05, 0.1), g) + vec3(0.02, 0.025, 0.05) * smoothstep(0.35, 0.0, vUv.y) * 0.6;
          gl_FragColor = vec4(mix(c * uSkyScale, studio, uStudio), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    })
    const bq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bm); bq.frustumCulled = false; bq.renderOrder = -100
    this.back.add(bq)
    const em = new THREE.ShaderMaterial({
      uniforms: { ...this.u, uSteps: { value: 16 } },
      vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `${WORLD_GLSL}
        varying vec3 vD;
        void main(){ vec3 c = world(vec3(0.0), normalize(vD), 0.5, true); if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); gl_FragColor = vec4(min(c, vec3(24.0)), 1.0); }`,
      side: THREE.BackSide, depthWrite: false,
    })
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), em))
    this.pmrem = new THREE.PMREMGenerator(renderer)
  }

  setSun(dir: THREE.Vector3) { this.sun.copy(dir).normalize() }

  resize(w: number, h: number) {
    const W = Math.max(2, Math.round(w * 0.5)), H = Math.max(2, Math.round(h * 0.5))
    this.rt.setSize(W, H)
    const m = (this.back.children[0] as THREE.Mesh).material as THREE.ShaderMaterial
    m.uniforms.uTexel.value.set(0.8 / W, 0.8 / H)
  }

  /** per frame: the LUT when the altitude or the sun moved, the screen pass, and the environment now and then */
  update(cam: THREE.PerspectiveCamera, alt: number, t: number) {
    this.alt = alt
    const r = this.renderer
    this.u.uAlt.value = alt
    this.u.uTime.value = t
    const sc = sunColour(this.sun, Math.max(0, alt))
    this.sunCol.copy(sc)
    this.u.uSunCol.value.set(sc.r, sc.g, sc.b).multiplyScalar(1.0)
    if (Math.abs(this.lastLut.alt - alt) > 60 || this.lastLut.sun.distanceToSquared(this.sun) > 1e-7) {
      this.lastLut.alt = alt; this.lastLut.sun.copy(this.sun)
      this.lutMat.uniforms.uSun.value.copy(this.sun)
      this.lutMat.uniforms.uAlt.value = alt
      const prev = r.getRenderTarget()
      r.setRenderTarget(this.lutRT); r.render(this.lutScene, this.ortho); r.setRenderTarget(prev)
    }
    cam.updateMatrixWorld()
    // fully in the studio there is no sky to march
    if (this.studio.value > 0.999) return
    this.invVP.value.copy(cam.projectionMatrix).invert().premultiply(cam.matrixWorld)
    this.camPos.value.copy(cam.position)
    const prev = r.getRenderTarget()
    r.setRenderTarget(this.rt); r.render(this.screen, this.ortho); r.setRenderTarget(prev)
  }

  /** the vehicle reflects the sky and the cloud deck; regenerate when either moved noticeably */
  env(force = false) {
    const moved = Math.abs(this.lastEnv.alt - this.alt) > Math.max(200, this.alt * 0.04) || this.lastEnv.sun.distanceToSquared(this.sun) > 1e-5 || this.lastEnv.off.distanceTo(this.off) > 3000
    if (!force && !moved && this.envRT) return null
    this.lastEnv.alt = this.alt; this.lastEnv.sun.copy(this.sun); this.lastEnv.off.copy(this.off)
    const old = this.envRT
    this.envRT = this.pmrem.fromScene(this.envScene as unknown as THREE.Scene, 0, 0.1, 100)
    old?.dispose()
    return this.envRT.texture
  }
}
