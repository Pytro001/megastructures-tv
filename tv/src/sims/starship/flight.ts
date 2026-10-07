/**
 * The ascent, integrated once at load: 2D point mass over a round Earth,
 * 33 Raptor 3 engines with the thrust they lose to ambient pressure, drag
 * through a standard atmosphere, a pitch kick at T+12 s and a gravity turn
 * after it, a throttle bucket through max Q and a 3.8 g limit near the end.
 * Propellant mass comes from the tank volumes in vehicle.ts.
 *
 * Every number on screen (altitude, speed, Mach, dynamic pressure, tonnes left
 * in each tank) is read from this table, so the frost line, the liquid
 * levels, the plume and the sky all agree with each other.
 */

import { TANKS } from './dims'

export const G0 = 9.80665
export const RE = 6371000

/** Raptor 3 as published: 280 tf at sea level, Isp about 350 s sea level, 380 s vacuum */
export const RAPTOR = {
  tfSL: 280,
  ispSL: 350,
  /** exit area of the sea level bell (1.34 m exit) */
  ae: Math.PI * 0.67 * 0.67,
  get mdot() { return (this.tfSL * 1000) / this.ispSL }, // kg/s at 100 %
  get fVac() { return this.tfSL * 1000 * G0 + 101325 * this.ae }, // N
}
export const OF = 3.6

/** standard atmosphere, good to about 80 km */
export function atmo(h: number) {
  const hk = Math.max(0, h) / 1000
  let T: number
  if (hk < 11) T = 288.15 - 6.5 * hk
  else if (hk < 20) T = 216.65
  else if (hk < 32) T = 216.65 + (hk - 20)
  else if (hk < 47) T = 228.65 + 2.8 * (hk - 32)
  else if (hk < 51) T = 270.65
  else T = Math.max(186.9, 270.65 - 2.8 * (hk - 51))
  const p = 101325 * Math.exp(-hk / 7.6) * (hk < 11 ? 1 + 0.06 * Math.sin(hk / 11 * Math.PI) : 1)
  const rho = p / (287.05 * T)
  const a = Math.sqrt(1.4 * 287.05 * T)
  return { T, p, rho, a }
}

const DRY_B = 320e3, DRY_S = 180e3, PAYLOAD = 100e3
export const PROP_B = TANKS.B.lox.mass + TANKS.B.ch4.mass
export const PROP_S = TANKS.S.lox.mass + TANKS.S.ch4.mass
/** booster engines shut down with this much left for the flip and the boostback */
const RESERVE = 0.085

export interface FState {
  t: number; h: number; v: number; vx: number; vy: number; x: number
  /** flight path angle from vertical (rad) and the vehicle's pitch from vertical */
  gamma: number; pitch: number
  mach: number; q: number; acc: number; pa: number
  thr: number; engines: number; mB: number; mS: number
  /** tonnes left in each tank */
  bLox: number; bCh4: number; sLox: number; sCh4: number
}

function throttleAt(t: number, q: number, acc: number) {
  let th = 0.9
  // the max Q bucket
  if (t > 36 && t < 80) th = Math.min(th, 0.9 - 0.2 * Math.sin(((t - 36) / 44) * Math.PI))
  void q
  // keep it under about 3.8 g as the booster gets light
  if (acc > 3.0) th = Math.min(th, (th * 3.0) / acc)
  return Math.max(0.4, th)
}

export const TABLE: FState[] = (() => {
  const out: FState[] = []
  const dt = 0.05
  let t = 0, x = 0, h = 0, vx = 0, vy = 0
  let pb = PROP_B, ps = PROP_S
  let pitch = 0
  let acc = 1.6
  let meco = Infinity
  let staged = false
  for (let i = 0; t <= 200 + 1e-6; i++) {
    const v = Math.hypot(vx, vy)
    const at = atmo(h)
    const q = 0.5 * at.rho * v * v
    const gamma = v > 1 ? Math.atan2(vx, vy) : 0
    // a pitch kick, then the vehicle follows its own velocity vector
    if (t < 10) pitch = 0
    else if (t < 26) pitch = ((t - 10) / 16) * 0.105
    else pitch = Math.max(gamma, 0.105 * Math.exp(-(t - 26) / 30) + gamma)
    let engines = 33, thr = staged ? 0 : throttleAt(t, q, acc)
    if (!staged && pb <= PROP_B * RESERVE) { staged = true; meco = t }
    if (staged) { engines = 3; thr = 0.5 }
    const mass = DRY_B + DRY_S + PAYLOAD + pb + ps
    const fPer = Math.max(0, RAPTOR.fVac * thr - at.p * RAPTOR.ae)
    const F = staged ? 0 : fPer * engines
    const mdot = staged ? 0 : RAPTOR.mdot * thr * engines
    const Cd = 0.28 + 0.3 * Math.exp(-Math.pow((v / at.a - 1.15) / 0.45, 2))
    const D = q * Cd * Math.PI * 4.5 * 4.5
    const r = RE + h
    const g = G0 * (RE / r) ** 2
    const ax = (F * Math.sin(pitch) - D * (v > 1 ? vx / v : 0)) / mass + (vx * vy) / r * 0
    const ay = (F * Math.cos(pitch) - D * (v > 1 ? vy / v : 0)) / mass - g + (vx * vx) / r
    acc = F / mass / G0
    if (i % 2 === 0) {
      const fb = pb / PROP_B, fs = ps / PROP_S
      out.push({
        t, h, v, vx, vy, x, gamma, pitch, mach: v / at.a, q, acc: staged ? 0 : acc, pa: at.p,
        thr: staged ? 0 : thr, engines: staged ? 0 : engines, mB: DRY_B + pb, mS: DRY_S + PAYLOAD + ps,
        bLox: (TANKS.B.lox.mass * fb) / 1000, bCh4: (TANKS.B.ch4.mass * fb) / 1000,
        sLox: (TANKS.S.lox.mass * fs) / 1000, sCh4: (TANKS.S.ch4.mass * fs) / 1000,
      })
    }
    vx += ax * dt; vy += ay * dt
    x += vx * dt * (RE / r); h += vy * dt
    pb = Math.max(0, pb - mdot * dt)
    t += dt
  }
  ;(out as unknown as { meco: number }).meco = meco
  return out
})()

export const MECO = (TABLE as unknown as { meco: number }).meco

export function flight(t: number): FState {
  const f = Math.max(0, Math.min(TABLE.length - 1.0001, t / 0.1))
  const i = Math.floor(f), k = f - i
  const a = TABLE[i], b = TABLE[i + 1]
  const o = {} as FState
  for (const key of Object.keys(a) as (keyof FState)[]) (o[key] as number) = a[key] + (b[key] - a[key]) * k
  o.engines = a.engines
  return o
}

/** first time the vehicle passes an altitude */
export function timeAtAltitude(h: number) {
  for (const s of TABLE) if (s.h >= h) return s.t
  return TABLE[TABLE.length - 1].t
}

export const fmtClock = (t: number) => {
  const s = Math.max(0, Math.round(t))
  return `T+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
