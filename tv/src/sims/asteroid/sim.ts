/**
 * Asteroid impact physics after Collins, Melosh and Marcus (2005), "Earth
 * Impact Effects Program", Meteoritics & Planetary Science 40, 817-840.
 *
 * Inputs: impactor diameter, density, speed and entry angle, a rock target.
 * Out: whether it breaks up and bursts in the air (pancake model), the speed
 * and energy it reaches the ground with, the transient and final crater
 * (pi group scaling, simple to complex at 3.2 km), melt volume, fireball,
 * the air blast overpressure versus distance, ejecta thickness and the
 * seismic magnitude. Units are SI unless a name says otherwise.
 */

export type Kind = 'stone' | 'iron' | 'ice'
export const DENSITY: Record<Kind, number> = { stone: 3000, iron: 7800, ice: 1000 }
const RHO_T = 2750 // target rock, kg/m3
const G = 9.81
const H = 8000 // atmospheric scale height, m
const RHO0 = 1.0 // surface air density, kg/m3
const CD = 2
const KT = 4.184e12 // J per kiloton TNT
const DC = 3200 // simple to complex transition diameter on Earth, m

export interface Impact {
  /** energy at the top of the atmosphere, Mt TNT */
  e0: number
  /** altitude where it breaks up, m (0 = intact to the ground) */
  zBreak: number
  /** airburst altitude, m (0 = reaches the ground) */
  zBurst: number
  airburst: boolean
  /** speed at the ground (or at the burst), km/s */
  vImpact: number
  /** energy delivered at the ground or the burst, Mt */
  e: number
  /** transient and final crater diameter, m; final depth, m */
  dtc: number; dfr: number; depth: number; complex: boolean
  /** melt volume, km3 */
  melt: number
  /** fireball radius, m */
  fireball: number
  /** Richter magnitude */
  quake: number
  /** radii where the air blast reaches 1, 3.5, 20 psi, m */
  r1: number; r2: number; r3: number; r5: number; r20: number
  /** radius of third degree burns, m */
  rBurn: number
  /** how many Hiroshimas (15 kt) */
  hiroshima: number
  /** ocean impact: water depth, the cavity in the water, the rim wave and the speed left at the seafloor */
  water: number; dtcw: number; arw: number; rrw: number; vSeafloor: number
}

const pFrom = (r: number, ekt: number, zb: number) => {
  // overpressure at ground range r for a burst of ekt kilotons at height zb (Collins eqs 54-56)
  const s = Math.cbrt(Math.max(ekt, 1e-9))
  const r1 = Math.hypot(r, zb) / s
  const px = 75000, rx = 290
  if (zb <= 0) return (px * rx) / (4 * r1) * (1 + 3 * Math.pow(rx / r1, 1.3))
  // airburst: regular reflection close in, Mach stem further out; this keeps the shape and scales with height
  const zb1 = zb / s
  const rm = 550 * zb1 / (1.2 * (550 - zb1))
  const p0 = 3.14e11 * Math.pow(zb1, -2.6) + 1.8e7 * Math.pow(zb1, -1.13)
  const beta = 34.87 * Math.pow(zb1, -1.73)
  const near = p0 * Math.exp(-beta * (r / s))
  const far = (px * rx) / (4 * r1) * (1 + 3 * Math.pow(rx / r1, 1.3))
  return r / s < rm ? Math.max(near, far * 0.5) : far
}
function radiusFor(psi: number, ekt: number, zb: number) {
  const target = psi * 6894.76
  let lo = 1, hi = 5e6
  if (pFrom(lo, ekt, zb) < target) return 0
  for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); if (pFrom(m, ekt, zb) > target) lo = m; else hi = m }
  return lo
}

