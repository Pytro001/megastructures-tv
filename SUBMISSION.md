# Submission: Megastructures TV

Build, Ship, Shape: Amazon Developer Hackathon. Paste each block into the matching field. Placeholders: `[COUNTRY]`, `[REPO]`, `[ENGINE_REPO]`, `[VIDEO]`, `[DEMO]`.

## Basics

- **Project name:** Megastructures TV
- **Tagline (under 200 characters):** Interactive engineering films for Fire TV. Ask the remote "what if?" and Claude on Amazon Bedrock changes the live 3D simulation in front of your family.
- **Submitter type:** Individual
- **Country of residence:** [COUNTRY]
- **Track:** Fire TV
- **Mini challenges:** AWS Builder, Open Source
- **GitHub username:** Pytro001
- **Repository:** [REPO] (public, MIT license, license visible in the repo About)
- **Video (public, English, under 3 minutes):** [VIDEO]
- **Try it:** [DEMO] (or run locally: `npm install && npm run dev`, then open http://127.0.0.1:5302/)

## Is this a new project or an existing one?

Existing, significantly updated during the submission period.

**What existed before:** three interactive physics scenes as separate desktop browser pages with mouse controls: a tunnel boring machine boring under a street, Starship above the clouds, and a tsunami modelled on Tohoku 2011, plus their shared Three.js material and post processing code.

**What is new, built during the hackathon:**
1. A Fire OS app: an Android Studio project in Kotlin with the Leanback launcher, a full screen WebView with WebGL, a remote key bridge, Android `SpeechRecognizer` and `TextToSpeech`.
2. A 10 foot D-pad UI: a home row, a spatial focus engine, chapters on Left and Right, a settings drawer that reaches every control with five buttons, a 5% safe area and no text under 28 px.
3. Voice to simulation: an Ask overlay plus an answer service that sends the question and the live on screen state to Claude on Amazon Bedrock with three tools (`jumpToChapter`, `setParam`, `explain`). The tool calls are checked against the real ranges and then animate the live simulation. The answer is spoken and captioned.
4. A TV performance mode: dynamic resolution, no MSAA, smaller shadow maps, a fixed light budget, lower ray march steps and terrain detail, and a frame rate overlay. Measured at 1.6x to 3.2x the frame rate of desktop quality.
5. An open sourced engine: `megastructures-engine` (MIT), split out of the scenes, with a TV input kit, docs and an example.
6. The AWS path as code: a Lambda handler, an AWS SAM template (API Gateway, Lambda, S3, IAM) and an Amazon Polly adapter. Written, not deployed.

The video shows each of these, and ends with a "Built during the hackathon" card.

## About the project

### Inspiration

I make engineering simulations: a tunnel boring machine you can cut in half, Starship you can take apart, a tsunami you can try to stop. People watched them hundreds of thousands of times, almost always alone on a phone. The questions in the replies were always the same kind: what if it went faster, what if the wall were taller, what is inside. Those are living room questions. A family watching together on the big screen asks them out loud. So the TV should be able to answer by showing, not by reading out a paragraph.

### What it does

Megastructures TV is a Fire TV app of interactive engineering films. Pick a machine from the home row. Each film plays like a documentary, and Left and Right on the D-pad move between chapters. Press Menu on the remote and ask anything: "What happens if the screw turns faster?" Claude, running on Amazon Bedrock, jumps to the street above the tunnel and speeds up the screw conveyor. The chamber pressure drops and the street really sinks, with houses cracking, while the TV explains why out loud. Ask the tsunami "Can a wall stop it?" and the sea wall rises to 45 m and the city stays dry. Ask Starship "When does the top part come off?" and it plays hot staging. Every setting is also in a drawer you drive with five buttons.

### How I built it

- **Scenes:** Three.js and TypeScript, built with Vite. One page per film, so only one WebGL context is alive at a time on a TV stick with 1 to 2 GB of memory.
- **10 foot shell:** a small TV layer around each scene. A spatial focus engine moves between anything marked `data-focus`. A remote module turns keyboard keys, Fire TV web key codes and native bridge calls into one key stream. The shell has a settings drawer, an Ask overlay and an answer card. Everything is sized in 1080p units, so it looks the same on a 720p, 1080p or 4K panel.
- **Voice loop:** the page sends the question with a snapshot of the screen: the film, the current chapter, every control with its live range and value, and the readings. A Node service calls the Bedrock Converse API with three tools and `toolChoice: any`. Claude returns all its tool calls in one turn. The server drops anything that does not exist and clamps numbers into range. The page applies the chapter jump first, then animates each slider from the value the viewer last saw. The answer is spoken (speechSynthesis in the page, TextToSpeech in the Android shell, or Amazon Polly through an adapter) and captioned with the tool calls.
- **Fire OS shell:** Kotlin, a full screen WebView with the web build bundled in assets and served through `WebViewAssetLoader`. D-pad and Select reach the page as DOM key events. Back, Menu and the media keys go through `window.MegaTV.key()`. Voice goes through `SpeechRecognizer` and `window.MegaTV.onVoice()`.
- **TV performance mode:** a resolution governor aiming for 30 fps, MSAA off, shadow maps down to 1024, a fixed light count per light kind, half the ray march steps for clouds and engine plumes, and a quarter of the triangles for the tsunami terrain.
- **AWS:** Bedrock is used for real. The same request handler is wrapped for AWS Lambda behind API Gateway, with a SAM template that adds S3 and IAM for Bedrock and Polly.

### Challenges I ran into

- **The microphone button belongs to Alexa.** Amazon documents that the voice button on a Fire TV remote cannot be intercepted by apps. My whole idea was "press the mic and ask". I made Menu the Ask button, forwarded it from the native shell, and wrote it on screen so nobody has to guess.
- **Speech to text on Fire OS is not guaranteed.** I could not find whether third party apps get a speech recogniser. So the Ask overlay always offers three suggested questions you can pick with the D-pad, plus a typed field.
- **A phone GPU driving a TV.** The scenes were tuned for laptops. Starship went from 22 to 70 fps on my machine with TV mode, mostly from dropping MSAA and halving the ray march steps.
- **No hardware.** I have no Fire TV device and no Android toolchain on the build machine, so the Android project is written carefully but untested. Everything else is tested in a browser with the same keys a remote sends.
- **Making an AI change a simulation safely.** The model sometimes asks for values outside a range or names a chapter by its title. Sending the live ranges with every question, and validating every tool call on the server, made the changes reliable.

### Accomplishments that I'm proud of

- The AI does not chat about the film. It changes the film. You see the street sink because of your question.
- Five of five recorded questions came back from Bedrock as valid tool calls in one round trip, in 3.1 to 3.6 s.
- Every action in the app is reachable with Up, Down, Left, Right and Select.
- TV mode measured at 1.6x (tunnel boring machine), 3.2x (Starship) and 1.6x (tsunami) the frame rate at 1080p.

### What I learned

- On a TV, the input model is the product. Five buttons force every feature into a clear shape.
- Tool use is a good interface between a language model and a simulation. The simulation owns the physics and the ranges, the model only picks which knob to turn and explains it.
- Sending the screen state with each question removes most of what makes voice assistants feel lost.

### What's next

- Run on a Fire TV Stick 4K Max and tune the render budget on the device.
- Deploy the Lambda and API Gateway stack and switch speech to Amazon Polly.
- Stream tool calls (ConverseStream) so the scene starts moving before the explanation is finished.
- Port Fusion Power Plant, Particle Collider and Metal 3D Printer.
- A Vega OS build with the Vega WebView, once WebGL support there is confirmed.

### Built during the hackathon (required for existing projects)

Fire OS shell (Kotlin, Leanback, WebView, key bridge, SpeechRecognizer), 10 foot D-pad UI, voice to simulation through Amazon Bedrock tool use, TV performance mode, and the open source `megastructures-engine` package. The physics scenes existed before. See "Is this a new project or an existing one?" above for the full list.

### Limitations (honest)

- Not yet run on a Fire TV device or emulator. The Android project was written without a local Android toolchain and has not been compiled. Performance numbers are from a laptop GPU.
- Lambda, API Gateway, S3 and Polly are written as code and IaC and unit tested locally, but not deployed. Bedrock is the only AWS service called for real.
- The video replays real Bedrock answers that were recorded through the app the same day, so the film is exact. Live mode calls Bedrock for every question.
- Three of six films are live. The other three are "coming soon" tiles.
- The simulations are simplified models built on public figures, for explaining ideas.

## Built with

fire-tv, fire-os, android, kotlin, webview, leanback, three.js, webgl, typescript, vite, node.js, amazon-bedrock, claude, aws-lambda, amazon-api-gateway, amazon-polly, amazon-s3, aws-sam, web-speech-api

## AWS Builder mini challenge: AWS services used

- **Amazon Bedrock (used for real):** Claude Sonnet 4.5 (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`) through the Converse API with tool use. Three tools: `jumpToChapter`, `setParam`, `explain`, with `toolChoice: any`. Every answer in the video is a real Bedrock response recorded through the app.
- **AWS Lambda + Amazon API Gateway (written, not deployed):** `server/lambda.mjs` wraps the same request handler for an HTTP API, unit tested with a fake API Gateway event. `infra/template.yaml` (AWS SAM) defines the HTTP API, the function, IAM for Bedrock and Polly, and the Bedrock API key from Secrets Manager.
- **Amazon Polly (written, not run):** `server/tts.mjs` synthesizes the spoken answer with a neural voice when `TTS_PROVIDER=polly`. It needs SigV4 credentials, which I did not have while building.
- **Amazon S3 (written, not deployed):** a private bucket in the SAM template for the film catalog and posters, so new films can ship without an app update.

Why not deployed: the only credential available on the build machine was a Bedrock API key, which works only for Bedrock runtime. I chose to say so plainly rather than show a diagram as if it were running.

## Open Source mini challenge

- **Contribution URL:** [ENGINE_REPO] (`megastructures-engine`, also in `packages/megastructures-engine` of [REPO])
- **Repository URL:** [ENGINE_REPO]
- **GitHub username:** Pytro001
- **License:** MIT
- **What it does:** a small Three.js toolkit for documentary style engineering simulations that also run on a TV. It has lathe and pipe geometry, one physically based material with procedural detail and section caps for cutaways, a film look post pipeline (bloom, lens flare, grain, depth of field), a fixed light budget, labels pinned to 3D points, and a TV kit: Fire TV remote key handling, a spatial D-pad focus engine, a dynamic resolution governor, TV quality presets and a frame rate meter.
- **How it works:** TypeScript ES modules with `three` as a peer dependency, made for Vite or any bundler. Deep imports keep bundles small. An example (`example/`) shows a turned part under studio light with a D-pad menu, a frame rate meter and dynamic resolution.
- **Why it matters:** web developers can already reach every TV with a WebView, but most WebGL code assumes a mouse and a laptop GPU. This package collects the parts every TV 3D app needs (remote input, focus, a render budget, a frame rate check) next to the parts that make engineering explainers look good, so the next person does not start from zero.

## Product feedback (required)

### Fire TV developer documentation and tools
- **Used for:** remote key codes for web apps, remote input for Android apps, Leanback manifest requirements, and testing without a device.
- **What worked:** the web key code table is short and correct, and the D-pad arrives as ordinary arrow keys, so the whole UI could be built and tested with a laptop keyboard.
- **What needs work:** the voice button cannot be intercepted, and nothing offers an alternative for apps that want spoken input. Key handling is split across three pages (web apps, Android remote input, Vega WebView) with no single matrix of which keys reach JavaScript in each runtime. There is no Fire OS emulator image, only advice to use a stock Android TV image.
- **Onboarding:** finding the right platform (Fire OS or Vega) for a WebGL app took longer than it should have, because the Vega WebView guide does not say whether WebGL is supported.
- **Would I build on it again:** yes. Fire TV is the right screen for this kind of content.

### Vega OS and the Vega Virtual Device (researched, not used)
- **Used for:** deciding the platform.
- **What worked:** a WebView component, a clear SDK release note with the Chromium version, and a simulator that runs on Apple Silicon.
- **What needs work:** graphics support (WebGL 1 or 2, limits, expected performance) is not stated in the WebView guide. That alone made me pick Fire OS for a 3D app.

### Amazon Bedrock
- **Used for:** every voice answer: Claude Sonnet 4.5 with three tools through the Converse API, called with a Bedrock API key over plain `fetch`.
- **What worked:** it worked on the first call. Tool calls matched the schema every time in testing, Claude returned several tool calls in one turn, and a union type on one argument was accepted. No SDK was needed.
- **What needs work:** latency was 3.0 to 3.6 s per answer, which is long for a TV remote moment. Streaming tool use examples would help. The model id contains a colon and must be URL encoded in the path, which the examples could show.
- **Onboarding:** the Bedrock API key made the first call very easy. It was surprising that the same key cannot call Polly or Lambda.
- **Would I build on it again:** yes.

### AWS Lambda, Amazon API Gateway, AWS SAM
- **Used for:** the production path for the answer service (code and template written, not deployed).
- **What worked:** wrapping an existing Node request handler for an HTTP API event took a few lines, and the handler is unit tested locally.
- **What needs work:** I could not deploy with only a Bedrock API key. A scoped deploy credential for hackathons, or a sandbox account flow, would let builders show the full stack.

### Amazon Polly
- **Used for:** the spoken answer (adapter written, not run).
- **What needs work:** it needs SigV4 credentials, so it could not be tried with the Bedrock key. Polly through Bedrock, or a short lived Polly key, would let a voice app use one credential.

## Feature requests

**Critical**
1. A way for a foreground Fire TV app to receive the user's words from the remote's voice button, for example an opt in intent that hands the transcript to the app when Alexa does not handle the request itself.
2. A documented, guaranteed speech to text service for third party Fire OS apps (or an Alexa powered transcription API).

**Important**
3. One key matrix for Silk, Fire OS WebView wrappers and Vega WebView, including Back, Menu and media keys.
4. WebGL and GPU capability tables for each Fire TV device and for the Vega WebView.
5. A Fire OS emulator image (or the Amazon WebView build) for Android Studio, so WebGL apps can be checked before buying a device.
6. Streaming tool use samples for Bedrock Converse, aimed at voice UIs.

**Nice to have**
7. A hosted "wrap my web app for Fire TV" builder that outputs a signed APK, so web developers skip the Android toolchain.
8. Polly callable with a Bedrock API key.

## Friction log

See [FRICTION_LOG.md](FRICTION_LOG.md) in the repository: 12 entries from this build (task, steps, expected, actual, severity, workaround, suggestion) plus the Fire OS or Vega platform research.
