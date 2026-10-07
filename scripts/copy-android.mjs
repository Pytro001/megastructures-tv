// copies the web build (dist/) into the Android shell's assets so the APK runs offline
import { cpSync, rmSync, existsSync } from 'node:fs'
const root = new URL('..', import.meta.url).pathname
const dest = root + 'android/app/src/main/assets/www'
if (!existsSync(root + 'dist/index.html')) throw new Error('run vite build first')
rmSync(dest, { recursive: true, force: true })
cpSync(root + 'dist', dest, { recursive: true })
console.log('copied dist to', dest)