export function impact(L: number, kind: Kind, vKms: number, angleDeg: number, water = 0): Impact {
  const rho = DENSITY[kind]
  const v0 = vKms * 1000
  const th = (angleDeg * Math.PI) / 180
  const m = (rho * Math.PI * L * L * L) / 6
  const e0J = 0.5 * m * v0 * v0
  // breakup (eqs 9-11): yield strength from density
  const Y = Math.pow(10, 2.107 + 0.0624 * Math.sqrt(rho))
  const If = (4.07 * CD * H * Y) / (rho * L * v0 * v0 * Math.sin(th))
  let zBreak = 0, zBurst = 0, vI = v0, eJ = e0J
  if (If < 1) {
    zBreak = -H * (Math.log(Y / (RHO0 * v0 * v0)) + 1.308 - 0.314 * If - 1.303 * Math.sqrt(1 - If))
    // pancake: spreads until 7 times its size (eq 18)
    const rhoZ = RHO0 * Math.exp(-zBreak / H)
    const l = L * Math.sin(th) * Math.sqrt(rho / (CD * rhoZ))
    const fp = 7
    const zb = zBreak - 2 * H * Math.log(1 + (l / (2 * H)) * Math.sqrt(fp * fp - 1))
    // speed lost on the way down to the break altitude (eq 8, intact body)
    const vBreak = v0 * Math.exp((-3 * rhoZ * CD * H) / (4 * rho * L * Math.sin(th)))
    if (zb > 0) {
      zBurst = zb
      vI = vBreak * 0.6
      eJ = 0.5 * m * (v0 * v0 - vI * vI) // the drag work is what explodes in the air
    } else {
      // reaches the ground as a dispersed swarm; speed from the pancake drag (eq 20, simplified)
      vI = vBreak * 0.85
      eJ = 0.5 * m * vI * vI
    }
  } else {
    vI = v0 * Math.exp((-3 * RHO0 * CD * H) / (4 * rho * L * Math.sin(th)))
    eJ = 0.5 * m * vI * vI
  }
  const e = eJ / (KT * 1000)
  const airburst = zBurst > 0
  // water (eqs 50-59): a cavity in the sea, its rim wave, and what is left to hit the seafloor
  let dtcw = 0, arw = 0, rrw = 0, vSea = vI
  if (water > 0 && !airburst) {
    dtcw = 1.365 * Math.cbrt(rho / 1000) * Math.pow(L, 0.78) * Math.pow(vI, 0.44) * Math.pow(G, -0.22) * Math.cbrt(Math.sin(th))
    arw = Math.min(dtcw / 14.1, water)
    rrw = 0.75 * dtcw
    vSea = vI * Math.exp((-3 * 1000 * 0.877 * water) / (2 * rho * L * Math.sin(th)))
  }
  // crater (eqs 21-27), on the seafloor if there is water
  let dtc = 0, dfr = 0, depth = 0, complex = false
  if (!airburst && vSea > 300) {
    dtc = 1.161 * Math.cbrt(rho / RHO_T) * Math.pow(L, 0.78) * Math.pow(vSea, 0.44) * Math.pow(G, -0.22) * Math.cbrt(Math.sin(th))
    if (1.25 * dtc < DC) { dfr = 1.25 * dtc; depth = (dtc / (2 * Math.SQRT2)) * 0.6 }
    else { complex = true; dfr = (1.17 * Math.pow(dtc, 1.13)) / Math.pow(DC, 0.13); depth = 1000 * 0.4 * Math.pow(dfr / 1000, 0.3) }
  }
  const melt = airburst || dtc === 0 ? 0 : (8.9e-12 * (0.5 * m * vSea * vSea) * Math.sin(th)) / 1e9
  const ekt = e * 1000
  return {
    e0: e0J / (KT * 1000), zBreak, zBurst, airburst, vImpact: vI / 1000, e,
    dtc, dfr, depth, complex, melt,
    fireball: 0.002 * Math.cbrt(eJ),
    quake: airburst ? 0 : 0.67 * Math.log10(eJ) - 5.87,
    r1: radiusFor(1, ekt, zBurst), r2: radiusFor(2, ekt, zBurst), r3: radiusFor(3.5, ekt, zBurst), r5: radiusFor(5, ekt, zBurst), r20: radiusFor(20, ekt, zBurst),
    // third degree burns at about 0.42 MJ/m2 for a 1 Mt fireball, scaling with the radiated 0.3% (Collins eq 31-34)
    rBurn: Math.sqrt((3e-3 * eJ) / (2 * Math.PI * 4.2e5 * Math.pow(Math.max(e, 1e-6), 1 / 6))),
    hiroshima: ekt / 15,
    water: airburst ? 0 : water, dtcw, arw, rrw, vSeafloor: vSea / 1000,
  }
}

/** ejecta blanket thickness at range r from the centre, m (eq 28) */
export const ejecta = (dtc: number, r: number) => (r < dtc / 2 ? 0 : Math.pow(dtc, 4) / (112 * r * r * r))

/** famous sizes for the size slider */
export const MARKS: { L: number; name: string; kind: Kind; v: number }[] = [
  { L: 20, name: 'Chelyabinsk 2013', kind: 'stone', v: 19 },
  { L: 50, name: 'Tunguska 1908', kind: 'stone', v: 15 },
  { L: 50, name: 'Meteor Crater', kind: 'iron', v: 13 },
  { L: 370, name: 'Apophis', kind: 'stone', v: 12.6 },
  { L: 1000, name: '1 km', kind: 'stone', v: 20 },
  { L: 10000, name: 'Chicxulub', kind: 'stone', v: 20 },
]

export function fmtE(mt: number) {
  if (mt < 0.001) return `${(mt * 1e6).toFixed(0)} t`
  if (mt < 1) return `${(mt * 1000).toFixed(mt < 0.01 ? 1 : 0)} kt`
  if (mt < 1e4) return `${mt < 10 ? mt.toFixed(1) : Math.round(mt).toLocaleString('en-US')} Mt`
  return `${(mt / 1e6).toFixed(mt < 1e6 ? 2 : 0)} million Mt`
}
export function fmtLen(m: number) {
  if (m < 1000) return `${Math.round(m)} m`
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m / 1000).toLocaleString('en-US')} km`
}
