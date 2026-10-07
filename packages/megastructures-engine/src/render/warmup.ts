import * as THREE from 'three'
import { DRAW, isDrawable, reach } from './budget'

// compile() only calls traverse() on the object it is given, so a list can stand in for a subtree
const listOf = (objs: THREE.Object3D[]) =>
  ({ traverse: (fn: (o: THREE.Object3D) => void) => objs.forEach(fn), traverseVisible: () => {} }) as unknown as THREE.Object3D

/**
 * Compile the shaders for everything within draw distance of the camera, hidden variants
 * included (cut open caps, fluids), instead of the whole hall. The rest compiles when the
 * camera walks up to it.
 */
export function compileNear(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Object3D, range = DRAW) {
  scene.updateMatrixWorld(true)
  const at = camera.getWorldPosition(new THREE.Vector3())
  const near: THREE.Object3D[] = []
  scene.traverse((o) => { if (isDrawable(o) && (!o.frustumCulled || reach(o, at) <= range)) near.push(o) })
  return renderer.compileAsync(listOf(near), camera as THREE.Camera, scene)
}
