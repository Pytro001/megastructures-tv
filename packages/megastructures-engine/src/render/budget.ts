import * as THREE from 'three'

// A big scene can hold dozens of exhibits, 100+ lights and hundreds of shader programs. Drawing all of it at once
// froze the page for minutes on a cold GPU shader cache: every light adds an unrolled loop to
// every lit shader, and every program costs a few hundred ms the first time it is drawn.
// Two budgets, applied inside renderer.render() for every pass and every camera:
//  - draw distance: things further than DRAW from the camera are skipped (the hall shell is
//    one big mesh, so it is always near). They come back the moment the camera gets close.
//  - lights: only the nearest few of each kind stay on (shadow casters are their own kind,
//    marked *). The count per kind never changes, so walking the hall swaps which lights are
//    on without recompiling a shader. Lights that project a texture are left alone.
export const DRAW = 45
export type LightCaps = Partial<Record<string, number>>
/** how many lights of each kind stay on; a kind with a * is the shadow casting version */
export const LIGHTS: LightCaps = { PointLight: 4, SpotLight: 4, 'SpotLight*': 2, 'PointLight*': 1, RectAreaLight: 1 }
const kind = (l: THREE.Light) => l.type + (l.castShadow ? '*' : '')

type Drawable = THREE.Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean; geometry?: THREE.BufferGeometry }

const sphere = new THREE.Sphere()

/** distance from a point to the nearest edge of a drawable's world bounds, 0 when unknown */
export function reach(d: Drawable, at: THREE.Vector3) {
  const g = d.geometry
  if (!g) return 0
  if (!g.boundingSphere) g.computeBoundingSphere()
  if (!g.boundingSphere || !Number.isFinite(g.boundingSphere.radius)) return 0
  sphere.copy(g.boundingSphere).applyMatrix4(d.matrixWorld)
  return Math.max(0, sphere.center.distanceTo(at) - sphere.radius)
}

export const isDrawable = (o: THREE.Object3D): o is Drawable => {
  const d = o as Drawable
  return !!(d.isMesh || d.isPoints || d.isLine || d.isSprite)
}

export class RenderBudget {
  private lights: THREE.Light[] = []
  private drawables: Drawable[] = []
  private culled = new Set<THREE.Light>()
  private hidden: Drawable[] = []
  private age = Infinity
  private at = new THREE.Vector3()
  private p = new THREE.Vector3()

  /** draw: how far to draw, Infinity for film recording where load time does not matter */
  constructor(private scene: THREE.Scene, readonly draw = DRAW, private caps: LightCaps = LIGHTS) {
    scene.onBeforeRender = (_r, _s, camera) => { this.lightsFor(camera); this.cull(camera) }
    scene.onAfterRender = () => this.uncull()
  }

  private collect() {
    this.lights = []
    this.drawables = []
    this.scene.traverse((o) => {
      const l = o as THREE.Light & { map?: unknown }
      if (l.isLight && this.caps[kind(l)] !== undefined && !l.map) this.lights.push(l)
      // frustumCulled = false marks screen space and shader placed things whose bounds mean nothing
      if (isDrawable(o) && o.frustumCulled) this.drawables.push(o)
    })
  }

  /** switch on the nearest lights of each kind to this camera, switch off the rest */
  lightsFor(camera: THREE.Object3D) {
    if (++this.age > 30) { this.age = 0; this.collect() }
    camera.getWorldPosition(this.at)
    const byType = new Map<string, { l: THREE.Light; d: number }[]>()
    for (const l of this.lights) {
      // a light only counts when its whole parent chain is shown
      let shown = true
      for (let o = l.parent; o; o = o.parent) if (!o.visible) { shown = false; break }
      if (!shown || (!l.visible && !this.culled.has(l))) continue
      l.getWorldPosition(this.p)
      let list = byType.get(kind(l))
      if (!list) byType.set(kind(l), (list = []))
      list.push({ l, d: this.p.distanceToSquared(this.at) })
    }
    for (const [type, list] of byType) {
      const keep = this.caps[type] ?? list.length
      if (list.length > keep) list.sort((a, b) => a.d - b.d)
      list.forEach(({ l }, i) => {
        const on = i < keep
        l.visible = on
        if (on) this.culled.delete(l)
        else this.culled.add(l)
      })
    }
  }

  // hide what is out of range for the length of one render() call only, so exhibit code never sees it
  private cull(camera: THREE.Camera) {
    this.uncull()
    if (this.draw === Infinity) return
    camera.getWorldPosition(this.at)
    for (const d of this.drawables) {
      if (d.visible && reach(d, this.at) > this.draw) { d.visible = false; this.hidden.push(d) }
    }
  }

  private uncull() {
    for (const d of this.hidden) d.visible = true
    this.hidden.length = 0
  }
}
