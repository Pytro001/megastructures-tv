/**
 * megastructures-engine: a small Three.js toolkit for documentary style
 * engineering simulations that also run on a TV.
 *
 * Deep imports work too (`megastructures-engine/core/materials`), which keeps
 * bundles small: import only what a scene uses.
 */
export * from './core/cut'
export * from './core/materials'
export * from './core/geometry'
export * from './core/noise'
export { makeConsole, makeStudioBay, type ConsoleOpts, type DisplayKit } from './core/studio'
export { canvasTex, normalTex, Particles, Route } from './core/diorama'
export { studioEnvironment } from './scene/studio-env'
export { LAYER_GLOW } from './render/layers'
export { RenderBudget, DRAW, LIGHTS, type LightCaps } from './render/budget'
export { compileNear } from './render/warmup'
export { Pipeline as FilmPipeline, LayerPass, LensPass, ClampPass } from './render/lens'
export { Pipeline as DofPipeline } from './render/dof'
export { Labels, type LabelDef } from './ui/labels'
export * from './tv/remote'
export * from './tv/focus'
export * from './tv/quality'
export { FpsMeter } from './tv/fps'
export type { SimHandle, Control, ChapterInfo, Stat, ShellHooks } from './tv/sim'
