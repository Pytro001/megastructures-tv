/**
 * A spatial focus engine for D-pad navigation.
 *
 * Mark anything focusable with a `data-focus` attribute inside a root
 * element. Arrow keys move to the nearest focusable in that direction,
 * measured between the edges of the on screen boxes, with a penalty for
 * sideways drift so a row stays a row. Select calls `onSelect` (or clicks the
 * element). The focused element gets the `focused` class and nothing else,
 * so the look is entirely CSS.
 *
 * No DOM focus() is used: a TV WebView shows a native focus ring and scrolls
 * on focus(), and neither belongs in a 10 foot UI.
 */

export type Dir = 'up' | 'down' | 'left' | 'right'

export interface FocusOptions {
  /** which element to focus first: a selector inside the root, or the first focusable */
  initial?: string
  /** called on select; the default clicks the element */
  onSelect?: (el: HTMLElement) => void
  /** called whenever focus moves */
  onFocus?: (el: HTMLElement, prev: HTMLElement | null) => void
  /** wrap from the last element of a row to the first */
  wrap?: boolean
}

interface Box { el: HTMLElement; l: number; r: number; t: number; b: number; cx: number; cy: number }

function box(el: HTMLElement): Box {
  const r = el.getBoundingClientRect()
  return { el, l: r.left, r: r.right, t: r.top, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }
}

/** pick the best candidate in a direction: distance along the axis plus twice the sideways offset */
export function nearest(from: HTMLElement, candidates: HTMLElement[], dir: Dir): HTMLElement | null {
  const a = box(from)
  let best: HTMLElement | null = null
  let bestScore = Infinity
  for (const el of candidates) {
    if (el === from) continue
    const b = box(el)
    if (b.r - b.l < 1 || b.b - b.t < 1) continue // hidden
    let along: number, side: number
    if (dir === 'right') { along = b.l - a.r; side = Math.abs(b.cy - a.cy) }
    else if (dir === 'left') { along = a.l - b.r; side = Math.abs(b.cy - a.cy) }
    else if (dir === 'down') { along = b.t - a.b; side = Math.abs(b.cx - a.cx) }
    else { along = a.t - b.b; side = Math.abs(b.cx - a.cx) }
    // allow small overlaps (rounded layouts) but nothing behind us
    if (along < -8) continue
    const score = Math.max(0, along) + side * 2
    if (score < bestScore) { bestScore = score; best = el }
  }
  return best
}

export class FocusEngine {
  current: HTMLElement | null = null
  constructor(readonly root: HTMLElement, private opts: FocusOptions = {}) {
    const first = (opts.initial && root.querySelector<HTMLElement>(opts.initial)) || this.items()[0] || null
    if (first) this.set(first)
  }

  /** every focusable that is shown right now */
  items(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('[data-focus]')].filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
  }

  set(el: HTMLElement | null) {
    if (el === this.current) return
    const prev = this.current
    prev?.classList.remove('focused')
    this.current = el
    el?.classList.add('focused')
    if (el) this.opts.onFocus?.(el, prev)
  }

  /** move in a direction; returns false at an edge so the caller can decide what an edge means */
  move(dir: Dir): boolean {
    const items = this.items()
    if (!this.current || !items.includes(this.current)) { this.set(items[0] ?? null); return !!this.current }
    let next = nearest(this.current, items, dir)
    if (!next && this.opts.wrap && (dir === 'left' || dir === 'right')) {
      const row = items.filter(el => Math.abs(box(el).cy - box(this.current!).cy) < 4)
      next = dir === 'right' ? row[0] : row[row.length - 1]
      if (next === this.current) next = null
    }
    if (!next) return false
    this.set(next)
    return true
  }

  select() {
    const el = this.current
    if (!el) return
    if (this.opts.onSelect) this.opts.onSelect(el)
    else el.click()
  }

  /** after the DOM changed: keep focus if the element is still there, otherwise take the first */
  refresh(selector?: string) {
    const items = this.items()
    const want = selector ? this.root.querySelector<HTMLElement>(selector) : null
    if (want && items.includes(want)) this.set(want)
    else if (!this.current || !items.includes(this.current)) this.set(items[0] ?? null)
  }
}
