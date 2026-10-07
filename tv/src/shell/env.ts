import { pressKey, TV_KEYS, type TvKey } from 'megastructures-engine/tv/remote'

/** flags that travel from page to page: ?tv=1 performance mode, ?debug=1 fps overlay, ?remote=1 on screen remote, ?api= API base */
export const params = new URLSearchParams(location.search)
export const FILM = params.has('film')

/** the native host (the Android shell) announces itself before the page loads */
interface Host { tv?: boolean; api?: string; platform?: string; version?: string }
interface Native { startListening?: () => void; stopListening?: () => void; speak?: (t: string) => void; exit?: () => void }
const w = window as unknown as { MegaTVHost?: Host; MegaTVNative?: Native; MegaTV?: Bridge }
export const host: Host = w.MegaTVHost ?? {}
export const native = (): Native | undefined => w.MegaTVNative

function stored(k: string): string | null { try { return localStorage.getItem('megatv.' + k) } catch { return null } }
export function store(k: string, v: string) { try { localStorage.setItem('megatv.' + k, v) } catch { /* private mode */ } }

/** TV performance mode: URL wins, then the saved choice, then the host (on a Fire TV it is on by default) */
export const TV_MODE = params.has('tv') ? params.get('tv') === '1' : stored('tv') ? stored('tv') === '1' : !!host.tv
export const DEBUG = params.get('debug') === '1' || stored('debug') === '1'
export const SHOW_REMOTE = FILM || params.get('remote') === '1'
export const API = (params.get('api') ?? host.api ?? '').replace(/\/$/, '')

/** build a link to another page that keeps the flags */
export function link(page: string, extra: Record<string, string> = {}) {
  const p = new URLSearchParams()
  for (const k of ['tv', 'debug', 'remote', 'api']) { const v = params.get(k); if (v !== null) p.set(k, v) }
  for (const [k, v] of Object.entries(extra)) p.set(k, v)
  const q = p.toString()
  return page + (q ? '?' + q : '')
}

/** voice events from the native shell arrive here */
export interface VoiceSink { partial(t: string): void; final(t: string): void; error(msg: string): void }
let sink: VoiceSink | null = null
export function setVoiceSink(s: VoiceSink | null) { sink = s }

/** the bridge the Android shell calls: window.MegaTV.key('menu'), window.MegaTV.onVoice('...') */
interface Bridge {
  key(name: string): boolean
  onVoice(text: string): void
  onVoicePartial(text: string): void
  onVoiceError(msg: string): void
  version: string
}
w.MegaTV = {
  version: '0.1.0',
  key(name: string) { return TV_KEYS.includes(name as TvKey) ? pressKey(name as TvKey, 'native') : false },
  onVoice(text: string) { sink?.final(text) },
  onVoicePartial(text: string) { sink?.partial(text) },
  onVoiceError(msg: string) { sink?.error(msg) },
}

/** film time: every CSS transition and animation is paused and advanced by the film's own clock */
export function stepCssAnimations(dt: number) {
  for (const a of document.getAnimations()) {
    if (a.playState !== 'paused') a.pause()
    a.currentTime = ((a.currentTime as number | null) ?? 0) + dt * 1000
  }
}
