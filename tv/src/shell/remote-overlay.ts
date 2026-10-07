import { watchRemote, type TvKey } from 'megastructures-engine/tv/remote'

/**
 * An on screen Fire TV style remote that lights the button just pressed, with
 * the button's meaning written beside it. Shown in films and with ?remote=1 so
 * a viewer can follow what the hand on the real remote is doing.
 */
const NAMES: Record<TvKey, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', select: 'Select', back: 'Back',
  menu: 'Menu: ask', playpause: 'Play / pause', mic: 'Ask', rewind: 'Rewind', forward: 'Forward',
}

const SVG = `
<svg viewBox="0 0 160 470" aria-hidden="true">
  <defs>
    <linearGradient id="rb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2a2d33"/><stop offset="1" stop-color="#17191d"/></linearGradient>
  </defs>
  <rect x="8" y="4" width="144" height="462" rx="62" fill="url(#rb)" stroke="#3a3e46" stroke-width="2"/>
  <circle class="k" data-k="mic" cx="80" cy="66" r="21"/>
  <path d="M80 54a6 6 0 0 1 6 6v8a6 6 0 0 1-12 0v-8a6 6 0 0 1 6-6zM70 68a10 10 0 0 0 20 0M80 78v6" fill="none" stroke="#9fb3c8" stroke-width="2.4" stroke-linecap="round" class="g"/>
  <circle cx="80" cy="170" r="58" fill="#202328" stroke="#3a3e46" stroke-width="2"/>
  <path class="k" data-k="up" d="M51 128a58 58 0 0 1 58 0l-12 20a34 34 0 0 0-34 0z"/>
  <path class="k" data-k="down" d="M51 212a58 58 0 0 0 58 0l-12-20a34 34 0 0 1-34 0z"/>
  <path class="k" data-k="left" d="M38 141a58 58 0 0 0 0 58l20-12a34 34 0 0 1 0-34z"/>
  <path class="k" data-k="right" d="M122 141a58 58 0 0 1 0 58l-20-12a34 34 0 0 0 0-34z"/>
  <circle class="k" data-k="select" cx="80" cy="170" r="27"/>
  <circle class="k" data-k="back" cx="38" cy="270" r="17"/>
  <path d="M44 270h-12m0 0l5-5m-5 5l5 5" fill="none" stroke="#c9d3df" stroke-width="2.4" stroke-linecap="round" class="g"/>
  <circle class="k" data-k="home" cx="80" cy="270" r="17"/>
  <path d="M72 272l8-7 8 7v7h-16z" fill="none" stroke="#c9d3df" stroke-width="2.2" stroke-linejoin="round" class="g"/>
  <circle class="k" data-k="menu" cx="122" cy="270" r="17"/>
  <path d="M114 264h16M114 270h16M114 276h16" stroke="#c9d3df" stroke-width="2.4" stroke-linecap="round" class="g"/>
  <circle class="k" data-k="rewind" cx="38" cy="322" r="17"/>
  <path d="M44 316v12l-7-6zM37 316v12l-7-6z" fill="#c9d3df" class="g"/>
  <circle class="k" data-k="playpause" cx="80" cy="322" r="17"/>
  <path d="M73 315v14l8-7zM84 315v14M89 315v14" fill="#c9d3df" stroke="#c9d3df" stroke-width="2.2" class="g"/>
  <circle class="k" data-k="forward" cx="122" cy="322" r="17"/>
  <path d="M116 316v12l7-6zM123 316v12l7-6z" fill="#c9d3df" class="g"/>
  <rect x="62" y="364" width="36" height="58" rx="18" fill="#202328" stroke="#3a3e46" stroke-width="2"/>
  <path d="M74 380h12M80 374v12M74 408h12" stroke="#6c7480" stroke-width="2.4" stroke-linecap="round"/>
</svg>`

export class RemoteOverlay {
  readonly el: HTMLDivElement
  private label: HTMLDivElement
  private timer = 0
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div')
    this.el.className = 'tv-remote'
    this.el.innerHTML = SVG + '<div class="tv-remote-label"></div>'
    this.label = this.el.querySelector('.tv-remote-label')!
    parent.appendChild(this.el)
    watchRemote(e => this.flash(e.key))
  }
  /** light a button; `hold` keeps it lit (a long press on the ask button while speaking) */
  flash(key: TvKey, hold = false) {
    const b = this.el.querySelector<SVGElement>(`[data-k="${key}"]`)
    this.el.querySelectorAll('.lit').forEach(x => x.classList.remove('lit'))
    if (!b) return
    // restart the transition so the same button can flash twice in a row
    void (b as unknown as HTMLElement).getBoundingClientRect()
    b.classList.add('lit')
    this.label.textContent = NAMES[key]
    this.label.classList.add('on')
    this.el.classList.add('active')
    this.timer = hold ? Infinity : 0.9
  }
  release() { this.timer = Math.min(this.timer, 0.2) }
  tick(dt: number) {
    if (this.timer === Infinity) return
    this.timer -= dt
    if (this.timer <= 0 && this.el.classList.contains('active')) {
      this.el.querySelectorAll('.lit').forEach(x => x.classList.remove('lit'))
      this.label.classList.remove('on')
      this.el.classList.remove('active')
    }
  }
}
