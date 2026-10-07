/**
 * The process model of a 12 m earth pressure balance tunnel boring machine.
 *
 * Everything is in real units (metres, minutes, bar) and the scene scales it
 * down to the 1:30 model on the bench. The machine bores one ring width
 * (2.0 m) by pushing off the last ring with its thrust cylinders, stops, and
 * its erector builds the next ring of eight concrete segments inside the tail
 * shield. The screw conveyor decides how fast spoil leaves the pressurised
 * chamber behind the cutterhead: too slow and the pressure rises until the
 * street heaves, too fast and the face loses support and the street sinks.
 * Surface settlement follows the Gaussian trough of Peck (1969) with the
 * trough width i = K z0 of O'Reilly and New (1982).
 */

export type Ground = 'clay' | 'sand' | 'granite'

export const TBM = {
  D: 12.0, // cutterhead diameter, m
  R: 6.0,
  SHIELD_L: 12.5, // cutterhead face to tail skin end, m
  RING_W: 2.0, // segment ring width, m
  SEG_RO: 5.7, // segment outer radius, m
  SEG_RI: 5.25, // segment inner radius, m
  SEGS: 8, // seven segments and a key
  CUTTERS: 64, // 17 inch disc cutters
  MOTORS: 14, // electric main drive motors, 350 kW each
  DRIVE_KW: 4900,
  THRUST_MAX: 120, // MN
  TORQUE_MAX: 28, // MNm
  Z0: 20, // depth of the tunnel axis below the street, m
  K: 0.5, // trough width parameter for clay
  AREA: Math.PI * 36, // face area, m2
  STROKE: 2.0, // m, one ring
  RING0: 1206, // the ring being built when the page opens
  SEG_MIN: 3.6, // minutes to place one segment
  /** in the model a tunnel axis at y = 0, the face at x = xf, the street at y = Z0 */
  X0: -62, X1: 18,
}

export interface GroundProps {
  name: string
  /** penetration per revolution the head can take, mm */
  p: (rpm: number) => number
  /** cutterhead torque, MNm */
  torque: number
  /** shield friction and skin, MN */
  friction: number
  /** support pressure the face needs at the axis, bar */
  need: number
  /** bulking factor of the spoil */
  bulk: number
  /** cutter wear, relative */
  wear: number
  ucs: string
  color: [number, number, number]
}

