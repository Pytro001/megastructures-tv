# megastructures-engine

A small Three.js toolkit for documentary style engineering simulations that also run on a TV.

It is the engine under [Megastructures TV](../../README.md), a Fire TV app of interactive engineering films (a tunnel boring machine, Starship, a tsunami). It was split out and published under MIT during the Build, Ship, Shape Amazon Developer Hackathon.

## What is in it

| Module | What it does |
|---|---|
| `core/geometry` | Lathe style `revolve` with crease aware normals, rings, pipes along bent paths, bolt circles, splines, merges |
| `core/materials` | `surf()`: one physically based material with procedural detail (roughness and colour variation, bump, printed layer lines, turned finish, tints) and section caps when a model is cut open |
| `core/cut` | `CutState`: cut an assembly in half along a plane (or a wedge) with solid caps on the cut face |
| `core/noise` | Seeded random numbers, 3D noise texture and GLSL noise |
| `scene/studio-env` | `studioEnvironment()`: an image based studio light made of soft boxes, nearly free per pixel |
| `render/lens` | `FilmPipeline`: HDR layers, highlight clamp, bloom, a lens pass (flare, chromatic aberration, vignette, grain, fade to black) |
| `render/dof` | `DofPipeline`: the same look with a gather depth of field for a macro lens on a model |
| `render/budget` | `RenderBudget`: a fixed light count per light kind (no shader recompiles while you move) and a draw distance |
| `ui/labels` | Screen space labels pinned to 3D points |
| `tv/remote` | One `TvKey` stream from a keyboard, Fire TV remote key codes and a native host bridge |
| `tv/focus` | `FocusEngine`: spatial D-pad navigation over anything marked `data-focus` |
| `tv/quality` | TV performance mode: presets, `ResolutionGovernor` (dynamic resolution), `setShadowMapSize`, `capLights` |
| `tv/fps` | `FpsMeter`: fps, average and p95 frame time, draw calls, triangles, render size |
| `tv/sim` | `SimHandle`: the contract between a simulation and a TV shell (chapters, controls, tour state) |

## Use it

The package ships TypeScript source (ES modules) and expects a bundler such as Vite. `three` is a peer dependency.

```bash
npm i three megastructures-engine
```

```ts
import * as THREE from 'three'
import { FilmPipeline, studioEnvironment, revolve, surf, onRemote, FocusEngine, ResolutionGovernor, qualityFromUrl } from 'megastructures-engine'

const q = qualityFromUrl()                 // ?tv=1 gives the TV preset
const pipe = new FilmPipeline(canvas)
pipe.setSamples(q.samples)                  // 0 on a TV
const scene = new THREE.Scene()
scene.environment = studioEnvironment(pipe.renderer)
scene.add(new THREE.Mesh(revolve([[0, -1], [0.5, -1], [0.3, 1], [0, 1]]), surf({ color: 0xb8bcc2 })))
pipe.layers.layers = [{ scene, camera }]

onRemote(e => { if (e.key === 'select') { /* ... */ return true } })
const gov = new ResolutionGovernor(q, s => pipe.resize(innerWidth, innerHeight, s))
// every frame: gov.frame(frameMs); pipe.render(dt)
```

Deep imports keep bundles small: `import { surf } from 'megastructures-engine/core/materials'`.

## Example

`example/` is a turned part under studio light with three camera shots on a D-pad menu, a frame rate meter and dynamic resolution.

```bash
npx vite packages/megastructures-engine/example      # from the Megastructures TV repo root
# open the printed URL; add ?tv=1 for the TV preset; arrows and Enter drive the menu
```

## TV notes

- Fire TV web apps receive the D-pad as `keyCode` 37 to 40 and Select as 13; Play/Pause is 179, Rewind 227, Fast forward 228. Back arrives as Android `KEYCODE_BACK` through the host. Home, Menu and the voice button cannot be captured by a web page; a native shell can forward Menu (see `window.MegaTV.key` in the app).
- On a phone class GPU, turning off MSAA and lowering the render scale pay off first, then shadow map size, then the number of lights.

## Status and limits

- Version 0.1.0, extracted from a working app; the API may still change.
- `CutState` and `surf` were written for one family of scenes and assume metres and a Y up world.
- Not yet published to npm; the repository URL is a placeholder until the separate repo is pushed.

## License

MIT, see `LICENSE`.
