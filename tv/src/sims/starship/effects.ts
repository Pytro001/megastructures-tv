import * as THREE from 'three'
import { GLSL_NOISE, NOISE3D } from 'megastructures-engine/core/noise'
import { CLOUD } from './sky'

/**
 * The air around the vehicle: the condensation trail it leaves down into the
 * clouds, the vapour collars that form going through Mach 1, and the fire
 * that bursts out of the hot stage ring's vents when the ship lights.
 */

/* ---------------- contrail: water vapour and soot behind the plume ---------------- */
export class Trail {
  readonly mesh: THREE.Mesh
  readonly u = {
    uCamL: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Vector3(1, 1, 1) },
    uSky: { value: new THREE.Vector3(0.3, 0.45, 0.8) }, uAlt: { value: 7000 }, uOn: { value: 1 }, uGlow: { value: 1 }, uY0: { value: 90 }, uLen: { value: 3200 },
    uM: { value: new THREE.Matrix4() }, uWidth: { value: 1 }, uNoise3D: NOISE3D,
  }
  constructor() {
    const L = 3200
    const g = new THREE.CylinderGeometry(150, 14, L, 40, 1, false)
    g.translate(0, -L / 2, 0)
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${GLSL_NOISE}
        varying vec3 vL;
        uniform vec3 uCamL, uSun, uSunCol, uSky; uniform float uTime, uAlt, uOn, uGlow, uY0, uLen, uWidth; uniform mat4 uM;
        float W(float s){ return (10.0 + s * 0.045 + 18.0 * smoothstep(0.0, 600.0, s)) * uWidth; }
        float dens(vec3 p, out float s){
          s = -p.y - uY0;
          if (s < 0.0) return 0.0;
          float r = length(p.xz) / W(s);
          if (r > 1.6) return 0.0;
          float n = n3(vec3(p.x / 38.0, (p.y + uTime * 18.0) / 70.0, p.z / 38.0)) * 0.65 + n3(vec3(p.x / 11.0, (p.y + uTime * 30.0) / 18.0, p.z / 11.0)) * 0.35;
          float d = exp(-r * r * 2.2) * smoothstep(0.25, 0.75, n + 0.25 - r * 0.3);
          // it thins out as it spreads and drifts
          d *= smoothstep(0.0, 60.0, s) * exp(-s / 2600.0);
          // it disappears into the cloud deck below
          float a = uAlt + (uM * vec4(p, 1.0)).y;
          d *= smoothstep(${CLOUD.top.toFixed(1)} - 200.0, ${CLOUD.top.toFixed(1)} + 400.0, a);
          return d;
        }
        float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
        void main(){
          vec3 ro = uCamL, rd = normalize(vL - uCamL);
          float tEnd = length(vL - uCamL);
          // start where the ray enters the bounding cylinder (or at the camera)
          float a = dot(rd.xz, rd.xz), b = 2.0 * dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - 150.0 * 150.0;
          float disc = b * b - 4.0 * a * c;
          float t0 = 0.0;
          if (disc > 0.0 && a > 1e-9) t0 = max(0.0, (-b - sqrt(disc)) / (2.0 * a));
          float ty = (-uY0 - ro.y) / rd.y;
          if (ro.y > -uY0 && ty > 0.0) t0 = max(t0, ty);
          if (tEnd <= t0) discard;
          const int N = 18;
          float dt = (tEnd - t0) / float(N);
          float jit = ign(gl_FragCoord.xy + fract(uTime * 5.3) * 40.0);
          vec3 sunL = normalize((inverse(uM) * vec4(uSun, 0.0)).xyz);
          float ph = hg(dot(rd, sunL), 0.6) * 5.0 + 0.3;
          vec3 acc = vec3(0.0); float T = 1.0;
          for (int i = 0; i < N; i++) {
            vec3 p = ro + rd * (t0 + (float(i) + jit) * dt);
            float s;
            float d = dens(p, s) * 0.012;
            if (d <= 0.0) continue;
            vec3 L = uSunCol * ph * 2.4 + uSky * 1.4;
            // lit from inside by the plume near the top
            L += vec3(1.0, 0.5, 0.2) * uGlow * 30.0 * exp(-s / 70.0);
            float e = exp(-d * dt);
            acc += T * L * (1.0 - e);
            T *= e;
            if (T < 0.03) break;
          }
          gl_FragColor = vec4(acc * uOn, (1.0 - T) * uOn);
        }`,
      side: THREE.BackSide, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }))
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
  }
  update(t: number, cam: THREE.Camera, sun: THREE.Vector3, sunCol: THREE.Color, sky: THREE.Vector3, alt: number, on: number, y0: number, width: number) {
    this.mesh.updateMatrixWorld()
    this.u.uM.value.copy(this.mesh.matrixWorld)
    this.u.uCamL.value.copy(cam.position).applyMatrix4(this.mesh.matrixWorld.clone().invert())
    this.u.uTime.value = t
    this.u.uSun.value.copy(sun)
    this.u.uSunCol.value.set(sunCol.r, sunCol.g, sunCol.b)
    this.u.uSky.value.copy(sky)
    this.u.uAlt.value = alt
    this.u.uOn.value = on
    this.u.uY0.value = y0
    this.u.uWidth.value = width
    this.mesh.visible = on > 0.01
  }
}

/* ---------------- vapour collars at Mach 1 ---------------- */
export class Vapor {
  readonly group = new THREE.Group()
  readonly u = { uTime: { value: 0 }, uK: { value: 0 }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Vector3(1, 1, 1) }, uSky: { value: new THREE.Vector3(0.3, 0.45, 0.8) }, uNoise3D: NOISE3D }
  constructor(collars: { y: number; r: number; len: number; flare: number }[]) {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: `varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vO = position; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
        uniform float uTime, uK; uniform vec3 uSun, uSunCol, uSky;
        void main(){
          float a = atan(vO.z, vO.x);
          // vUv.y runs along the collar: 1 at the shoulder where it forms, 0 at the tail
          float v = vUv.y;
          float n = n3(vec3(cos(a) * 1.3, sin(a) * 1.3, v * 2.5 - uTime * 3.0)) * 0.6 + n3(vec3(cos(a) * 4.0 + 3.0, sin(a) * 4.0, v * 7.0 - uTime * 6.0)) * 0.4;
          float d = smoothstep(0.0, 0.25, v) * smoothstep(1.0, 0.85, v) * smoothstep(0.35, 0.75, n + v * 0.25);
          vec3 V = normalize(cameraPosition - vW);
          float edge = pow(1.0 - abs(dot(V, vN)), 1.5);
          float al = d * uK * (0.18 + 0.55 * edge);
          float fw = pow(max(dot(-V, uSun), 0.0), 6.0);
          vec3 c = uSunCol * (1.2 + 5.0 * fw) + uSky * 1.2;
          gl_FragColor = vec4(c * al, al);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    })
    for (const c of collars) {
      const pts: THREE.Vector2[] = []
      for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector2(c.r + c.flare * Math.pow(u, 0.7), c.y - c.len * u)) }
      const g = new THREE.LatheGeometry(pts, 96)
      // lathe uv.y runs 0..1 along the points: shoulder is 0, flip so the shoulder is 1
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
      const m = new THREE.Mesh(g, mat)
      m.renderOrder = 4
      m.frustumCulled = false
      this.group.add(m)
    }
  }
  update(t: number, mach: number, sun: THREE.Vector3, sunCol: THREE.Color, sky: THREE.Vector3) {
    const k = Math.exp(-Math.pow((mach - 1.04) / 0.11, 2))
    this.u.uK.value = k
    this.u.uTime.value = t
    this.u.uSun.value.copy(sun)
    this.u.uSunCol.value.set(sunCol.r, sunCol.g, sunCol.b)
    this.u.uSky.value.copy(sky)
    this.group.visible = k > 0.01
  }
}

