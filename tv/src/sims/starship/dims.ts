/**
 * Starship V3 in metres. Vehicle frame: +Y up the stack, y = 0 is the exit
 * plane of the booster's engines. The tank shapes here are the ones drawn,
 * and their volumes give the propellant mass, so nothing is typed in twice.
 */

export const R = 4.5
export const RIN = 4.49

export const B = {
  /** bottom of the outer skirt and of the base heat shield */
  skirt0: 1.7,
  /** engines hang from the thrust puck */
  puck: 4.9,
  fwd0: 62.0,
  fins: 66.4,
  top: 69.0,
  /** the vented hot stage ring sits on the booster */
  hsr0: 69.0,
  hsr1: 72.3,
}
export const S0 = 72.3
export const S = {
  skirt1: S0 + 6.0,
  puck: S0 + 4.6,
  bay0: S0 + 31.5,
  nose0: S0 + 43.0,
  top: S0 + 52.1,
}
export const STACK = S.top

export interface Tank { name: string; yBot: number; hBot: number; yTop: number; hTop: number; rho: number; kind: 'lox' | 'ch4' }

/** cross-section area of the inside of a tank at height y */
export function tankArea(k: Tank, y: number) {
  const R2 = RIN * RIN
  const top = k.yTop + Math.max(k.hTop, 0)
  if (y < k.yBot - k.hBot || y > top) return 0
  if (y < k.yBot) { const s = (k.yBot - y) / k.hBot; return Math.PI * R2 * (1 - s * s) }
  if (y <= k.yTop) {
    if (k.hTop < 0 && y > k.yTop + k.hTop) { const s = (k.yTop - y) / -k.hTop; return Math.PI * R2 * s * s }
    return Math.PI * R2
  }
  const s = (y - k.yTop) / k.hTop
  return Math.PI * R2 * (1 - s * s)
}

function build(k: Tank) {
  const y0 = k.yBot - k.hBot, y1 = k.yTop + Math.max(k.hTop, 0)
  const n = 2000, dy = (y1 - y0) / n
  const vol = new Float32Array(n + 1)
  for (let i = 1; i <= n; i++) vol[i] = vol[i - 1] + tankArea(k, y0 + (i - 0.5) * dy) * dy
  const V = vol[n]
  return {
    ...k, y0, y1, volume: V, mass: V * k.rho,
    /** liquid surface height for a fill fraction 0..1 */
    level(f: number) {
      const target = Math.max(0, Math.min(1, f)) * V
      let lo = 0, hi = n
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (vol[m] < target) lo = m; else hi = m }
      const a = vol[lo], b = vol[hi]
      return y0 + (lo + (b > a ? (target - a) / (b - a) : 0)) * dy
    },
  }
}

const LOX = 1220, CH4 = 430 // kg/m3, both chilled well below boiling
export const TANKS = {
  B: {
    lox: build({ name: 'Liquid oxygen', yBot: 6.4, hBot: 2.0, yTop: 39.0, hTop: -2.0, rho: LOX, kind: 'lox' }),
    ch4: build({ name: 'Liquid methane', yBot: 39.0, hBot: 2.0, yTop: 62.0, hTop: 2.2, rho: CH4, kind: 'ch4' }),
  },
  S: {
    lox: build({ name: 'Liquid oxygen', yBot: S0 + 6.0, hBot: 1.3, yTop: S0 + 20.5, hTop: -1.8, rho: LOX, kind: 'lox' }),
    ch4: build({ name: 'Liquid methane', yBot: S0 + 20.5, hBot: 1.8, yTop: S0 + 29.5, hTop: 2.0, rho: CH4, kind: 'ch4' }),
  },
}
export type BuiltTank = ReturnType<typeof build>

/** engine layout: [count, ring radius, phase, scale] */
export const B_RINGS: [number, number, number, number][] = [
  [3, 0.98, Math.PI / 6, 1],
  [10, 2.5, 0, 0.98],
  [20, 3.86, Math.PI / 20, 0.88],
]
/** ship: three sea level engines in the middle, three vacuum engines outside */
export const S_RINGS: [number, number, number, number][] = [
  [3, 1.0, 0, 1],
  [3, 2.95, Math.PI / 3, 0.92],
]
