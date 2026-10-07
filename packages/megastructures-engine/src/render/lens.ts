import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

/** draws several scene/camera layers into one HDR buffer, clearing depth between them */
export class LayerPass extends Pass {
  layers: { scene: THREE.Scene; camera: THREE.Camera; clearDepth?: boolean }[] = []
  clearColor = new THREE.Color(0x000000)
  constructor() { super(); this.needsSwap = false }
  render(renderer: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const ac = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(this.renderToScreen ? null : read)
    renderer.setClearColor(this.clearColor, 1)
    renderer.clear(true, true, true)
    for (const l of this.layers) {
      if (l.clearDepth) renderer.clearDepth()
      renderer.render(l.scene, l.camera)
    }
    renderer.autoClear = ac
  }
}

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

/**
 * Everything a real camera adds: the sun's flare (a diffraction starburst
 * from the aperture, ghosts along the line through the centre, a soft
 * anamorphic streak), a touch of chromatic aberration toward the edges,
 * vignetting, grain, and a crossfade to black for cuts.
 */
export class LensPass extends Pass {
  private fsq: FullScreenQuad
  readonly u = {
    tIn: { value: null as THREE.Texture | null },
    uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVis: { value: 0 },
    uAspect: { value: 1 },
    uTime: { value: 0 },
    uFade: { value: 1 },
    uCA: { value: 1 },
    uGrain: { value: 1 },
    uFlare: { value: 1 },
  }
  constructor() {
    super()
    this.fsq = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tIn; uniform vec2 uSun; uniform float uSunVis, uAspect, uTime, uFade, uCA, uGrain, uFlare;
        varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        vec3 ghost(vec2 uv, vec2 c, float r, vec3 col){
          vec2 d = (uv - c) * vec2(uAspect, 1.0);
          float l = length(d);
          float ring = smoothstep(r, r * 0.8, l) * (0.35 + 0.65 * smoothstep(r * 0.55, r * 0.95, l));
          return col * ring;
        }
        void main(){
          vec2 cc = vUv - 0.5;
          float e = dot(cc, cc);
          vec2 off = cc * e * 0.012 * uCA;
          vec3 col;
          col.r = texture2D(tIn, vUv - off).r;
          col.g = texture2D(tIn, vUv).g;
          col.b = texture2D(tIn, vUv + off).b;
          // flare from the sun, if it is on screen and not blocked
          if (uSunVis > 0.001) {
            vec2 d = (vUv - uSun) * vec2(uAspect, 1.0);
            float r = length(d);
            float a = atan(d.y, d.x);
            float burst = pow(abs(cos(a * 3.0)), 60.0) * 0.6 + pow(abs(cos(a * 3.0 + 0.52)), 160.0) * 0.4; // six spikes
            float rays = burst * exp(-r * 7.0) * 1.2 + exp(-r * 22.0) * 2.2 + exp(-r * 4.0) * 0.08;
            float streak = exp(-abs(d.y) * 220.0) * exp(-abs(d.x) * 2.6) * 0.5;
            vec3 f = vec3(1.0, 0.93, 0.82) * rays + vec3(0.55, 0.7, 1.0) * streak;
            // ghosts mirrored through the centre
            vec2 axis = 0.5 - uSun;
            f += ghost(vUv, uSun + axis * 1.4, 0.05, vec3(0.25, 0.45, 1.0)) * 0.05;
            f += ghost(vUv, uSun + axis * 1.75, 0.11, vec3(0.3, 1.0, 0.55)) * 0.02;
            f += ghost(vUv, uSun + axis * 2.3, 0.035, vec3(1.0, 0.45, 0.2)) * 0.07;
            f += ghost(vUv, uSun + axis * 0.6, 0.02, vec3(0.8, 0.6, 1.0)) * 0.06;
            // a soft rainbow halo around the sun
            float halo = exp(-pow((r - 0.22) / 0.012, 2.0));
            f += vec3(0.6 + 0.4 * sin(r * 300.0), 0.6 + 0.4 * sin(r * 300.0 + 2.0), 0.6 + 0.4 * sin(r * 300.0 + 4.0)) * halo * 0.04;
            col += f * uSunVis * uFlare;
          }
          // vignette and grain
          col *= 1.0 - e * 0.55;
          float g = h(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.13) * 100.0) - 0.5;
          col += g * 0.012 * uGrain * (0.2 + sqrt(max(col, 0.0)));
          gl_FragColor = vec4(col * uFade, 1.0);
        }`,
    }))
  }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    this.u.tIn.value = read.texture
    renderer.setRenderTarget(this.renderToScreen ? null : write)
    this.fsq.render(renderer)
  }
}

/** keeps a stray specular hot spot from flooding the bloom */
export class ClampPass extends Pass {
  private fsq = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tIn: { value: null }, uMax: { value: 6 } }, vertexShader: VERT,
    fragmentShader: /* glsl */ `uniform sampler2D tIn; uniform float uMax; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tIn, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); float m = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(m > uMax ? c * (uMax / m) : c, 1.0); }`,
  }))
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    (this.fsq.material as THREE.ShaderMaterial).uniforms.tIn.value = read.texture
    renderer.setRenderTarget(this.renderToScreen ? null : write)
    this.fsq.render(renderer)
  }
}

export class Pipeline {
  readonly renderer: THREE.WebGLRenderer
  readonly composer: EffectComposer
  readonly layers = new LayerPass()
  readonly bloom: UnrealBloomPass
  readonly lens = new LensPass()
  readonly out = new OutputPass()
  width = 1; height = 1
  constructor(canvas: HTMLCanvasElement, preserve = false, logDepth = false) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve, logarithmicDepthBuffer: logDepth })
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(this.renderer, rt)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 1.1)
    this.composer.addPass(this.layers)
    this.composer.addPass(new ClampPass())
    this.composer.addPass(this.bloom)
    this.composer.addPass(this.lens)
    this.composer.addPass(this.out)
  }
  resize(w: number, h: number, dpr: number) {
    this.width = w; this.height = h
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(w, h)
    this.lens.u.uAspect.value = w / h
  }
  /** multisampling of the HDR buffers; 0 turns it off, the cheapest single win on a TV stick GPU */
  setSamples(n: number) {
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples === n) continue
      rt.samples = n
      rt.dispose()
    }
  }
  render(dt: number) { this.composer.render(dt) }
}
