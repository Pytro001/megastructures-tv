/**
 * Asteroid impact sound (from the tunnel boring machine's synth).
 * Every sound of the tunnel boring machine is synthesised: the main drive's
 * rumble and the whine of its motors, the cutters grinding (a wet squelch in
 * clay, a hiss in sand, a crunch with cracks in granite), the screw's slow
 * thump, hydraulics, the clank of a segment going home and the erector's
 * warning beeps, over a low pad and pulse. The same code drives a live
 * AudioContext and an OfflineAudioContext for the film, so the film's
 * soundtrack is sample exact.
 */

export type Opts = Record<string, number | string | undefined>
export interface Ev { t: number; name: string; o?: Opts }
export interface Voice { rpm: number; bore: number; ground: number; screw: number; ring: number; vol: number }

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

interface Mood { pad: number[]; arp: number[]; energy: number; cut?: number }
const MOODS: Record<string, Mood> = {
  lab: { pad: [38, 45, 50, 57, 62], arp: [], energy: 0, cut: 650 },
  entry: { pad: [37, 44, 49, 56, 61], arp: [61, 0, 64, 0, 68, 0, 64, 0], energy: 1, cut: 1300 },
  contact: { pad: [36, 43, 48, 55, 60], arp: [], energy: 0, cut: 500 },
  dig: { pad: [34, 41, 46, 53, 58], arp: [58, 61, 65, 70, 65, 61, 58, 53], energy: 3, cut: 2200 },
  collapse: { pad: [33, 40, 45, 52, 57], arp: [57, 0, 60, 0, 64, 0, 60, 0], energy: 2, cut: 1400 },
  city: { pad: [31, 38, 43, 50, 55], arp: [55, 58, 62, 67, 62, 58, 55, 50], energy: 3, cut: 1800 },
  sizes: { pad: [38, 45, 50, 57, 62, 69], arp: [74, 77, 81, 86, 81, 77, 74, 69], energy: 4, cut: 3600 },
}

