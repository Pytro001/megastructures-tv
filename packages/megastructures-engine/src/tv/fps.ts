import type * as THREE from 'three'

/**
 * A small debug overlay: frames per second, average and 95th percentile frame
 * time, the current resolution scale, draw calls and triangles. Measures wall
 * time between frames, which is what a viewer sees.
 */
export class FpsMeter {
  readonly el: HTMLDivElement
  private times: number[] = []
  private last = 0
  private shown = 0
  visible: boolean
  /** the numbers of the last update, for tests and the perf script */
  readonly stats = { fps: 0, avgMs: 0, p95Ms: 0, scale: 1, calls: 0, triangles: 0, px: '' }

  constructor(parent: HTMLElement, visible = false, private label = '') {
    this.el = document.createElement('div')
    this.el.className = 'tv-fps'
    this.visible = visible
    this.el.style.display = visible ? '' : 'none'
    parent.appendChild(this.el)
  }

  toggle(on = !this.visible) { this.visible = on; this.el.style.display = on ? '' : 'none' }

  /** call once per frame with the time now (ms) and the renderer that just drew */
  frame(now: number, renderer?: THREE.WebGLRenderer, scale = 1) {
    if (this.last) {
      this.times.push(now - this.last)
      if (this.times.length > 120) this.times.shift()
    }
    this.last = now
    if (renderer) {
      // a post pipeline calls render() several times a frame; count the whole frame, then start over
      if (renderer.info.autoReset) renderer.info.autoReset = false
      this.stats.calls = renderer.info.render.calls
      this.stats.triangles = renderer.info.render.triangles
      renderer.info.reset()
      const c = renderer.domElement
      this.stats.px = `${c.width}x${c.height}`
    }
    this.stats.scale = scale
    if (now - this.shown < 250 || this.times.length < 5) return
    this.shown = now
    const sorted = [...this.times].sort((a, b) => a - b)
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
    this.stats.avgMs = avg
    this.stats.p95Ms = sorted[Math.floor(sorted.length * 0.95)]
    this.stats.fps = 1000 / avg
    if (!this.visible) return
    const s = this.stats
    this.el.innerHTML = `<b>${s.fps.toFixed(0)}</b> fps<span>${s.avgMs.toFixed(1)} ms avg, ${s.p95Ms.toFixed(1)} p95</span><span>${s.px} at ${(s.scale * 100).toFixed(0)}%</span><span>${s.calls} draws, ${(s.triangles / 1000).toFixed(0)}k tris</span>${this.label ? `<span>${this.label}</span>` : ''}`
  }

  setLabel(l: string) { this.label = l }
}
