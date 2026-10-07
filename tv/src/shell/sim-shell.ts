import { onRemote, pressKey, type RemoteEvent, type TvKey } from 'megastructures-engine/tv/remote'
import { FocusEngine } from 'megastructures-engine/tv/focus'
import { FpsMeter } from 'megastructures-engine/tv/fps'
import { ResolutionGovernor, TV } from 'megastructures-engine/tv/quality'
import type { SimHandle, Control } from 'megastructures-engine/tv/sim'
import catalog from '../catalog.json'
import { FILM, TV_MODE, DEBUG, SHOW_REMOTE, link, store, stepCssAnimations } from './env'
import { listen, stopListening, askApi, apiConfig, voiceSource, type Answer, type Action } from './voice'
import { makeSpeaker, type Speaker } from './tts'
import { RemoteOverlay } from './remote-overlay'
import './tv.css'

/**
 * The 10 foot shell around one simulation.
 *
 *   Left / Right   previous / next chapter (the chapter name sits large at the bottom)
 *   Select / Down  open the settings drawer: Up / Down pick a row, Left / Right change it
 *   Up             show or hide the story panel
 *   Menu or Mic    ask a question (Menu on a Fire TV remote, whose mic button belongs to Alexa)
 *   Play / Pause   play or pause the guided tour
 *   Back           close what is open, then back to the home row
 */

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const sliderText = (c: Extract<Control, { kind: 'slider' }>) => c.fmt(c.get())
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

interface Tween { c: Extract<Control, { kind: 'slider' }>; from: number; to: number; t: number; dur: number; delay: number }

export interface Shell {
  tick(dt: number): void
  /** film and test hooks */
  api: ShellApi
}

export interface ShellApi {
  press(k: TvKey): void
  openAsk(listenNow?: boolean): void
  closeAsk(): void
  setTranscript(text: string, final?: boolean): void
  thinking(): void
  answer(a: Answer): void
  ask(question: string): Promise<Answer>
  state(): unknown
  time(): number
}

