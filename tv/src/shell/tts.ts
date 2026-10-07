import { API, native } from './env'

/**
 * Speaking the answer. One interface, three implementations:
 *  - browser: speechSynthesis in the page (works in Chrome and in Android WebView where a TTS engine is installed),
 *  - native: the Android shell's TextToSpeech through the JS bridge,
 *  - polly: Amazon Polly through POST /api/tts (server needs TTS_PROVIDER=polly and AWS credentials).
 */
export interface Speaker { readonly name: string; speak(text: string): Promise<void>; cancel(): void }

export class BrowserSpeaker implements Speaker {
  readonly name = 'browser'
  speak(text: string) {
    return new Promise<void>(resolve => {
      const s = window.speechSynthesis
      if (!s) return resolve()
      s.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1.0; u.pitch = 1.0; u.lang = 'en-US'
      const v = s.getVoices().find(v => /en-US/.test(v.lang) && /Samantha|Google US English|Jenny|Aria/.test(v.name)) ?? s.getVoices().find(v => /^en/.test(v.lang))
      if (v) u.voice = v
      u.onend = () => resolve(); u.onerror = () => resolve()
      s.speak(u)
    })
  }
  cancel() { window.speechSynthesis?.cancel() }
}

export class NativeSpeaker implements Speaker {
  readonly name = 'native'
  speak(text: string) { native()?.speak?.(text); return Promise.resolve() }
  cancel() { /* the shell flushes on the next speak */ }
}

export class PollySpeaker implements Speaker {
  readonly name = 'polly'
  private audio: HTMLAudioElement | null = null
  constructor(private fallback: Speaker) {}
  async speak(text: string) {
    try {
      const r = await fetch(`${API}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
      if (!r.ok) throw new Error(String(r.status))
      const url = URL.createObjectURL(await r.blob())
      this.audio = new Audio(url)
      await new Promise<void>(res => { this.audio!.onended = () => res(); this.audio!.onerror = () => res(); void this.audio!.play().catch(() => res()) })
      URL.revokeObjectURL(url)
    } catch {
      await this.fallback.speak(text)
    }
  }
  cancel() { this.audio?.pause(); this.fallback.cancel() }
}

export function makeSpeaker(provider: string | undefined): Speaker {
  const local: Speaker = native()?.speak ? new NativeSpeaker() : new BrowserSpeaker()
  return provider === 'polly' ? new PollySpeaker(local) : local
}
