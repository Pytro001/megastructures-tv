// AWS Lambda entry for API Gateway (HTTP API, payload format 2.0). Same routes as
// the local server. Written and unit tested locally with a fake event; NOT deployed
// (no AWS SigV4 credentials were available while building). See infra/template.yaml.
//
// In Lambda the Bedrock call still uses AWS_BEARER_TOKEN_BEDROCK (a Bedrock API key
// stored in Secrets Manager and passed in as an environment variable by the template).
// Switching to the function's IAM role means replacing server/bedrock.mjs with the
// AWS SDK ConverseCommand; the request and response shapes are identical.
import { route } from './index.mjs'

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'
  const path = event.rawPath || event.path || '/'
  const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || ''
  const headers = { 'access-control-allow-origin': '*' }
  if (method === 'OPTIONS') return { statusCode: 204, headers: { ...headers, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' } }
  try {
    const out = await route(method, path, body)
    if (out.raw) return { statusCode: out.status, headers: { ...headers, 'content-type': out.type }, isBase64Encoded: true, body: Buffer.from(out.raw).toString('base64') }
    return { statusCode: out.status, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(out.json) }
  } catch (e) {
    return { statusCode: e.status || 500, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }
  }
}
