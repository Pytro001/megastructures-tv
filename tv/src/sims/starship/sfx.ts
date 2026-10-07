/**
 * Every sound on the Starship page is synthesised: a pad and a pulse for each
 * chapter, and the rocket itself: a low roar with the crackle of 33 supersonic
 * jets, the bang of hot staging, the whoosh of the stack coming apart. The
 * same code drives a live AudioContext in the page and an OfflineAudioContext
 * when the film is rendered, so the soundtrack of the video is sample-exact.
 */

export type Opts = Record<string, number | string | undefined>
export interface Ev { t: number; name: string; o?: Opts }

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

interface Mood { pad: number[]; arp: number[]; energy: number; cut?: number; tempo?: number }
// MIDI notes. Each chapter has a chord for the pad and a figure for the pulse.
const MOODS: Record<string, Mood> = {
  climb: { pad: [38, 45, 50, 57, 62, 69], arp: [], energy: 0, cut: 900 },
  cut: { pad: [41, 48, 53, 60, 64], arp: [72, 76, 79, 84, 79, 76, 72, 67], energy: 2, cut: 1700 },
  tanks: { pad: [36, 43, 52, 59, 64], arp: [67, 71, 74, 79, 83, 79, 74, 71], energy: 2, cut: 2100 },
  engines: { pad: [38, 45, 50, 57, 62, 69], arp: [74, 77, 81, 86, 89, 86, 81, 77], energy: 3, cut: 3200 },
  explode: { pad: [43, 50, 55, 62, 67], arp: [74, 0, 79, 0, 83, 0, 79, 0], energy: 1, cut: 1300 },
  staging: { pad: [36, 43, 52, 60, 64, 71], arp: [79, 81, 84, 88, 91, 88, 84, 81], energy: 4, cut: 4200 },
  outro: { pad: [41, 48, 57, 64, 69, 72], arp: [], energy: 0, cut: 1500 },
}

