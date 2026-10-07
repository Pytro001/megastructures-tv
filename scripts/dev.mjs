// npm run dev: the API on 8302 and the TV app on 5302, together; Ctrl+C stops both
import { spawn } from 'node:child_process'
const root = new URL('..', import.meta.url).pathname
const procs = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.mjs'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'tv/vite.config.mjs'], { cwd: root, stdio: 'inherit' }),
]
console.log('Megastructures TV: open http://127.0.0.1:5302/ (add ?tv=1 for TV performance mode, ?debug=1 for the frame rate)')
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(0) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
for (const p of procs) p.on('exit', code => { if (code) { console.error('a process exited with', code); stop() } })
