/**
 * Remote control input for a 10 foot UI.
 *
 * Everything in a TV app should be reachable with the five D-pad buttons
 * (up, down, left, right, select) plus back. The extra keys here are
 * shortcuts, never the only way to reach something.
 *
 * Three sources feed the same `TvKey` stream:
 *  1. A laptop keyboard (arrows, Enter, Escape or Backspace, M, Space, V).
 *  2. Fire TV remotes inside a WebView or the Silk browser. Amazon documents
 *     these JavaScript keyCodes for web apps: Up 38, Down 40, Left 37,
 *     Right 39, Select 13, Play/Pause 179, Rewind 227, Fast forward 228,
 *     Back 4 (an Android KEYCODE_BACK forwarded by the host).
 *  3. A native host (the Android shell) that calls `window.MegaTV.key(name)`
 *     for buttons a page never sees on its own, such as Menu.
 *
 * The microphone button on a Fire TV voice remote is a system button: Amazon
 * documents that it "cannot be intercepted" by apps. The Android shell
 * therefore uses Menu as the Ask button.
 */

export type TvKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'menu' | 'playpause' | 'mic' | 'rewind' | 'forward'

export const TV_KEYS: readonly TvKey[] = ['up', 'down', 'left', 'right', 'select', 'back', 'menu', 'playpause', 'mic', 'rewind', 'forward']

/** Fire TV web keyCodes (KeyboardEvent.keyCode) as documented by Amazon for web apps */
export const FIRE_TV_KEYCODES: Readonly<Record<number, TvKey>> = {
  38: 'up', 40: 'down', 37: 'left', 39: 'right', 13: 'select',
  4: 'back', 179: 'playpause', 227: 'rewind', 228: 'forward',
}

/** Android KeyEvent constants the native shell forwards, for reference and for the bridge */
export const ANDROID_KEYCODES: Readonly<Record<string, number>> = {
  KEYCODE_DPAD_UP: 19, KEYCODE_DPAD_DOWN: 20, KEYCODE_DPAD_LEFT: 21, KEYCODE_DPAD_RIGHT: 22, KEYCODE_DPAD_CENTER: 23,
  KEYCODE_ENTER: 66, KEYCODE_BACK: 4, KEYCODE_MENU: 82, KEYCODE_SEARCH: 84,
  KEYCODE_MEDIA_PLAY_PAUSE: 85, KEYCODE_MEDIA_REWIND: 89, KEYCODE_MEDIA_FAST_FORWARD: 90,
}

const BY_KEY: Readonly<Record<string, TvKey>> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'select', NumpadEnter: 'select',
  Escape: 'back', Backspace: 'back', BrowserBack: 'back', GoBack: 'back',
  m: 'menu', M: 'menu', ContextMenu: 'menu',
  ' ': 'playpause', MediaPlayPause: 'playpause',
  v: 'mic', V: 'mic',
  MediaRewind: 'rewind', MediaFastForward: 'forward', ',': 'rewind', '.': 'forward',
}

/** which TV key a keyboard event means, or null */
export function keyFromEvent(e: KeyboardEvent): TvKey | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  return BY_KEY[e.key] ?? FIRE_TV_KEYCODES[e.keyCode] ?? null
}

export interface RemoteEvent { key: TvKey; repeat: boolean; source: 'keyboard' | 'native' | 'script' }
export type RemoteHandler = (e: RemoteEvent) => boolean | void

const handlers: RemoteHandler[] = []
const listeners: ((e: RemoteEvent) => void)[] = []
let installed = false

function dispatch(e: RemoteEvent) {
  for (const l of listeners) l(e)
  // the most recently added handler gets the key first (an overlay above the page)
  for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i](e) === true) return true
  return false
}

/** feed a key from anywhere (native bridge, a scripted film, a test) */
export function pressKey(key: TvKey, source: RemoteEvent['source'] = 'script', repeat = false) {
  return dispatch({ key, repeat, source })
}

/**
 * Add a handler. Return true from it to consume the key. Handlers added later
 * see keys first, so an overlay can sit on top of the page below it.
 */
export function onRemote(h: RemoteHandler): () => void {
  install()
  handlers.push(h)
  return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1) }
}

/** watch every key without consuming it (an on screen remote, analytics, a film) */
export function watchRemote(l: (e: RemoteEvent) => void): () => void {
  install()
  listeners.push(l)
  return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1) }
}

function install() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('keydown', e => {
    // typing into a text field: only Escape and Enter belong to the TV layer
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && e.key !== 'Escape' && e.key !== 'Enter' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    const key = keyFromEvent(e)
    if (!key) return
    if (dispatch({ key, repeat: e.repeat, source: 'keyboard' })) e.preventDefault()
    else if (key === 'playpause' || key === 'up' || key === 'down') e.preventDefault()
  })
}
