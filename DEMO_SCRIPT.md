# Megastructures TV: demo script

Screen film: `output/megastructures-tv-screen.mp4`, 1920x1080, 30 fps, 2:21.5, silent (your voice goes on top).
Recorded frame by frame in headless Chromium from the real app (`npm run film`). Every remote press in the film goes through the same bridge the Fire OS shell uses. Every answer is a real Claude on Amazon Bedrock response, recorded through the real UI earlier the same day and replayed so the film is exact. The thinking pause in the film is the real Bedrock latency of that answer (3.1 to 3.6 s).

The final video must stay under 3:00 (aim for 2:50). The screen film leaves about 25 s for two shots only you can film:
1. **Device or emulator shot (required by the rules):** the app running on a Fire TV Stick (phone filming the TV, or `adb exec-out screenrecord`) or on the Android TV emulator. Insert it at 2:11, before the "Built during the hackathon" card, about 12 s.
2. **Living room wide shot:** at the very end, about 6 s.

## Before the screen starts (to camera, about 10 s)

> I make engineering simulations. Millions of people watched them on their phones.
> I wanted them on the biggest screen in the house, where a family can ask questions.
> So I built Megastructures TV for Fire TV. Here it is.

## Timeline

| Time | On screen | You say |
|---|---|---|
| 0:00 | Tunnel boring machine on a bench, the street and houses above. Story panel, chapter name "The machine". | "What if your TV could answer why?" |
| 0:05 | The Menu button lights up on the on screen remote. The Ask overlay opens: "Listening". The words appear: "What happens if the screw turns faster?" | "I press Menu on the remote and ask." |
| 0:07 | "Asking Claude on Amazon Bedrock" for 3.5 s. | "Claude on Amazon Bedrock gets the question and everything on screen." |
| 0:11 | The film jumps to "The street". The screw conveyor goes from balanced to 190%. The answer card shows the two tool calls: `jumpToChapter The street`, `setParam Screw conveyor fast, 190%`. | "It jumps to the street and speeds up the screw." |
| 0:15 | The street sinks, the houses start to crack, the readings turn red. | "That is not a video. The AI just changed the simulation. The street is sinking." |
| 0:25 | Home row: Tunnel Boring Machine, Starship, Tsunami, Fusion Power Plant, Particle Collider, Metal 3D Printer. The backdrop follows the focus. | "Megastructures TV. Interactive engineering films for Fire TV." |
| 0:31 | Select on Fusion Power Plant: "coming to TV next". Back to Starship, Select. | "Three films are live today. Three more are coming." |
| 0:38 | Starship above the clouds, the tour playing. | "Every scene is live 3D, not a recording." |
| 0:42 | Right: "Cut in half". Right: "Tanks". Right: "33 engines". | "Left and right are chapters. Five buttons do everything." |
| 0:56 | Menu. "When does the top part come off?" | "Kids ask the best questions." |
| 1:02 | `jumpToChapter Hot staging`. The ship lights its engines while still attached and pushes off the booster. | "It finds the right chapter and plays it." |
| 1:16 | Tsunami: the wave comes over a 10 m sea wall and floods the city, 33 m run-up. | "This is Tohoku, 2011. The wave went over a 10 metre wall." |
| 1:21 | Menu. "Can a wall stop it?" | "So, can a wall stop it?" |
| 1:27 | `jumpToChapter The wall`, `setParam Sea wall 45.0 m`. The wall rises, run-up 0.0 m, the city stays dry. | "Claude raises the wall to 45 metres. The tool call is checked against the real range on screen, then the simulation runs it. Now the city stays dry." |
| 1:37 | OK opens the settings drawer. Down to Sea wall, Left six times: 45 m to 30 m. The wave comes over again. | "Every setting is in this drawer. Up, down, left, right, OK." |
| 1:48 | Card: how a question changes the film. Remote, Fire OS app, live 3D, answer service, Amazon Bedrock, three tools. | "The Fire OS app is a WebView shell in Kotlin. The scenes are Three.js. Questions go to Claude on Amazon Bedrock with three tools: jump to a chapter, set a parameter, explain. Lambda, API Gateway and Polly are written and ready to deploy." |
| 2:01 | Card: TV performance mode, fps before and after for each film. | "A TV stick has a phone GPU. TV mode drops multisampling, shrinks shadows, caps lights and scales resolution. Two to three times the frame rate." |
| 2:11 | *Your device or emulator shot goes here (cut in, about 12 s).* | "Here it is on Fire TV." |
| 2:11 | Card: Built during the hackathon. Fire OS shell, D-pad UI, voice to simulation, TV performance mode, open source engine. | "The simulations existed before. Everything you saw around them, I built for this hackathon." |
| 2:14 | Home row again, Tunnel Boring Machine in focus. Hold. | "And the engine is open source." |
| 2:21 | *Your living room wide shot.* | "Fire TV. Megastructures TV." |

Times from 2:11 on move by the length of the device shot you insert.

## Close (to camera, about 6 s)

> The simulations are real models with real numbers, and now your TV can explain them.
> Megastructures TV. Ask it anything.
