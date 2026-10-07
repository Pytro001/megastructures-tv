import { API, native, setVoiceSink, type VoiceSink } from './env'

/**
 * Where a spoken question comes from, best first:
 *  1. the native shell (Android SpeechRecognizer), results through window.MegaTV.onVoice,
 *  2. the Web Speech API in the page (Chrome, Edge, Safari on a laptop),
 *  3. nothing: the overlay offers suggested questions and a typed field.
 */
export type VoiceSource = 'native' | 'webspeech' | 'none'

interface SR { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }

export function voiceSource(): VoiceSource {
  if (native()?.startListening) return 'native'
  const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
  if (W.SpeechRecognition || W.webkitSpeechRecognition) return 'webspeech'
  return 'none'
}

let rec: SR | null = null

/** start listening; callbacks fire with partial and final text */
export function listen(cb: VoiceSink): VoiceSource {
  const src = voiceSource()
  setVoiceSink(cb)
  if (src === 'native') { native()!.startListening!(); return src }
  if (src === 'webspeech') {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Ctor = (W.SpeechRecognition || W.webkitSpeechRecognition)!
    rec = new Ctor()
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1
    let done = false
    rec.onresult = e => {
      let text = '', final = false
      for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; if (e.results[i].isFinal) final = true }
      if (final) { done = true; cb.final(text.trim()) } else cb.partial(text)
    }
    rec.onerror = e => { done = true; cb.error(e.error) }
    rec.onend = () => { if (!done) cb.error('no-speech') }
    try { rec.start() } catch (e) { cb.error(String(e)) }
  }
  return src
}

export function stopListening() {
  native()?.stopListening?.()
  try { rec?.abort() } catch { /* already stopped */ }
  rec = null
  setVoiceSink(null)
}

/* ---------------- the API ---------------- */

export interface Action { type: 'jumpToChapter' | 'setParam'; sim: string; chapter?: string; param?: string; value?: number | string; label?: string; display?: string }
export interface Answer { source: 'bedrock' | 'replay' | 'mock'; question: string; say: string; actions: Action[]; notes?: string[]; ms?: number; model?: string; latencyMs?: number }

export async function askApi(state: unknown): Promise<Answer> {
  const r = await fetch(`${API}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) })
  if (!r.ok) throw new Error((await r.json().catch(() => ({ error: r.statusText }))).error)
  return r.json()
}

export interface ApiConfig { voiceMode: string; bedrock: boolean; model: string | null; tts: 'browser' | 'polly' }
export async function apiConfig(): Promise<ApiConfig | null> {
  try { const r = await fetch(`${API}/api/config`); return r.ok ? r.json() : null } catch { return null }
}
