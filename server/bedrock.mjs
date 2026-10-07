// Amazon Bedrock Converse API over plain fetch with a Bedrock API key.
// A Bedrock API key is sent as `Authorization: Bearer <key>`; it works for
// bedrock-runtime only (no SigV4, no other AWS services). In AWS Lambda the
// same call can run with the function role instead: see server/lambda.mjs.

export async function converse({ region, token, model, system, messages, toolConfig, inferenceConfig, timeoutMs = 25000 }) {
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/converse`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ system, messages, toolConfig, inferenceConfig }),
      signal: ctrl.signal,
    })
    const body = await r.text()
    if (!r.ok) {
      // never echo the request (it carries the key in a header, not the body, but be strict)
      const err = new Error(`Bedrock ${r.status}: ${body.slice(0, 300)}`)
      err.status = r.status === 429 ? 429 : 502
      throw err
    }
    return JSON.parse(body)
  } finally {
    clearTimeout(timer)
  }
}