export class Synth {
  readonly ctx: BaseAudioContext
  private bus: GainNode
  private wet: GainNode
  private padFilter: BiquadFilterNode
  private padGain: GainNode
  private padOsc: OscillatorNode[] = []
  private timeline: { t: number; mood: Mood }[] = []
  private seed = 1234567
  private noiseBuf: AudioBuffer
  private shaper: WaveShaperNode
  private nextStep = 0
  readonly bpm = 112

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25
    const master = ctx.createGain(); master.gain.value = 0.85
    comp.connect(master).connect(ctx.destination)
    this.bus = ctx.createGain(); this.bus.connect(comp)
    // a big hall: stereo noise impulse with a 3 s exponential tail
    const verb = ctx.createConvolver()
    const sr = ctx.sampleRate, len = Math.floor(sr * 3.2), ir = ctx.createBuffer(2, len, sr)
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (this.rnd() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < sr * 0.01 ? i / (sr * 0.01) : 1) }
    verb.buffer = ir
    this.wet = ctx.createGain(); this.wet.gain.value = 0.42
    this.wet.connect(verb).connect(comp)
    // white noise for whooshes and cracks
    this.noiseBuf = ctx.createBuffer(1, sr * 2, sr)
    const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = this.rnd() * 2 - 1
    this.shaper = ctx.createWaveShaper()
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.round(x * 5) / 5 }
    this.shaper.curve = curve; this.shaper.connect(this.bus); this.shaper.connect(this.wet)
    // the pad: five detuned saws through a slowly breathing low-pass
    this.padFilter = ctx.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.Q.value = 0.7; this.padFilter.frequency.value = 600
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0
    this.padFilter.connect(this.padGain); this.padGain.connect(this.bus); this.padGain.connect(this.wet)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09
    const lfoG = ctx.createGain(); lfoG.gain.value = 260; lfo.connect(lfoG).connect(this.padFilter.frequency); lfo.start(0)
    for (let i = 0; i < 12; i++) {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'
      o.frequency.value = 110; o.detune.value = (i % 2 ? 1 : -1) * (4 + i * 0.7)
      const g = ctx.createGain(); g.gain.value = 0.045
      o.connect(g).connect(this.padFilter); o.start(0)
      this.padOsc.push(o)
    }
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
  private noise(at: number, dur: number) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true
    s.start(at, this.rnd() * 1.5); s.stop(at + dur + 0.05)
    return s
  }
  private osc(type: OscillatorType, f: number, at: number, dur: number) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.start(at); o.stop(at + dur + 0.05)
    return o
  }

  /** set the music for a chapter from `at` on */
  mood(at: number, key: string) {
    const m = MOODS[key] ?? MOODS.cut
    this.timeline.push({ t: at, mood: m })
    this.timeline.sort((a, b) => a.t - b.t)
    m.pad.forEach((n, i) => {
      for (const k of [0, 1]) {
        const o = this.padOsc[i * 2 + k]
        if (o) o.frequency.setTargetAtTime(mtof(n), at, 0.35)
      }
    })
    for (let i = m.pad.length * 2; i < this.padOsc.length; i++) this.padOsc[i].frequency.setTargetAtTime(mtof(m.pad[i % m.pad.length] + 12), at, 0.35)
    this.padFilter.frequency.setTargetAtTime(m.cut ?? 1200, at, 0.6)
    this.padGain.gain.setTargetAtTime(0.3 + m.energy * 0.04, at, 0.5)
  }
  fadeOut(at: number, d: number) { this.padGain.gain.setTargetAtTime(0.0001, at, d / 4); this.timeline.push({ t: at, mood: { pad: [], arp: [], energy: 0 } }) }
  private moodAt(t: number) {
    let m: Mood | null = null
    for (const e of this.timeline) { if (e.t <= t + 1e-4) m = e.mood; else break }
    return m
  }

  /** schedule the pulse (plucks, kick, hats) on a fixed 16th grid between two times */
  music(from: number, to: number) {
    const step = 60 / this.bpm / 4
    let i = Math.max(this.nextStep, Math.ceil(from / step - 1e-6))
    for (; i * step < to; i++) {
      const at = i * step, m = this.moodAt(at)
      if (!m) continue
      const s = i % 16
      if (m.arp.length && m.energy >= 1) {
        const n = m.arp[i % m.arp.length]
        if (n && (m.energy >= 2 || s % 2 === 0)) this.pluck(at, mtof(n), 0.05 + (s % 4 === 0 ? 0.025 : 0), m.energy >= 3 ? 2400 : 1500)
      }
      if (m.energy >= 2 && s % 4 === 0) this.kick(at, s === 0 ? 0.5 : 0.32)
      if (m.energy >= 3 && s % 4 === 2) this.hat(at, 0.05)
      if (m.energy >= 4 && s % 2 === 1) this.hat(at, 0.025)
    }
    this.nextStep = i
  }
  resetGrid(at: number) { this.nextStep = Math.ceil(at / (60 / this.bpm / 4)) }

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
    const o = this.osc('sine', 120, at, 0.5); o.frequency.exponentialRampToValueAtTime(38, at + 0.18)
    const g = this.env(at, 0.002, 0.45, v); o.connect(g); this.out(g, 0.05)
  }
  private hat(at: number, v: number) {
    const n = this.noise(at, 0.06), f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000
    const g = this.env(at, 0.001, 0.05, v); n.connect(f).connect(g); this.out(g, 0.15)
  }

  /** one-shot effects */
  play(name: string, at: number, o: Opts = {}) {
    const num = (k: string, d: number) => (typeof o[k] === 'number' ? (o[k] as number) : d)
    const ctx = this.ctx
    switch (name) {
      case 'mood': this.mood(at, String(o.key)); break
      case 'fadeout': this.fadeOut(at, num('d', 2)); break
      case 'blip': {
        const f = num('f', 880), v = num('v', 0.12)
        const a = this.osc('sine', f, at, 0.6), b = this.osc('triangle', f * 2, at, 0.3)
        const g = this.env(at, 0.003, num('d', 0.5), v), g2 = this.env(at, 0.002, 0.12, v * 0.4)
        a.connect(g); b.connect(g2); this.out(g, 0.6); this.out(g2, 0.6)
        break
      }
      case 'tick': {
        const n = this.noise(at, 0.03), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = num('f', 3000); f.Q.value = 8
        const g = this.env(at, 0.001, 0.03, num('v', 0.25)); n.connect(f).connect(g); this.out(g, 0.3)
        break
      }
      case 'whoosh': {
        const d = num('d', 1.2), up = o.dir !== 'down'
        const n = this.noise(at, d), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4
        f.frequency.setValueAtTime(up ? 250 : 3500, at); f.frequency.exponentialRampToValueAtTime(up ? 3500 : 200, at + d)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(num('v', 0.35), at + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(f).connect(g); this.out(g, 0.5)
        break
      }
      case 'impact': {
        const v = num('v', 0.7)
        const o1 = this.osc('sine', 90, at, 1.6); o1.frequency.exponentialRampToValueAtTime(30, at + 0.9)
        const g1 = this.env(at, 0.003, 1.4, v); o1.connect(g1); this.out(g1, 0.3)
        const n = this.noise(at, 0.5), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, at); f.frequency.exponentialRampToValueAtTime(120, at + 0.4)
        const g2 = this.env(at, 0.002, 0.45, v * 0.5); n.connect(f).connect(g2); this.out(g2, 0.7)
        break
      }
      case 'snap': {
        // a cable parting: a crack, a ringing steel armour wire, and the boom under it
        const n = this.noise(at, 0.12), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500
        const g = this.env(at, 0.001, 0.09, 0.7); n.connect(hp).connect(g); this.out(g, 0.6)
        for (const [f, d, v] of [[431, 1.6, 0.08], [1187, 1.1, 0.06], [2273, 0.7, 0.04], [3311, 0.5, 0.03]] as const) {
          const s = this.osc('sine', f * (0.98 + this.rnd() * 0.04), at, d); const e = this.env(at, 0.001, d, v); s.connect(e); this.out(e, 0.7)
        }
        this.play('impact', at, { v: 0.8 })
        // electrical arc: 10 kV of feed current finding the sea
        const z = this.osc('sawtooth', 60, at, 0.5), zg = this.env(at, 0.002, 0.4, 0.12), zf = ctx.createBiquadFilter(); zf.type = 'bandpass'; zf.frequency.value = 900; zf.Q.value = 3
        z.connect(zf).connect(zg); zg.connect(this.shaper)
        break
      }
      case 'glitch': {
        const d = num('d', 1)
        let t = at
        while (t < at + d) {
          const len = 0.02 + this.rnd() * 0.06
          const s = this.osc(this.rnd() < 0.5 ? 'square' : 'sawtooth', 80 + Math.pow(this.rnd(), 2) * 2400, t, len)
          const g = ctx.createGain(); g.gain.setValueAtTime(0.09, t); g.gain.setValueAtTime(0, t + len)
          s.connect(g).connect(this.shaper)
          t += len + this.rnd() * 0.05
        }
        break
      }
      case 'powerdown': {
        const d = num('d', 1.6)
        const s = this.osc('sawtooth', 520, at, d), s2 = this.osc('square', 261, at, d)
        s.frequency.exponentialRampToValueAtTime(28, at + d); s2.frequency.exponentialRampToValueAtTime(14, at + d)
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(4000, at); f.frequency.exponentialRampToValueAtTime(90, at + d)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.22, at); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        s.connect(f); s2.connect(f); f.connect(g); this.out(g, 0.6)
        break
      }
      case 'riser': {
        const d = num('d', 2)
        const n = this.noise(at, d), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3
        f.frequency.setValueAtTime(300, at); f.frequency.exponentialRampToValueAtTime(6000, at + d)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.22, at + d); g.gain.linearRampToValueAtTime(0, at + d + 0.02)
        n.connect(f).connect(g); this.out(g, 0.5)
        const s = this.osc('sine', 220, at, d); s.frequency.exponentialRampToValueAtTime(1760, at + d)
        const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, at); sg.gain.exponentialRampToValueAtTime(0.05, at + d); sg.gain.linearRampToValueAtTime(0, at + d + 0.02)
        s.connect(sg); this.out(sg, 0.6)
        break
      }
      case 'chatter': {
        // modems talking: many short random tones, like a router's soul
        const d = num('d', 1.5), k = num('n', 30), v = num('v', 0.04)
        for (let i = 0; i < k; i++) {
          const t = at + this.rnd() * d, f = 600 + Math.floor(this.rnd() * 12) * 180
          const s = this.osc('square', f, t, 0.04), g = this.env(t, 0.001, 0.035, v)
          s.connect(g); this.out(g, 0.4)
        }
        break
      }
      case 'hum': {
        // the feed current: 50 Hz harmonics, rising and falling
        const d = num('d', 4)
        for (const [f, v] of [[50, 0.12], [100, 0.07], [150, 0.04], [250, 0.02]] as const) {
          const s = this.osc('sine', f, at, d), g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + d * 0.3); g.gain.setValueAtTime(v, at + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
          s.connect(g); this.out(g, 0.2)
        }
        break
      }
      case 'buzz': {
        // four melt pools: a galvo whine wobbling with the hatch, and the crackle of spatter
        const d = num('d', 2), v = num('v', 0.05)
        const w = this.osc('sawtooth', 2350, at, d), wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 2400; wf.Q.value = 6
        const lfo = this.osc('square', 23, at, d), lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(w.frequency)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.12); g.gain.setValueAtTime(v, at + d - 0.15); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        w.connect(wf).connect(g); this.out(g, 0.25)
        let t = at
        while (t < at + d) {
          const len = 0.004 + this.rnd() * 0.01
          const n = this.noise(t, len), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500 + this.rnd() * 4000
          const e = this.env(t, 0.0005, len, v * (0.6 + this.rnd() * 1.4)); n.connect(f).connect(e); this.out(e, 0.2)
          t += 0.008 + this.rnd() * 0.03
        }
        break
      }
      case 'sweep': {
        // the recoater: a servo glide and powder hissing under the blade
        const d = num('d', 1)
        const s = this.osc('sawtooth', 160, at, d), sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 700
        s.frequency.setValueAtTime(140, at); s.frequency.linearRampToValueAtTime(220, at + d * 0.3); s.frequency.setValueAtTime(220, at + d * 0.7); s.frequency.linearRampToValueAtTime(130, at + d)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.07, at + 0.08); g.gain.setValueAtTime(0.07, at + d - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        s.connect(sf).connect(g); this.out(g, 0.15)
        const n = this.noise(at, d), nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 5200; nf.Q.value = 0.8
        const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, at); ng.gain.exponentialRampToValueAtTime(0.09, at + d * 0.5); ng.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(nf).connect(ng); this.out(ng, 0.3)
        break
      }
      case 'fan': {
        // the argon blower: a low rotor tone and moving air
        const d = num('d', 6), v = num('v', 0.05)
        const n = this.noise(at, d), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v * 2, at + 1); g.gain.setValueAtTime(v * 2, at + d - 1); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(f).connect(g); this.out(g, 0.2)
        const o = this.osc('triangle', 118, at, d), og = ctx.createGain(); og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(v * 0.5, at + 1); og.gain.setValueAtTime(v * 0.5, at + d - 1); og.gain.exponentialRampToValueAtTime(0.0001, at + d)
        o.connect(og); this.out(og, 0.1)
        break
      }
      case 'rumble': {
        // the roar: brown noise through a low pass, the crackle of shock waves on top
        const d = num('d', 6), v = num('v', 1)
        const n = this.noise(at, d), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 0.4
        const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 420
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.5 * v, at + 0.8); g.gain.setValueAtTime(0.5 * v, at + d - 1.2); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
        n.connect(lp).connect(lp2).connect(g); this.out(g, 0.15)
        const sub = this.osc('sine', 34, at, d), sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, at); sg.gain.exponentialRampToValueAtTime(0.22 * v, at + 1); sg.gain.setValueAtTime(0.22 * v, at + d - 1.2); sg.gain.exponentialRampToValueAtTime(0.0001, at + d)
        const wob = this.osc('sine', 3.1, at, d), wg = ctx.createGain(); wg.gain.value = 6; wob.connect(wg).connect(sub.frequency)
        sub.connect(sg); this.out(sg, 0.05)
        let t = at + 0.3
        while (t < at + d - 0.6) {
          const len = 0.003 + this.rnd() * 0.012
          const c = this.noise(t, len), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500 + this.rnd() * 2200; f.Q.value = 0.7
          const e = this.env(t, 0.0005, len * 2, v * (0.05 + this.rnd() * 0.12)); c.connect(f).connect(e); this.out(e, 0.25)
          t += 0.006 + this.rnd() * 0.05
        }
        break
      }
      case 'ignite': {
        // the ship's engines lighting in a box of steel: a thud, then a tearing roar
        const v = num('v', 1)
        this.play('impact', at, { v: 0.9 * v })
        const n = this.noise(at, 3), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.6
        f.frequency.setValueAtTime(220, at); f.frequency.exponentialRampToValueAtTime(1400, at + 0.4); f.frequency.exponentialRampToValueAtTime(300, at + 3)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.45 * v, at + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, at + 3)
        n.connect(f).connect(g); this.out(g, 0.5)
        break
      }
      case 'beam': {
        // a laser pulse train in glass: a shimmering high chord
        const d = num('d', 2), base = num('f', 1320)
        for (const r of [1, 1.25, 1.5, 2]) {
          const s = this.osc('sine', base * r, at, d), g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.018, at + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, at + d)
          const trem = this.osc('sine', 9 + r * 3, at, d), tg = ctx.createGain(); tg.gain.value = 0.01; trem.connect(tg).connect(g.gain)
          s.connect(g); this.out(g, 0.8)
        }
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
const pending: Ev[] = []

