import * as THREE from 'three'
import { RenderBudget, type LightCaps } from '../render/budget'

/**
 * TV performance mode.
 *
 * A Fire TV Stick has a phone class GPU driving a 1080p or 4K panel. The
 * cheapest wins, in the order they usually pay off:
 *  1. render fewer pixels: a dynamic resolution scale that follows the frame
 *     time (the browser upsamples the canvas for free),
 *  2. drop multisampling on the HDR buffers,
 *  3. smaller shadow maps,
 *  4. a fixed, small light count (every light adds a loop to every lit shader),
 *  5. coarser geometry and fewer ray march steps where the scene offers them.
 */

export interface TvQuality {
  /** true when the page runs in TV performance mode (?tv=1) */
  tv: boolean
  /** MSAA samples for the HDR scene buffers */
  samples: number
  /** shadow map size for every shadow casting light */
  shadowMap: number
  /** lights of each kind kept on (shadow casters are the kind with a *) */
  lights: LightCaps
  /** the resolution scale range the governor may use, as a fraction of the CSS pixel size */
  minScale: number
  maxScale: number
  /** frame time the governor aims for, ms */
  targetMs: number
  /** a scene specific detail level, 0 = lowest; scenes read it to pick geometry and step counts */
  detail: number
}

export const DESKTOP: TvQuality = { tv: false, samples: 4, shadowMap: 4096, lights: { PointLight: 8, SpotLight: 8, 'SpotLight*': 2, 'PointLight*': 1 }, minScale: 0.75, maxScale: 1.5, targetMs: 16.7, detail: 2 }
export const TV: TvQuality = { tv: true, samples: 0, shadowMap: 1024, lights: { PointLight: 2, SpotLight: 3, 'SpotLight*': 1, 'PointLight*': 0 }, minScale: 0.5, maxScale: 1.0, targetMs: 33.3, detail: 0 }

/** read ?tv=1 (or a host flag) and return the quality to use */
export function qualityFromUrl(search = typeof location === 'undefined' ? '' : location.search): TvQuality {
  const p = new URLSearchParams(search)
  const host = typeof window !== 'undefined' && (window as unknown as { MegaTVHost?: { tv?: boolean } }).MegaTVHost?.tv
  return p.get('tv') === '1' || (host && p.get('tv') !== '0') ? { ...TV } : { ...DESKTOP }
}

/** set every shadow casting light in a scene to one map size, freeing the old maps */
export function setShadowMapSize(scene: THREE.Object3D, size: number) {
  scene.traverse(o => {
    const l = o as THREE.Light & { shadow?: THREE.LightShadow }
    if (!l.isLight || !l.castShadow || !l.shadow) return
    if (l.shadow.mapSize.x === size) return
    l.shadow.mapSize.set(size, size)
    l.shadow.map?.dispose()
    ;(l.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null
  })
}

/** keep only the nearest few lights of each kind on, without shader recompiles; no draw distance cull */
export function capLights(scene: THREE.Scene, caps: LightCaps) {
  return new RenderBudget(scene, Infinity, caps)
}

/**
 * Dynamic resolution: watches frame times and moves a resolution scale
 * between min and max to hold the target. It moves down quickly (a slow
 * frame is visible) and up slowly (a sharper frame is a luxury), and only
 * after a window of frames so it never oscillates frame to frame.
 */
export class ResolutionGovernor {
  scale: number
  private acc = 0
  private n = 0
  /** frames per decision window */
  window = 30
  constructor(public q: TvQuality, private apply: (scale: number) => void, start = q.maxScale) {
    this.scale = start
  }
  /** feed one frame's wall time in ms; returns true when the scale changed */
  frame(ms: number): boolean {
    if (!Number.isFinite(ms) || ms <= 0 || ms > 500) return false // tab switches and stalls say nothing
    this.acc += ms; this.n++
    if (this.n < this.window) return false
    const avg = this.acc / this.n
    this.acc = 0; this.n = 0
    let next = this.scale
    if (avg > this.q.targetMs * 1.15) next = this.scale * Math.max(0.7, Math.sqrt(this.q.targetMs / avg))
    else if (avg < this.q.targetMs * 0.7) next = this.scale * 1.08
    next = THREE.MathUtils.clamp(next, this.q.minScale, this.q.maxScale)
    if (Math.abs(next - this.scale) < 0.02) return false
    this.scale = next
    this.apply(next)
    return true
  }
}