export class Synth {
  readonly ctx: BaseAudioContext
  private bus: GainNode
  private wet: GainNode
  private padFilter: BiquadFilterNode
  private padGain: GainNode
  private padOsc: OscillatorNode[] = []
  private timeline: { t: number; mood: Mood }[] = []
  private voices: { t: number; v: Voice }[] = []
  private seed = 7654321
  private noiseBuf: AudioBuffer
  private brownBuf: AudioBuffer
  private nextStep = 0
  private nextFx = 0
  readonly bpm = 104
  // machine voice
  private rumble: GainNode; private rumbleF: BiquadFilterNode
  private whine: OscillatorNode; private whine2: OscillatorNode; private whineG: GainNode
  private mudG: GainNode; private mudF: BiquadFilterNode
  private hissG: GainNode
  private crunchG: GainNode
  private machine: GainNode

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25
    const master = ctx.createGain(); master.gain.value = 0.85
    comp.connect(master).connect(ctx.destination)
    this.bus = ctx.createGain(); this.bus.connect(comp)
    const verb = ctx.createConvolver()
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.6), ir = ctx.createBuffer(2, len, sr)
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (this.rnd() * 2 - 1) * Math.pow(1 - i / len, 3) }
    verb.buffer = ir
    this.wet = ctx.createGain(); this.wet.gain.value = 0.35
    this.wet.connect(verb).connect(comp)
    this.noiseBuf = ctx.createBuffer(1, sr * 2, sr)
    const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = this.rnd() * 2 - 1
    this.brownBuf = ctx.createBuffer(1, sr * 3, sr)
    const bd = this.brownBuf.getChannelData(0); let last = 0
    for (let i = 0; i < bd.length; i++) { last = (last + 0.02 * (this.rnd() * 2 - 1)) / 1.02; bd[i] = last * 3.5 }
    // pad
    this.padFilter = ctx.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.Q.value = 0.7; this.padFilter.frequency.value = 600
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0
    this.padFilter.connect(this.padGain); this.padGain.connect(this.bus); this.padGain.connect(this.wet)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08
    const lfoG = ctx.createGain(); lfoG.gain.value = 240; lfo.connect(lfoG).connect(this.padFilter.frequency); lfo.start(0)
    for (let i = 0; i < 12; i++) {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'
      o.frequency.value = 110; o.detune.value = (i % 2 ? 1 : -1) * (4 + i * 0.7)
      const g = ctx.createGain(); g.gain.value = 0.04
      o.connect(g).connect(this.padFilter); o.start(0)
      this.padOsc.push(o)
    }
    // the machine: one bus with its own level
    this.machine = ctx.createGain(); this.machine.gain.value = 0
    this.machine.connect(this.bus)
    const mWet = ctx.createGain(); mWet.gain.value = 0.25; this.machine.connect(mWet).connect(this.wet)
    const loop = (buf: AudioBuffer) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0); return s }
    // rumble: brown noise through a low pass
    this.rumbleF = ctx.createBiquadFilter(); this.rumbleF.type = 'lowpass'; this.rumbleF.frequency.value = 140; this.rumbleF.Q.value = 0.9
    this.rumble = ctx.createGain(); this.rumble.gain.value = 0
    loop(this.brownBuf).connect(this.rumbleF).connect(this.rumble).connect(this.machine)
    const sub = ctx.createOscillator(); sub.frequency.value = 42; sub.start(0)
    const subG = ctx.createGain(); subG.gain.value = 0.25; sub.connect(subG).connect(this.rumble)
    // motor whine: 14 VFD motors, a gear mesh tone
    this.whine = ctx.createOscillator(); this.whine.type = 'sawtooth'; this.whine.frequency.value = 300; this.whine.start(0)
    this.whine2 = ctx.createOscillator(); this.whine2.type = 'sine'; this.whine2.frequency.value = 600; this.whine2.start(0)
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 2
    this.whineG = ctx.createGain(); this.whineG.gain.value = 0
    this.whine.connect(wf).connect(this.whineG); const w2 = ctx.createGain(); w2.gain.value = 0.4; this.whine2.connect(w2).connect(this.whineG); this.whineG.connect(this.machine)
    // clay: a wet squelch, band passed noise wobbling with the head
    this.mudF = ctx.createBiquadFilter(); this.mudF.type = 'bandpass'; this.mudF.frequency.value = 260; this.mudF.Q.value = 2.5
    this.mudG = ctx.createGain(); this.mudG.gain.value = 0
    loop(this.brownBuf).connect(this.mudF).connect(this.mudG).connect(this.machine)
    const wob = ctx.createOscillator(); wob.frequency.value = 2.3; wob.start(0)
    const wobG = ctx.createGain(); wobG.gain.value = 120; wob.connect(wobG).connect(this.mudF.frequency)
    // sand: abrasive hiss
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3200; hf.Q.value = 0.8
    this.hissG = ctx.createGain(); this.hissG.gain.value = 0
    loop(this.noiseBuf).connect(hf).connect(this.hissG).connect(this.machine)
    // granite: a grinding crunch bed (the cracks are scheduled as events)
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1400; cf.Q.value = 1.4
    const shp = ctx.createWaveShaper(); const curve = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = (i / 511) * 2 - 1; curve[i] = Math.tanh(x * 6) } shp.curve = curve
    this.crunchG = ctx.createGain(); this.crunchG.gain.value = 0
    loop(this.noiseBuf).connect(cf).connect(shp).connect(this.crunchG).connect(this.machine)
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647 }

  private out(node: AudioNode, wet = 0.4) {
    node.connect(this.bus)
    if (wet > 0) { const g = this.ctx.createGain(); g.gain.value = wet; node.connect(g).connect(this.wet) }
  }
  private env(at: number, a: number, d: number, peak: number) {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + a)
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + d)
    return g
  }
  private noise(at: number, dur: number, brown = false) {
    const s = this.ctx.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true
    s.start(at, this.rnd() * 1.5); s.stop(at + dur + 0.05)
    return s
  }
  private osc(type: OscillatorType, f: number, at: number, dur: number) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.start(at); o.stop(at + dur + 0.05)
    return o
  }

  /** the machine's state from `at` on */
  voice(at: number, v: Voice) {
    this.voices.push({ t: at, v })
    const k = 0.12
    const run = v.bore * Math.min(1, v.rpm / 1.2)
    this.machine.gain.setTargetAtTime(v.vol, at, 0.2)
    this.rumble.gain.setTargetAtTime(0.22 + 0.55 * run, at, k)
    this.rumbleF.frequency.setTargetAtTime(90 + 90 * run, at, k)
    this.whine.frequency.setTargetAtTime(220 + v.rpm * 160, at, 0.3)
    this.whine2.frequency.setTargetAtTime(440 + v.rpm * 320, at, 0.3)
    this.whineG.gain.setTargetAtTime((0.012 + 0.03 * Math.min(1, v.rpm / 2)) * (v.bore ? 1 : 0.3), at, k)
    this.mudG.gain.setTargetAtTime(v.ground === 0 ? 0.5 * run : 0, at, k)
    this.hissG.gain.setTargetAtTime(v.ground === 1 ? 0.07 * run : 0, at, k)
    this.crunchG.gain.setTargetAtTime(v.ground === 2 ? 0.05 * run : 0, at, k)
  }
  private voiceAt(t: number): Voice | null {
    let r: Voice | null = null
    for (const e of this.voices) { if (e.t <= t + 1e-4) r = e.v; else break }
    return r
  }

  mood(at: number, key: string) {
    const m = MOODS[key] ?? MOODS.lab
    this.timeline.push({ t: at, mood: m })
    this.timeline.sort((a, b) => a.t - b.t)
    m.pad.forEach((n, i) => { for (const k of [0, 1]) { const o = this.padOsc[i * 2 + k]; if (o) o.frequency.setTargetAtTime(mtof(n), at, 0.35) } })
    for (let i = m.pad.length * 2; i < this.padOsc.length; i++) this.padOsc[i].frequency.setTargetAtTime(mtof(m.pad[i % m.pad.length] + 12), at, 0.35)
    this.padFilter.frequency.setTargetAtTime(m.cut ?? 1200, at, 0.6)
    this.padGain.gain.setTargetAtTime(0.22 + m.energy * 0.035, at, 0.5)
  }
  fadeOut(at: number, d: number) { this.padGain.gain.setTargetAtTime(0.0001, at, d / 4); this.machine.gain.setTargetAtTime(0.0001, at, d / 4); this.timeline.push({ t: at, mood: { pad: [], arp: [], energy: 0 } }) }
  private moodAt(t: number) {
    let m: Mood | null = null
    for (const e of this.timeline) { if (e.t <= t + 1e-4) m = e.mood; else break }
    return m
  }

  /** the pulse, plus the machine's own rhythmic parts, on a grid between two times */
  music(from: number, to: number, beat = true) {
    const step = 60 / this.bpm / 4
    let i = Math.max(this.nextStep, Math.ceil(from / step - 1e-6))
    for (; i * step < to; i++) {
      const at = i * step, m = this.moodAt(at)
      if (!m || !beat) continue
      const s = i % 16
      if (m.arp.length && m.energy >= 1) {
        const n = m.arp[i % m.arp.length]
        if (n && (m.energy >= 2 || s % 2 === 0)) this.pluck(at, mtof(n), 0.035 + (s % 4 === 0 ? 0.02 : 0), m.energy >= 3 ? 2200 : 1400)
      }
      if (m.energy >= 2 && s % 4 === 0) this.kick(at, s === 0 ? 0.42 : 0.26)
      if (m.energy >= 3 && s % 4 === 2) this.hat(at, 0.04)
      if (m.energy >= 4 && s % 2 === 1) this.hat(at, 0.02)
    }
    this.nextStep = i
    // machine texture: screw thumps and rock cracks
    let t = Math.max(this.nextFx, from)
    while (t < to) {
      const v = this.voiceAt(t)
      if (!v || !v.bore) { t += 0.05; continue }
      if (v.ground === 2 && this.rnd() < 0.55) this.crack(t, 0.05 + this.rnd() * 0.12)
      if (v.ground === 0 && this.rnd() < 0.08) this.squelch(t)
      if (v.ground === 1 && this.rnd() < 0.15) this.rattle(t)
      t += 0.035 + this.rnd() * 0.06
    }
    this.nextFx = t
  }
  resetGrid(at: number) { this.nextStep = Math.ceil(at / (60 / this.bpm / 4)); this.nextFx = at }

  private pluck(at: number, f: number, v: number, cut: number) {
    const o = this.osc('sawtooth', f, at, 0.5), o2 = this.osc('square', f * 2.001, at, 0.5)
    const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6
    fl.frequency.setValueAtTime(cut, at); fl.frequency.exponentialRampToValueAtTime(220, at + 0.22)
    const g = this.env(at, 0.004, 0.42, v)
    const g2 = this.ctx.createGain(); g2.gain.value = 0.25
    o.connect(fl); o2.connect(g2).connect(fl); fl.connect(g)
    this.out(g, 0.55)
  }
  private kick(at: number, v: number) {
    const o = this.osc('sine', 110, at, 0.5); o.frequency.exponentialRampToValueAtTime(36, at + 0.2)
    const g = this.env(at, 0.002, 0.45, v); o.connect(g); this.out(g, 0.05)
  }
  private hat(at: number, v: number) {
    const n = this.noise(at, 0.06), f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000
    const g = this.env(at, 0.001, 0.05, v); n.connect(f).connect(g); this.out(g, 0.15)
  }
  crack(at: number, v: number) {
    const n = this.noise(at, 0.05), f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 + this.rnd() * 4000; f.Q.value = 3
    const g = this.env(at, 0.0008, 0.025 + this.rnd() * 0.04, v); n.connect(f).connect(g); this.out(g, 0.3)
  }
  private squelch(at: number) {
    const n = this.noise(at, 0.4, true), f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6
    f.frequency.setValueAtTime(500, at); f.frequency.exponentialRampToValueAtTime(140, at + 0.3)
    const g = this.env(at, 0.02, 0.3, 0.6); n.connect(f).connect(g); this.out(g, 0.2)
  }
  private rattle(at: number) {
    const n = this.noise(at, 0.03), f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500
    const g = this.env(at, 0.001, 0.02, 0.05); n.connect(f).connect(g); this.out(g, 0.2)
  }

  play(name: string, at: number, o: Opts = {}) {
    const num = (k: string, d: number) => (typeof o[k] === 'number' ? (o[k] as number) : d)
    const ctx = this.ctx
    switch (name) {
      case 'mood': this.mood(at, String(o.key)); break
      case 'fadeout': this.fadeOut(at, num('d', 2)); break
      case 'voice': this.voice(at, { rpm: num('rpm', 0), bore: num('bore', 0), ground: num('ground', 0), screw: num('screw', 1), ring: num('ring', 0), vol: num('vol', 0.8) }); break
      case 'tick': {
        const n = this.noise(at, 0.03), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = num('f', 3000); f.Q.value = 8
        const g = this.env(at, 0.001, 0.03, num('v', 0.2)); n.connect(f).connect(g); this.out(g, 0.3)
        break
      }
      case 'whoosh': {
        const d = num('d', 1.2), up = o.dir !== 'down'
        const n = this.noise(at, d), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4
        f.frequency.setValueAtTime(up ? 250 : 3500, at); f.frequency.exponentialRampToValueAtTime(up ? 3500 : 200, at + d)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(num('v', 0.3), at + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(f).connect(g); this.out(g, 0.5)
        break
      }
      case 'laser': {
        // the section plane sweeping: a bright hum rising and a fizz
        const d = num('d', 1.6)
        const s = this.osc('sawtooth', 180, at, d); s.frequency.exponentialRampToValueAtTime(420, at + d)
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 4
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.06, at + 0.2); g.gain.setValueAtTime(0.06, at + d - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        s.connect(f).connect(g); this.out(g, 0.5)
        const n = this.noise(at, d), nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 6000
        const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, at); ng.gain.exponentialRampToValueAtTime(0.05, at + 0.3); ng.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(nf).connect(ng); this.out(ng, 0.4)
        break
      }
      case 'hyd': {
        // hydraulics: a pump whine bending up and a hiss of oil
        const d = num('d', 0.9)
        const s = this.osc('sawtooth', 95, at, d); s.frequency.linearRampToValueAtTime(150, at + d * 0.6); s.frequency.linearRampToValueAtTime(110, at + d)
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.09 * num('v', 1), at + 0.08); g.gain.setValueAtTime(0.09 * num('v', 1), at + d - 0.12); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        s.connect(f).connect(g); this.out(g, 0.2)
        const n = this.noise(at, d), nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 4500; nf.Q.value = 1
        const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, at); ng.gain.exponentialRampToValueAtTime(0.035 * num('v', 1), at + 0.1); ng.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(nf).connect(ng); this.out(ng, 0.3)
        break
      }
      case 'clank': {
        // 4 tonnes of concrete meeting the last ring: a thud and a ringing bolt
        const v = num('v', 0.6)
        const o1 = this.osc('sine', 70, at, 1); o1.frequency.exponentialRampToValueAtTime(34, at + 0.5)
        const g1 = this.env(at, 0.002, 0.7, v); o1.connect(g1); this.out(g1, 0.3)
        for (const [f, d, a] of [[612, 0.9, 0.05], [1433, 0.6, 0.035], [2861, 0.35, 0.025]] as const) {
          const s = this.osc('sine', f * (0.97 + this.rnd() * 0.06), at, d); const e = this.env(at, 0.001, d, a * v * 1.6); s.connect(e); this.out(e, 0.6)
        }
        const n = this.noise(at, 0.2), nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 2500
        const ng = this.env(at, 0.001, 0.15, v * 0.4); n.connect(nf).connect(ng); this.out(ng, 0.4)
        break
      }
      case 'beep': {
        const s = this.osc('square', 1240, at, 0.18), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1240; f.Q.value = 5
        const g = this.env(at, 0.004, 0.16, num('v', 0.05)); s.connect(f).connect(g); this.out(g, 0.5)
        break
      }
      case 'impact': {
        const v = num('v', 0.7)
        const o1 = this.osc('sine', 80, at, 1.6); o1.frequency.exponentialRampToValueAtTime(28, at + 0.9)
        const g1 = this.env(at, 0.003, 1.4, v); o1.connect(g1); this.out(g1, 0.3)
        const n = this.noise(at, 0.5), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2600, at); f.frequency.exponentialRampToValueAtTime(110, at + 0.4)
        const g2 = this.env(at, 0.002, 0.45, v * 0.5); n.connect(f).connect(g2); this.out(g2, 0.7)
        break
      }
      case 'rumble': {
        // the ground giving way: a long low groan
        const d = num('d', 2.5)
        const n = this.noise(at, d, true), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(num('v', 0.8), at + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(f).connect(g); this.out(g, 0.4)
        break
      }
      case 'roar': {
        // entry: air turned to plasma, a rising roar with crackle
        const d = num('d', 2.2), v = num('v', 0.7)
        const n = this.noise(at, d, true), f = ctx.createBiquadFilter(); f.type = 'lowpass'
        f.frequency.setValueAtTime(200, at); f.frequency.exponentialRampToValueAtTime(2400, at + d)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + d * 0.95); g.gain.linearRampToValueAtTime(0, at + d + 0.03)
        n.connect(f).connect(g); this.out(g, 0.3)
        for (let t2 = at; t2 < at + d; t2 += 0.02 + this.rnd() * 0.05) this.crack(t2, 0.04 + 0.12 * ((t2 - at) / d))
        break
      }
      case 'sonic': {
        // the double crack of a shock wave passing
        for (const dt of [0, 0.11]) {
          const n = this.noise(at + dt, 0.25), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3500
          const g = this.env(at + dt, 0.001, 0.22, num('v', 0.6)); n.connect(f).connect(g); this.out(g, 0.6)
        }
        break
      }
      case 'boom': {
        // the impact: a sub drop you feel, a wall of noise, a long rumble
        const v = num('v', 1)
        const o1 = this.osc('sine', 62, at, 5); o1.frequency.exponentialRampToValueAtTime(18, at + 3.5)
        const g1 = this.env(at, 0.004, 4.5, v); o1.connect(g1); this.out(g1, 0.2)
        const n = this.noise(at, 6, true), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, at); f.frequency.exponentialRampToValueAtTime(80, at + 5)
        const g2 = this.env(at, 0.002, 5.5, v * 0.9); n.connect(f).connect(g2); this.out(g2, 0.8)
        const w = this.noise(at, 0.4), wf = ctx.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 1500
        const g3 = this.env(at, 0.001, 0.35, v * 0.5); w.connect(wf).connect(g3); this.out(g3, 0.7)
        break
      }
      case 'debris': {
        // rock raining back down
        const d = num('d', 3), v = num('v', 0.15)
        for (let t2 = at; t2 < at + d; t2 += 0.01 + this.rnd() * 0.04) { const k = Math.sin(Math.PI * (t2 - at) / d); this.crack(t2, v * k * (0.4 + this.rnd())) }
        const n = this.noise(at, d, true), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 1
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v * 2, at + d * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(f).connect(g); this.out(g, 0.4)
        break
      }
      case 'wind': {
        // the blast wind tearing through the city
        const d = num('d', 3)
        const n = this.noise(at, d), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8
        f.frequency.setValueAtTime(400, at); f.frequency.exponentialRampToValueAtTime(1600, at + d * 0.3); f.frequency.exponentialRampToValueAtTime(250, at + d)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(num('v', 0.5), at + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(f).connect(g); this.out(g, 0.5)
        break
      }
      case 'riser': {
        const d = num('d', 2)
        const n = this.noise(at, d), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3
        f.frequency.setValueAtTime(300, at); f.frequency.exponentialRampToValueAtTime(6000, at + d)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.18, at + d); g.gain.linearRampToValueAtTime(0, at + d + 0.02)
        n.connect(f).connect(g); this.out(g, 0.5)
        break
      }
    }
  }
}