/* ---------------- fire through the hot stage ring's vents ---------------- */
export class VentFire {
  readonly mesh: THREE.InstancedMesh
  readonly u = { uTime: { value: 0 }, uK: { value: 0 }, uNoise3D: NOISE3D }
  constructor(vents: THREE.Vector3[]) {
    const g = new THREE.ConeGeometry(1, 1, 24, 12, true)
    g.translate(0, -0.5, 0)
    g.rotateZ(Math.PI / 2) // apex at the vent, opening outward along +x
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: `varying vec3 vO; varying float vI; varying vec3 vN; varying vec3 vW; void main(){ vO = position; vI = float(gl_InstanceID); vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        varying vec3 vO; varying float vI; varying vec3 vN; varying vec3 vW;
        uniform float uTime, uK;
        void main(){
          float x = vO.x; // 0 at the vent, 1 at the tip
          // a cone of gas: thick where we look through its middle, thin at the silhouette
          float r = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW)));
          float n = n3(vec3(x * 1.5 - uTime * 4.0, vO.y * 1.5 + vI * 0.37, vO.z * 1.5));
          float n2 = n3(vec3(x * 4.0 - uTime * 9.0, vO.y * 4.0, vO.z * 4.0 + vI));
          float T = exp(-x * 2.6) * (0.7 + 0.6 * n);
          vec3 c = mix(vec3(1.0, 0.36, 0.1), vec3(1.0, 0.9, 0.7), smoothstep(0.35, 0.9, T));
          c = mix(c, vec3(0.75, 0.55, 1.0), exp(-x * 9.0) * 0.6);
          float a = smoothstep(1.0, 0.2, r) * smoothstep(0.3, 0.7, n * 0.6 + n2 * 0.4 + 0.25 - x * 0.35) * (1.0 - smoothstep(0.6, 1.0, x));
          gl_FragColor = vec4(c * a * uK * (2.0 + 8.0 * T), 1.0);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
    this.mesh = new THREE.InstancedMesh(g, mat, vents.length)
    const m = new THREE.Matrix4()
    vents.forEach((p, i) => {
      const a = Math.atan2(p.z, p.x)
      m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, -0.25)), new THREE.Vector3(24, 2.6, 2.6))
      this.mesh.setMatrixAt(i, m)
    })
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 6
  }
  update(t: number, k: number) {
    this.u.uTime.value = t
    this.u.uK.value = k
    this.mesh.visible = k > 0.01
  }
}
