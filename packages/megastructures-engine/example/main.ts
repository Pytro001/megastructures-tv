// The smallest useful scene: a lathe turned part under studio light, the film look pipeline,
// three camera shots on a D-pad menu, a frame rate meter and dynamic resolution with ?tv=1.
// Run: npx vite packages/megastructures-engine/example
import * as THREE from 'three'
import {
  FilmPipeline, studioEnvironment, revolve, surf, type P2,
  onRemote, FocusEngine, FpsMeter, ResolutionGovernor, qualityFromUrl,
} from '../src/index'

const q = qualityFromUrl()
const canvas = document.getElementById('gl') as HTMLCanvasElement
const pipe = new FilmPipeline(canvas)
pipe.setSamples(q.samples)
const scene = new THREE.Scene()
scene.environment = studioEnvironment(pipe.renderer)
scene.environmentIntensity = 1.4
const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 50)
pipe.layers.layers = [{ scene, camera: cam }]

// a flanged shaft: a profile in (radius, height), revolved
const profile: P2[] = [[0, -0.6], [0.32, -0.6], [0.32, -0.5], [0.14, -0.48], [0.12, 0.3], [0.22, 0.32], [0.22, 0.42], [0.08, 0.45], [0.06, 0.62], [0, 0.62]]
const part = new THREE.Mesh(revolve(profile, q.tv ? 48 : 128), surf({ color: 0xb8bcc2, metalness: 1, roughness: 0.32, detail: 3, roughVar: 0.2 }))
scene.add(part)

const shots = [[0, 0.1, 3.2], [3.2, 0.4, 0.2], [0.2, 3.2, 0.4]].map(p => new THREE.Vector3(...(p as [number, number, number])))
let shot = 0
const at = shots[0].clone()

let scale = Math.min(devicePixelRatio, q.maxScale)
function resize() { pipe.resize(innerWidth, innerHeight, scale); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix() }
addEventListener('resize', resize); resize()
const gov = new ResolutionGovernor(q, s => { scale = s; resize() }, scale)
const fps = new FpsMeter(document.body, true, q.tv ? 'TV mode' : 'desktop')

const focus = new FocusEngine(document.querySelector('.menu') as HTMLElement, { wrap: true, onSelect: el => { shot = Number(el.dataset.shot) } })
onRemote(e => {
  if (e.key === 'left' || e.key === 'right') { focus.move(e.key); return true }
  if (e.key === 'select') { focus.select(); return true }
  return false
})

let last = performance.now()
requestAnimationFrame(function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  gov.frame(now - last); last = now
  part.rotation.y += dt * 0.4
  at.lerp(shots[shot], 1 - Math.exp(-dt * 3))
  cam.position.copy(at); cam.lookAt(0, 0, 0)
  pipe.render(dt)
  fps.frame(now, pipe.renderer, scale)
  requestAnimationFrame(loop)
})
