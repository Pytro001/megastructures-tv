import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ClampPass, LensPass } from './lens'

/**
 * The lab pipeline plus a depth of field: the scene renders into its own
 * multisampled HDR target with a depth texture, and a gather blur reads both
 * to throw what is off the focus plane out of focus, the way a macro lens
 * sees a model on a bench.
 */
class SceneDofPass extends Pass {
  readonly rt: THREE.WebGLRenderTarget
  scene: THREE.Scene | null = null
  camera: THREE.PerspectiveCamera | null = null
  /** false skips the 40 tap gather blur (TV performance mode): the frame is copied through sharp */
  dof = true
  private fsq: FullScreenQuad
  readonly u = {
    tCol: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uNear: { value: 0.01 }, uFar: { value: 60 },
    uFocus: { value: 2 }, uAperture: { value: 0 }, uMaxR: { value: 14 },
    uTexel: { value: new THREE.Vector2(1, 1) },
  }
  constructor() {
    super()
    this.needsSwap = true
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 })
    this.rt.depthTexture = new THREE.DepthTexture(4, 4)
    this.rt.depthTexture.type = THREE.FloatType
    this.fsq = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tCol, tDepth; uniform float uNear, uFar, uFocus, uAperture, uMaxR; uniform vec2 uTexel;
        varying vec2 vUv;
        float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
        float coc(vec2 uv){ float z = lin(texture2D(tDepth, uv).r); return clamp(uAperture * abs(1.0 - uFocus / z) * 40.0, 0.0, uMaxR); }
        void main(){
          vec3 c0 = texture2D(tCol, vUv).rgb;
          float r0 = coc(vUv);
          if (uAperture <= 0.0 || r0 < 0.5) { gl_FragColor = vec4(c0, 1.0); return; }
          vec3 acc = c0; float w = 1.0;
          const int N = 40;
          for (int i = 1; i < N; i++) {
            float fi = float(i);
            float rr = sqrt(fi / float(N)) * r0;
            float a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * rr * uTexel;
            float rs = coc(vUv + o);
            float k = smoothstep(rr - 1.0, rr + 0.5, max(rs, r0 * 0.25));
            vec3 s = texture2D(tCol, vUv + o).rgb;
            float lum = dot(s, vec3(0.3, 0.6, 0.1));
            k *= 1.0 + smoothstep(1.5, 6.0, lum) * 2.0; // bright spots make bokeh
            acc += s * k; w += k;
          }
          gl_FragColor = vec4(acc / w, 1.0);
        }`,
    }))
  }
  setSize(w: number, h: number) { this.rt.setSize(w, h); this.u.uTexel.value.set(1 / w, 1 / h) }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget) {
    if (!this.scene || !this.camera) return
    renderer.setRenderTarget(this.rt)
    renderer.setClearColor(0x000000, 1)
    renderer.clear(true, true, true)
    renderer.render(this.scene, this.camera)
    this.u.tCol.value = this.rt.texture
    this.u.tDepth.value = this.rt.depthTexture
    this.u.uNear.value = this.camera.near; this.u.uFar.value = this.camera.far
    if (!this.dof) this.u.uAperture.value = 0
    renderer.setRenderTarget(this.renderToScreen ? null : write)
    this.fsq.render(renderer)
  }
}

export class Pipeline {
  readonly renderer: THREE.WebGLRenderer
  readonly composer: EffectComposer
  readonly scene = new SceneDofPass()
  readonly clamp = new ClampPass()
  readonly bloom: UnrealBloomPass
  readonly lens = new LensPass()
  readonly out = new OutputPass()
  constructor(canvas: HTMLCanvasElement, preserve = false) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve })
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType })
    this.composer = new EffectComposer(this.renderer, rt)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 1.1)
    this.composer.addPass(this.scene)
    this.composer.addPass(this.clamp)
    this.composer.addPass(this.bloom)
    this.composer.addPass(this.lens)
    this.composer.addPass(this.out)
  }
  resize(w: number, h: number, dpr: number) {
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(w, h)
    this.scene.setSize(Math.round(w * dpr), Math.round(h * dpr))
    this.lens.u.uAspect.value = w / h
  }
  /** multisampling of the scene buffer; 0 turns it off, the cheapest single win on a TV stick GPU */
  setSamples(n: number) {
    if (this.scene.rt.samples === n) return
    this.scene.rt.samples = n
    this.scene.rt.dispose()
  }
  render(dt: number) { this.composer.render(dt) }
}
