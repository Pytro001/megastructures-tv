// Megastructures TV API, port 8302 by default.
//   GET  /api/health          liveness
//   GET  /api/config          which voice mode and speech provider are on (no secrets)
//   POST /api/ask             { sim, question, chapter, chapters, controls, stats } -> { say, actions, source }
//   POST /api/tts             { text } -> audio/mpeg (only with TTS_PROVIDER=polly)
//   GET  /api/recordings/:key a recorded Bedrock answer, for deterministic films
// The same handler runs in AWS Lambda behind API Gateway (server/lambda.mjs, infra/template.yaml).
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { ask, RECORDINGS } from './ask.mjs'
import { synthesize, ttsConfig } from './tts.mjs'

export async function route(method, path, body, env = process.env) {
  if (method === 'GET' && path === '/api/health') return { status: 200, json: { ok: true } }
  if (method === 'GET' && path === '/api/config') {
    return { status: 200, json: {
      voiceMode: env.VOICE_MODE || (env.AWS_BEARER_TOKEN_BEDROCK ? 'ask' : 'mock'),
      bedrock: !!env.AWS_BEARER_TOKEN_BEDROCK,
      model: env.BEDROCK_CLAUDE_MODEL || null,
      tts: ttsConfig(env).provider,
    } }
  }
  if (method === 'POST' && path === '/api/ask') {
    const state = JSON.parse(body || '{}')
    return { status: 200, json: await ask(state, env) }
  }
  if (method === 'POST' && path === '/api/tts') {
    const { text } = JSON.parse(body || '{}')
    const out = await synthesize(text, env)
    return { status: 200, raw: out.body, type: out.contentType }
  }
  const m = path.match(/^\/api\/recordings\/([a-z0-9-]+)$/)
  if (method === 'GET' && m) {
    const f = RECORDINGS + m[1] + '.json'
    if (!existsSync(f)) return { status: 404, json: { error: 'no recording' } }
    return { status: 200, json: JSON.parse(readFileSync(f, 'utf8')) }
  }
  return { status: 404, json: { error: 'not found' } }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

export function start(port = Number(process.env.PORT) || 8302) {
  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return }
    let body = ''
    for await (const chunk of req) { body += chunk; if (body.length > 64 * 1024) { res.writeHead(413, CORS); res.end(); return } }
    const path = (req.url || '/').split('?')[0]
    const t0 = Date.now()
    try {
      const out = await route(req.method, path, body)
      if (out.raw) { res.writeHead(out.status, { ...CORS, 'content-type': out.type }); res.end(out.raw) }
      else { res.writeHead(out.status, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify(out.json)) }
      if (path === '/api/ask') console.log(`ask ${out.json.source} ${Date.now() - t0} ms: "${out.json.question}" -> ${out.json.actions.map(a => a.type === 'setParam' ? `${a.param}=${a.value}` : `chapter ${a.chapter}`).join(', ') || 'no change'}`)
    } catch (e) {
      const status = e.status || 500
      console.error(`${req.method} ${path} failed: ${e.message}`)
      res.writeHead(status, { ...CORS, 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
  })
  server.listen(port, '0.0.0.0', () => console.log(`Megastructures TV API on http://localhost:${port} (voice: ${process.env.VOICE_MODE || (process.env.AWS_BEARER_TOKEN_BEDROCK ? 'ask' : 'mock')}, tts: ${ttsConfig().provider})`))
  return server
}

if (import.meta.url === `file://${process.argv[1]}`) start()