/** chapters call this; it plays now (live), or writes it into the film's cue sheet */
export function sfx(name: string, o?: Opts) {
  if (filmLog) { filmLog.push({ t: filmClock(), name, o }); return }
  if (live && !muted) { live.synth.play(name, live.ctx.currentTime + 0.01, o); return }
  if (name === 'mood') { pending.length = 0; pending.push({ t: 0, name, o }) }
}

export const audio = {
  /** starts the AudioContext; browsers only allow it after a click or key */
  start() {
    if (filmLog) return
    if (!live) {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      const synth = new Synth(ctx)
      live = { ctx, synth }
      synth.resetGrid(ctx.currentTime)
      for (const e of pending) synth.play(e.name, ctx.currentTime + 0.02, e.o)
      if (!pending.length) synth.mood(ctx.currentTime, 'climb')
      pending.length = 0
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
  /** called every frame: schedules the pulse a little ahead */
  tick() { if (live && !muted && live.ctx.state === 'running') live.synth.music(live.ctx.currentTime, live.ctx.currentTime + 0.25) },
  film(clock: () => number) { filmLog = []; filmClock = clock },
  filmReset() { if (filmLog) filmLog.length = 0 },
  /** renders the cue sheet to a 48 kHz stereo WAV, as base64 */
  async renderFilm(duration: number, t0: number) {
    const sr = 48000
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * duration), sr)
    const synth = new Synth(ctx)
    for (const e of filmLog ?? []) {
      const at = Math.max(0, e.t - t0)
      if (at < duration) synth.play(e.name, at + 0.001, e.o)
    }
    synth.music(0, duration)
    synth.play('fadeout', Math.max(0, duration - 2.6), { d: 2.6 })
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
