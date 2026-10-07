import type * as THREE from 'three'
import type { TvQuality } from './quality'

/**
 * The contract between a simulation and a TV shell.
 *
 * A simulation owns its scene, its chapters (a guided tour that plays
 * itself) and a list of controls. The shell owns the screen around it: the
 * chapter title, the settings drawer, voice, captions. Neither reaches into
 * the other; everything goes through this handle.
 */

export type Control =
  | { kind: 'seg'; id: string; label: string; options: [string, string][]; get: () => string; set: (v: string) => void }
  | { kind: 'slider'; id: string; label: string; min: number; max: number; step: number; get: () => number; set: (v: number) => void; fmt: (v: number) => string }
  | { kind: 'button'; id: string; label: string; text: string | (() => string); run: () => void }

export interface ChapterInfo { id: string; tab: string; kicker: string; length: number }

export interface Stat { k: string; v: string; u?: string; c?: string }

export interface SimHandle {
  /** short id used by voice tools and URLs: 'tbm', 'starship', 'tsunami' */
  id: string
  title: string
  chapters: ChapterInfo[]
  controls: Control[]
  index(): number
  /** jump to a chapter; with manual=true the tour stops and the chapter is shown at its key moment */
  go(i: number, manual?: boolean): void
  isAuto(): boolean
  setAuto(on: boolean): void
  /** what the current chapter says and measures right now */
  text(): string
  kicker(): string
  stats(): Stat[]
  renderer: THREE.WebGLRenderer
  /** apply a quality preset once at start */
  quality: TvQuality
  /** the live resolution scale (dynamic resolution writes it) */
  setScale(s: number): void
  getScale(): number
  /** 0..1 through the current chapter of the tour */
  progress?(): number
  /** the first remote key: a chance to start audio, which browsers only allow after a user gesture */
  wake?(): void
}

/** per frame hooks a shell can register; a sim calls them from its own loop so films stay frame exact */
export interface ShellHooks {
  /** after the sim drew a frame; dt in seconds, now in ms of wall time (or film time) */
  tick(dt: number, now: number): void
}