export const GROUNDS: Record<Ground, GroundProps> = {
  // stiff clay: the screw, not the cutters, limits how fast it goes
  clay: { name: 'Stiff clay', p: () => 38, torque: 17.5, friction: 38, need: 2.4, bulk: 1.25, wear: 0.15, ucs: '0.2 MPa', color: [0.42, 0.3, 0.2] },
  // water bearing sand and gravel: abrasive, needs foam and full support
  sand: { name: 'Sand and gravel', p: () => 30, torque: 13.5, friction: 31, need: 2.1, bulk: 1.15, wear: 1, ucs: 'loose', color: [0.62, 0.5, 0.3] },
  // granite: 250 kN on each disc, a few millimetres a turn, self supporting
  granite: { name: 'Granite', p: (rpm) => 6.2 * Math.min(1, 2.4 / Math.max(rpm, 0.4)) ** 0.15, torque: 8.5, friction: 22, need: 0.6, bulk: 1.6, wear: 3.2, ucs: '180 MPa', color: [0.55, 0.52, 0.5] },
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const phi = (x: number) => 1 / (1 + Math.exp(-1.702 * x)) // logistic stand-in for the normal CDF

export type Phase = 'bore' | 'ring'

export class Sim {
  ground: Ground = 'clay'
  /** cutterhead speed, rpm */
  rpm = 2.0
  /** screw conveyor speed as a fraction of the speed that balances the inflow (1 = balanced) */
  screw = 1
  /** true while the operator (or the auto pilot) keeps the screw balanced */
  autoScrew = true
  /** model time per real second */
  speed = 260
  running = true

  phase: Phase = 'bore'
  /** metres bored in the current stroke, 0..2 */
  stroke = 0.35
  /** face position along the tunnel, m */
  xf = 0
  /** completed ring count */
  rings = TBM.RING0 - 1
  /** ring build progress, 0..8 (segments placed, fractional while one is moving) */
  build = 0
  /** chamber pressure at the axis, bar */
  pressure = 2.4
  /** current volume loss, % of the face area */
  vl = 0.35
  /** minutes of machine time since the page opened, starting mid shift */
  clock = 3 * 1440 + 14 * 60 + 20
  /** cutterhead angle, rad */
  head = 0
  /** screw angle, rad */
  screwAng = 0
  /** tonnes of spoil out today */
  spoil = 0
  /** recorded final volume loss behind the face, one bin per metre */
  readonly vlHist = new Float32Array(TBM.X1 - TBM.X0 + 1).fill(0.3)
  /** events since the last update */
  ev: string[] = []

  get g() { return GROUNDS[this.ground] }
  /** penetration, mm per revolution */
  get pen() { return this.g.p(this.rpm) }
  /** advance rate while boring, mm/min */
  get rate() { return this.phase === 'bore' && this.running ? this.pen * this.rpm : 0 }
  /** in situ spoil coming in, m3/min */
  get inflow() { return (this.rate / 1000) * TBM.AREA }
  /** what the cutters and skin need, MN */
  get thrust() {
    if (this.phase !== 'bore') return 6
    const face = this.pressure * 0.1 * TBM.AREA // bar to MPa times m2 = MN
    const cut = this.ground === 'granite' ? TBM.CUTTERS * 0.25 * clamp(this.rpm / 2.4, 0.4, 1) : 6
    return Math.min(TBM.THRUST_MAX, this.g.friction + face + cut)
  }
  get torque() { return this.phase === 'bore' ? Math.min(TBM.TORQUE_MAX, this.g.torque * (0.75 + 0.25 * this.rpm / 2) * (this.pressure > this.g.need * 1.4 ? 1.25 : 1)) : 0.6 }
  /** MW at the head */
  get power() { return (this.torque * 1e6 * this.rpm * 2 * Math.PI / 60) / 1e6 }
  /** the screw's own speed for the display, rpm */
  get screwRpm() { return this.phase === 'bore' ? clamp(this.screw * 11 * (this.rate / 76) * this.g.bulk, 0, 24) : 0 }
  /** pressure ratio to what the face needs */
  get ratio() { return this.pressure / this.g.need }
  /** metres per day at the current cycle, boring plus ring building */
  get perDay() {
    const r = Math.max(1e-3, this.pen * this.rpm)
    const cycle = TBM.STROKE * 1000 / r + TBM.SEGS * TBM.SEG_MIN + 6
    return (1440 / cycle) * TBM.STROKE * 0.72 // 72% availability
  }
  /** the face's behaviour in words */
  get faceState() {
    const r = this.ratio
    if (this.ground === 'granite') return r > 2.4 ? 'over pressured' : 'self supporting'
    if (r < 0.45) return 'collapsing'
    if (r < 0.8) return 'losing ground'
    if (r > 1.75) return 'blowing out'
    if (r > 1.25) return 'heaving'
    return 'balanced'
  }
  /** the most the street has moved, mm (negative is settlement) */
  get smax() { return -this.vl * 45.1 }

  /** settlement at a surface point, real metres (negative down), x along the tunnel, z across */
  settle(x: number, z: number) {
    const i = TBM.K * TBM.Z0
    const b = clamp(Math.round(x - TBM.X0), 0, this.vlHist.length - 1)
    const hist = x < this.xf - 3 ? this.vlHist[b] : 0
    // the face's current volume loss: half the trough at the face, all of it a trough width behind,
    // fading back to what was locked in as the tail passed; nothing far ahead
    const ph = phi((this.xf - x) / (0.75 * i))
    const cur = this.vl * (x < this.xf ? ph * Math.exp(-(((this.xf - x) / (2.2 * i)) ** 2)) : ph)
    const amp = Math.abs(cur) > Math.abs(hist) ? cur : hist
    return -(amp / 100) * TBM.AREA / (Math.sqrt(2 * Math.PI) * i) * Math.exp(-(z * z) / (2 * i * i))
  }

  reset() {
    this.xf = 0; this.stroke = 0.35; this.phase = 'bore'; this.build = 0; this.rings = TBM.RING0 - 1
    this.vlHist.fill(0.3); this.vl = 0.35; this.pressure = this.g.need
  }

  /** dt in real seconds */
  update(dt: number) {
    this.ev.length = 0
    const mins = (dt * this.speed) / 60
    // the screw: keep it balanced unless someone has the lever
    if (this.autoScrew) this.screw += (1 - this.screw) * Math.min(1, dt * 1.5)
    // chamber pressure relaxes toward what the inflow and outflow make it
    const need = this.g.need
    let eq: number
    if (this.phase === 'bore' && this.running && this.rate > 0) eq = need * Math.pow(clamp(1 / Math.max(this.screw, 0.05), 0.05, 4), 1.35)
    else eq = need * Math.pow(clamp(1 / Math.max(this.screw, 0.05), 0.4, 1.6), 0.4) // standing still the chamber holds
    eq = clamp(eq, 0, need * 3.2)
    this.pressure += (eq - this.pressure) * Math.min(1, dt * 1.6)
    // volume loss from the support ratio
    const r = this.ratio
    let vl = this.ground === 'granite' ? 0.08 : 0.35
    if (r < 1 && this.ground !== 'granite') vl += 7.5 * Math.pow(1 - r, 1.4)
    if (r > 1.15) vl -= Math.min(3, (r - 1.15) * 3.2)
    this.vl += (vl - this.vl) * Math.min(1, dt * 2)

    if (!this.running) return
    if (this.phase === 'bore') {
      const adv = (this.rate / 1000) * mins
      this.stroke += adv
      this.xf += adv
      this.spoil += this.inflow * mins * 2.0 // t/m3
      this.screwAng += dt * this.screwRpm * 0.5
      // record the trough as the tail passes
      const b = Math.round(this.xf - 3 - TBM.X0)
      if (b >= 0 && b < this.vlHist.length) this.vlHist[b] = this.vl
      if (this.stroke >= TBM.STROKE) {
        this.stroke = TBM.STROKE
        this.phase = 'ring'
        this.build = 0
        this.ev.push('ringStart')
      }
      if (this.xf > TBM.X1 - 3) { this.xf = TBM.X1 - 3; this.running = false; this.ev.push('end') }
    } else {
      const prev = Math.floor(this.build)
      this.build += mins / TBM.SEG_MIN
      if (Math.floor(this.build) > prev && prev < TBM.SEGS) this.ev.push('seg')
      if (this.build >= TBM.SEGS + 0.6) {
        this.phase = 'bore'
        this.stroke = 0
        this.build = 0
        this.rings++
        this.ev.push('ringDone')
      }
    }
    this.clock += mins
  }
}

/** the head spins at a watchable speed, not at the model clock */
export function headSpin(sim: Sim, dt: number) {
  if (!sim.running || sim.phase !== 'bore') return
  sim.head += dt * (sim.rpm / 60) * 2 * Math.PI * 3.5
}