/* ------------------------------------------------------------------ the page's audio */

let live: { ctx: AudioContext; synth: Synth } | null = null
let filmLog: Ev[] | null = null
let filmClock = () => 0
let muted = false
let lastVoice: Opts | null = null

export function sfx(name: string, o?: Opts) {
  if (filmLog) { filmLog.push({ t: filmClock(), name, o }); return }
  if (live && !muted) live.synth.play(name, live.ctx.currentTime + 0.01, o)
}

export const audio = {
  start() {
    if (filmLog) return
    if (!live) {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      const synth = new Synth(ctx)
      live = { ctx, synth }
      synth.resetGrid(ctx.currentTime)
      synth.mood(ctx.currentTime, 'lab')
      if (lastVoice) synth.play('voice', ctx.currentTime, lastVoice)
    }
    void live.ctx.resume()
  },
  get on() { return !!live && !muted && live.ctx.state === 'running' },
  toggle() {
    if (!live) { this.start(); muted = false; return true }
    muted = !muted
    if (muted) void live.ctx.suspend(); else { void live.ctx.resume(); live.synth.resetGrid(live.ctx.currentTime) }
    return !muted
  },
  /** the machine's state; sent every few frames, it only goes out when it changes */
  voice(v: Opts) {
    const key = JSON.stringify(v)
    if (lastVoice && JSON.stringify(lastVoice) === key) return
    lastVoice = v
    sfx('voice', v)
  },
  tick(beat = true) { if (live && !muted && live.ctx.state === 'running') live.synth.music(live.ctx.currentTime, live.ctx.currentTime + 0.25, beat) },
  film(clock: () => number) { filmLog = []; filmClock = clock },
  filmReset() { if (filmLog) filmLog.length = 0; lastVoice = null },
  async renderFilm(duration: number, t0: number) {
    const sr = 48000
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * duration), sr)
    const synth = new Synth(ctx)
    for (const e of filmLog ?? []) {
      const at = Math.max(0, e.t - t0)
      if (at < duration) synth.play(e.name, at + 0.001, e.o)
    }
    synth.music(0, duration)
    synth.play('fadeout', Math.max(0, duration - 2.2), { d: 2.2 })
    const buf = await ctx.startRendering()
    return wavBase64(buf)
  },
}

function wavBase64(buf: AudioBuffer) {
  const ch = buf.numberOfChannels, n = buf.length, bytes = 44 + n * ch * 2
  const dv = new DataView(new ArrayBuffer(bytes))
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true)
  dv.setUint16(22, ch, true); dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true)
  w(36, 'data'); dv.setUint32(40, n * ch * 2, true)
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c))
  let o = 44
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2 }
  const u8 = new Uint8Array(dv.buffer)
  let bin = ''
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(bin)
}
