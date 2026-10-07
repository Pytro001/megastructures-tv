// One place to start headless Chromium for the perf, poster, smoke and film scripts.
// Uses Playwright's own Chromium when it is installed, otherwise the installed Google Chrome
// (headless, a fresh temporary profile, never the user's own profile).
import { existsSync } from 'node:fs'
const PW = process.env.PLAYWRIGHT_MODULE || '/Users/pytro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
export const { chromium } = await import(PW)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const GL_ARGS = ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
export async function launch(extra = []) {
  const args = [...GL_ARGS, ...extra]
  try { return await chromium.launch({ headless: true, args }) } catch (e) {
    if (!existsSync(CHROME)) throw e
    return chromium.launch({ headless: true, executablePath: CHROME, args })
  }
}