export function mountShell(h: SimHandle): Shell {
  const info = catalog.sims.find(s => s.id === h.id)!
  document.body.classList.add('tv-on')
  if (FILM) document.body.classList.add('tv-film')
  // ?clean=1: the picture only, for posters
  if (new URLSearchParams(location.search).get('clean') === '1') document.body.classList.add('tv-clean')
  const root = document.createElement('div')
  root.id = 'tv'
  root.innerHTML = `
    <div class="tv-safe">
      <div class="tv-status"><span class="tv-dot"></span><span class="tv-status-t"></span></div>
      <div class="tv-chapter">
        <div class="tv-ch-row"><span class="tv-arrow l">&#8249;</span><div class="tv-ch-name"></div><span class="tv-arrow r">&#8250;</span></div>
        <div class="tv-ch-dots"></div>
        <div class="tv-hints">
          <span><kbd>&#9664; &#9654;</kbd>Chapters</span>
          <span><kbd>OK</kbd>Settings</span>
          <span><kbd>&#9776;</kbd>Ask</span>
          <span><kbd>&#9199;</kbd><b class="tv-hint-tour">Tour</b></span>
          <span><kbd>&#8617;</kbd>Home</span>
        </div>
      </div>
      <div class="tv-answer"><div class="tv-q"></div><div class="tv-a"></div><div class="tv-tools"></div><div class="tv-src"></div></div>
      <div class="tv-toast"></div>
    </div>
    <aside class="tv-drawer"><div class="tv-drawer-in"><h2>${esc(info.title)}</h2><div class="tv-rows"></div><div class="tv-drawer-hint"><kbd>&#9650; &#9660;</kbd>pick &nbsp; <kbd>&#9664; &#9654;</kbd>change &nbsp; <kbd>&#8617;</kbd>close</div></div></aside>
    <div class="tv-ask"><div class="tv-ask-in">
      <div class="tv-mic"><span class="tv-ring"></span><span class="tv-ring b"></span><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4"/></svg></div>
      <div class="tv-ask-status"></div>
      <div class="tv-ask-text"></div>
      <div class="tv-ask-list"></div>
    </div></div>`
  document.body.appendChild(root)
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T
  const chName = $('.tv-ch-name'), dots = $('.tv-ch-dots'), status = $('.tv-status-t'), hintTour = $('.tv-hint-tour')
  const drawer = $('.tv-drawer'), rows = $('.tv-rows')
  const askEl = $('.tv-ask'), askStatus = $('.tv-ask-status'), askText = $('.tv-ask-text'), askList = $('.tv-ask-list')
  const ans = $('.tv-answer'), toast = $('.tv-toast')
  const fps = new FpsMeter(root, DEBUG, TV_MODE ? 'TV mode' : 'desktop quality')
  const remote = SHOW_REMOTE ? new RemoteOverlay(root) : null

  let T = 0 // shell time, s (film time in films)
  let idle = 0
  let lastIdx = -1
  let storyOn = true
  let speaker: Speaker = makeSpeaker('browser')
  void apiConfig().then(c => { if (c) speaker = makeSpeaker(c.tts) })

  /* ---------------- chapters ---------------- */
  dots.innerHTML = h.chapters.map((c, i) => `<i data-i="${i}"><b></b></i>`).join('')
  function syncChapter() {
    const i = h.index()
    if (i !== lastIdx) {
      lastIdx = i
      chName.textContent = h.chapters[i].tab
      chName.classList.remove('in'); void chName.offsetWidth; chName.classList.add('in')
      dots.querySelectorAll('i').forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i) })
    }
  }
  function syncStatus() {
    const a = h.isAuto()
    status.textContent = a ? 'Playing the tour' : 'Your turn'
    root.classList.toggle('tv-auto', a)
    hintTour.textContent = a ? 'Pause' : 'Play tour'
  }

  /* ---------------- settings drawer ---------------- */
  type Row = { id: string; kind: 'control'; c: Control } | { id: string; kind: 'toggle'; label: string; get: () => string; run: () => void } | { id: string; kind: 'link'; label: string; run: () => void }
  const extra: Row[] = [
    { id: 'x-story', kind: 'toggle', label: 'Story panel', get: () => (storyOn ? 'On' : 'Off'), run: () => setStory(!storyOn) },
    { id: 'x-tv', kind: 'toggle', label: 'TV performance mode', get: () => (TV_MODE ? 'On' : 'Off'), run: () => { store('tv', TV_MODE ? '0' : '1'); location.href = link(location.pathname.split('/').pop()!, { tv: TV_MODE ? '0' : '1' }) } },
    { id: 'x-fps', kind: 'toggle', label: 'Frame rate overlay', get: () => (fps.visible ? 'On' : 'Off'), run: () => { fps.toggle(); store('debug', fps.visible ? '1' : '0') } },
    { id: 'x-home', kind: 'link', label: 'Back to all films', run: () => goHome() },
  ]
  const allRows: Row[] = [...h.controls.map(c => ({ id: c.id, kind: 'control' as const, c })), ...extra]
  rows.innerHTML = allRows.map(r => {
    if (r.kind === 'control' && r.c.kind === 'slider') return `<div class="tv-row" data-focus data-id="${r.id}"><div class="tv-row-top"><span>${esc(r.c.label)}</span><b></b></div><div class="tv-bar"><i></i></div></div>`
    if (r.kind === 'control' && r.c.kind === 'seg') return `<div class="tv-row" data-focus data-id="${r.id}"><div class="tv-row-top"><span>${esc(r.c.label)}</span></div><div class="tv-seg">${r.c.options.map(([v, t]) => `<em data-v="${esc(v)}">${esc(t)}</em>`).join('')}</div></div>`
    if (r.kind === 'control') return `<div class="tv-row tv-btn" data-focus data-id="${r.id}"><div class="tv-row-top"><span>${esc(r.c.label || 'Action')}</span><b></b></div></div>`
    return `<div class="tv-row tv-btn ${r.kind === 'link' ? 'tv-link' : ''}" data-focus data-id="${r.id}"><div class="tv-row-top"><span>${esc(r.label)}</span><b></b></div></div>`
  }).join('')
  // the drawer scrolls so the focused row is never cut off
  const focus = new FocusEngine(rows, { onFocus: el => {
    const top = el.offsetTop, bottom = top + el.offsetHeight // rows is the offsetParent
    const pad = el.offsetHeight * 0.6
    if (top - pad < rows.scrollTop) rows.scrollTop = Math.max(0, top - pad)
    else if (bottom + pad > rows.scrollTop + rows.clientHeight) rows.scrollTop = bottom + pad - rows.clientHeight
  } })
  const rowOf = (el: HTMLElement | null) => allRows.find(r => r.id === el?.dataset.id)
  function syncDrawer() {
    for (const r of allRows) {
      const el = rows.querySelector<HTMLElement>(`[data-id="${r.id}"]`)!
      if (r.kind === 'control') {
        const c = r.c
        if (c.kind === 'slider') {
          el.querySelector('b')!.textContent = sliderText(c)
          ;(el.querySelector('.tv-bar i') as HTMLElement).style.width = `${(((c.get() - c.min) / (c.max - c.min)) * 100).toFixed(1)}%`
        } else if (c.kind === 'seg') {
          const v = c.get()
          el.querySelectorAll<HTMLElement>('em').forEach(e => e.classList.toggle('on', e.dataset.v === v))
        } else {
          el.querySelector('b')!.textContent = typeof c.text === 'function' ? c.text() : c.text
        }
      } else if (r.kind === 'toggle') el.querySelector('b')!.textContent = r.get()
      else el.querySelector('b')!.textContent = 'OK'
    }
  }
  function adjust(dir: -1 | 1, repeat: boolean) {
    const r = rowOf(focus.current)
    if (!r) return
    if (r.kind !== 'control') { if (r.kind === 'toggle') r.run(); syncDrawer(); return }
    const c = r.c
    h.setAuto(false)
    if (c.kind === 'slider') {
      const stepK = (c.max - c.min) / (repeat ? 12 : 20)
      const v = Math.min(c.max, Math.max(c.min, c.get() + dir * stepK))
      c.set(Math.round(v / c.step) * c.step)
    } else if (c.kind === 'seg') {
      const i = c.options.findIndex(o => o[0] === c.get())
      c.set(c.options[(i + dir + c.options.length) % c.options.length][0])
    } else c.run()
    syncDrawer(); syncStatus()
  }
  const openDrawer = (on: boolean) => { root.classList.toggle('tv-drawer-open', on); if (on) { focus.refresh(); syncDrawer() } }
  const drawerOpen = () => root.classList.contains('tv-drawer-open')

  /* ---------------- story panel ---------------- */
  function setStory(on: boolean) { storyOn = on; document.body.classList.toggle('tv-story-off', !on) }

  /* ---------------- ask ---------------- */
  let askOpen = false
  let askFocus: FocusEngine | null = null
  let pending = 0
  function renderSuggestions() {
    const sug = (info as { suggest?: string[] }).suggest ?? []
    askList.innerHTML = sug.map(s => `<button class="tv-chip" data-focus data-q="${esc(s)}">${esc(s)}</button>`).join('') +
      `<label class="tv-chip tv-type" data-focus><input class="tv-input" placeholder="Type a question" maxlength="200" /></label>`
    askFocus = new FocusEngine(askList, { onSelect: el => {
      if (el.dataset.q) submit(el.dataset.q)
      else { const inp = el.querySelector('input')!; inp.focus() }
    } })
    const inp = askList.querySelector('input')!
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); e.stopPropagation(); submit(inp.value.trim()); inp.blur() } if (e.key === 'Escape') inp.blur() })
  }
  function openAsk(listenNow = true) {
    askOpen = true
    openDrawer(false)
    // the film holds while someone asks, like pausing a video to talk
    h.setAuto(false)
    root.classList.add('tv-ask-open')
    askEl.classList.remove('thinking', 'error')
    askText.textContent = ''
    renderSuggestions()
    hideAnswer()
    speaker.cancel()
    if (!listenNow || FILM) { askStatus.textContent = 'Listening'; askEl.classList.add('listening'); return }
    const src = listen({
      partial: t => setTranscript(t),
      final: t => { setTranscript(t, true); if (t) submit(t) },
      error: msg => { askEl.classList.remove('listening'); askStatus.textContent = msg === 'not-allowed' ? 'Microphone blocked. Pick a question or type one' : msg === 'unavailable' ? 'No speech recogniser on this device. Pick a question or type one' : 'Did not catch that. Pick a question or type one' },
    })
    if (src === 'none') { askStatus.textContent = 'Pick a question or type one'; askEl.classList.remove('listening') }
    else { askStatus.textContent = 'Listening'; askEl.classList.add('listening') }
  }
  function closeAsk() { askOpen = false; root.classList.remove('tv-ask-open'); stopListening() }
  function setTranscript(text: string, final = false) { askText.textContent = text ? `“${text}”` : ''; askText.classList.toggle('final', final) }
  function thinking() { askEl.classList.remove('listening'); askEl.classList.add('thinking'); askStatus.textContent = 'Asking Claude on Amazon Bedrock' }
  function snapshot(question: string) {
    const i = h.index()
    return {
      sim: h.id, question, chapter: h.chapters[i].id,
      chapters: h.chapters.map(c => ({ id: c.id, tab: c.tab, kicker: c.kicker })),
      controls: h.controls.map(c => c.kind === 'slider' ? { id: c.id, kind: c.kind, label: c.label, min: c.min, max: c.max, step: c.step, value: c.get(), display: c.fmt(c.get()) }
        : c.kind === 'seg' ? { id: c.id, kind: c.kind, label: c.label, options: c.options, value: c.get() }
        : { id: c.id, kind: c.kind, label: c.label || c.id }),
      stats: h.stats(),
    }
  }
  async function submit(question: string) {
    stopListening()
    setTranscript(question, true)
    thinking()
    const my = ++pending
    try {
      const a = await askApi(snapshot(question))
      if (my !== pending) return a
      answer(a)
      return a
    } catch (e) {
      askEl.classList.remove('thinking'); askEl.classList.add('error')
      askStatus.textContent = 'The answer service is not reachable. Is the server on port 8302 running?'
      throw e
    }
  }

  /* ---------------- answers drive the sim ---------------- */
  const tweens: Tween[] = []
  let ansT = -1, ansHold = 0
  function hideAnswer() { ans.classList.remove('on'); root.classList.remove('tv-answering'); ansT = -1 }
  function describe(a: Action) {
    if (a.type === 'jumpToChapter') return `<span class="tv-tool"><code>jumpToChapter</code>${esc(a.label ?? a.chapter ?? '')}</span>`
    const c = h.controls.find(x => x.id === a.param)
    const v = c?.kind === 'slider' ? c.fmt(Number(a.value)) : a.display ?? String(a.value)
    return `<span class="tv-tool"><code>setParam</code>${esc(a.label ?? a.param ?? '')} <b>${esc(v === 'run' ? 'go' : v)}</b></span>`
  }
  function apply(a: Action, delay: number) {
    if (a.sim !== h.id) return
    if (a.type === 'jumpToChapter') {
      const i = h.chapters.findIndex(c => c.id === a.chapter)
      if (i >= 0) h.go(i, true)
      return
    }
    const c = h.controls.find(x => x.id === a.param)
    if (!c) return
    h.setAuto(false)
    if (c.kind === 'slider') tweens.push({ c, from: c.get(), to: Number(a.value), t: 0, dur: 1.8, delay })
    else if (c.kind === 'seg') c.set(String(a.value))
    else c.run()
  }
  function answer(a: Answer) {
    closeAsk()
    askEl.classList.remove('thinking')
    // what the viewer saw before the answer: a slider moves from there, even if the jump reset it
    const seen = new Map(h.controls.filter(c => c.kind === 'slider').map(c => [c.id, (c as Extract<Control, { kind: 'slider' }>).get()]))
    // jumps first, then each change after a beat so the eye can follow it
    let d = 0.5
    for (const act of a.actions) if (act.type === 'jumpToChapter') apply(act, 0)
    for (const act of a.actions) {
      if (act.type !== 'setParam') continue
      const c = h.controls.find(x => x.id === act.param)
      if (c?.kind === 'slider' && seen.has(c.id)) c.set(seen.get(c.id)!)
      apply(act, d); d += 0.7
    }
    for (const tw of tweens) tw.from = tw.c.get()
    ;($('.tv-q') as HTMLElement).textContent = `“${a.question}”`
    ;($('.tv-a') as HTMLElement).textContent = a.say
    ;($('.tv-tools') as HTMLElement).innerHTML = a.actions.map(describe).join('')
    const src = a.source === 'bedrock' ? `Claude on Amazon Bedrock${a.latencyMs ? `, ${(a.latencyMs / 1000).toFixed(1)} s` : ''}` : a.source === 'replay' ? 'Recorded Claude on Amazon Bedrock answer, replayed' : 'Offline keyword rules (no AI)'
    ;($('.tv-src') as HTMLElement).textContent = src
    ans.classList.add('on')
    root.classList.add('tv-answering')
    ansT = 0
    ansHold = 4 + a.say.split(/\s+/).length * 0.22
    syncStatus()
    if (!FILM) void speaker.speak(a.say)
  }

  /* ---------------- navigation ---------------- */
  function goHome() { location.href = link('index.html', { focus: h.id }) }
  function showToast(t: string) { toast.textContent = t; toast.classList.remove('on'); void toast.offsetWidth; toast.classList.add('on') }
  let woke = false
  onRemote((e: RemoteEvent) => {
    idle = 0
    root.classList.remove('tv-idle')
    if (!woke) { woke = true; h.wake?.() }
    const k = e.key
    if (askOpen) {
      if (k === 'back') { closeAsk(); return true }
      if (k === 'menu' || k === 'mic') { openAsk(true); return true }
      if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { askFocus?.move(k); return true }
      if (k === 'select') { askFocus?.select(); return true }
      return true
    }
    if (drawerOpen()) {
      if (k === 'back') { openDrawer(false); return true }
      if (k === 'up' || k === 'down') { focus.move(k); return true }
      if (k === 'left' || k === 'right') { adjust(k === 'left' ? -1 : 1, e.repeat); return true }
      if (k === 'select') { const r = rowOf(focus.current); if (r?.kind === 'control') adjust(1, false); else r?.run(); syncDrawer(); return true }
      if (k === 'playpause') { h.setAuto(!h.isAuto()); syncStatus(); return true }
      if (k === 'menu' || k === 'mic') { openAsk(true); return true }
      return true
    }
    switch (k) {
      case 'left': h.go(h.index() - 1); return true
      case 'right': h.go(h.index() + 1); return true
      case 'select': case 'down': openDrawer(true); return true
      case 'up': setStory(!storyOn); return true
      case 'menu': case 'mic': openAsk(true); return true
      case 'playpause': h.setAuto(!h.isAuto()); syncStatus(); showToast(h.isAuto() ? 'Playing the tour' : 'Paused, your turn'); return true
      case 'rewind': h.go(h.index() - 1); return true
      case 'forward': h.go(h.index() + 1); return true
      case 'back': if (ans.classList.contains('on')) { hideAnswer(); return true } goHome(); return true
    }
    return false
  })

  /* ---------------- performance ---------------- */
  const gov = TV_MODE && !FILM ? new ResolutionGovernor(TV, s => h.setScale(s), TV.maxScale) : null
  let lastNow = 0

  /* ---------------- per frame ---------------- */
  let syncT = 0
  function tick(dt: number) {
    T += dt
    const now = FILM ? T * 1000 : performance.now()
    if (gov && lastNow) gov.frame(now - lastNow)
    lastNow = now
    fps.frame(now, h.renderer, h.getScale())
    if (FILM) stepCssAnimations(dt)
    remote?.tick(dt)
    syncChapter()
    // the tour's progress inside the current chapter
    const cur = dots.querySelector<HTMLElement>('i.on b')
    if (cur) cur.style.width = `${(h.isAuto() ? h.progress?.() ?? 0 : 1) * 100}%`
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]
      if (tw.delay > 0) { tw.delay -= dt; continue }
      tw.t += dt
      const u = Math.min(1, tw.t / tw.dur)
      tw.c.set(tw.from + (tw.to - tw.from) * ease(u))
      if (u >= 1) tweens.splice(i, 1)
    }
    if (ansT >= 0) { ansT += dt; if (ansT > ansHold) hideAnswer() }
    idle += dt
    if (idle > 6 && h.isAuto() && !askOpen && !drawerOpen()) root.classList.add('tv-idle')
    syncT += dt
    if (syncT > 0.2) { syncT = 0; syncStatus(); if (drawerOpen()) syncDrawer() }
  }
  syncChapter(); syncStatus()
  if (voiceSource() === 'none' && !FILM) document.body.classList.add('tv-no-speech')

  const api: ShellApi = {
    press: k => { pressKey(k, 'script') },
    openAsk, closeAsk, setTranscript, thinking, answer,
    ask: submit as (q: string) => Promise<Answer>,
    state: () => snapshot(''),
    time: () => T,
  }
  ;(window as unknown as { __tv: ShellApi }).__tv = api
  // for scripts/perf.mjs: what the frame rate overlay measures, without showing it
  ;(window as unknown as { __perf: () => unknown }).__perf = () => ({ ...fps.stats, scale: h.getScale(), tv: TV_MODE })
  return { tick, api }
}
