// Text to speech adapters. The default speaks in the page with the browser's
// speechSynthesis (the server does nothing). TTS_PROVIDER=polly turns on
// Amazon Polly behind POST /api/tts; it needs AWS SigV4 credentials (an IAM
// user or role allowed polly:SynthesizeSpeech) and `npm i @aws-sdk/client-polly`.
// A Bedrock API key cannot call Polly. This adapter was written but has not run
// against AWS from this machine (no SigV4 credentials were available).

export function ttsConfig(env = process.env) {
  return { provider: env.TTS_PROVIDER === 'polly' ? 'polly' : 'browser', voice: env.POLLY_VOICE || 'Joanna' }
}

/** returns { contentType, body } with MP3 audio, or throws with a status */
export async function synthesize(text, env = process.env) {
  const cfg = ttsConfig(env)
  if (cfg.provider !== 'polly') throw Object.assign(new Error('TTS_PROVIDER is browser: the page speaks with speechSynthesis'), { status: 404 })
  let sdk
  try { sdk = await import('@aws-sdk/client-polly') } catch {
    throw Object.assign(new Error('Polly adapter needs `npm i @aws-sdk/client-polly` and AWS credentials'), { status: 501 })
  }
  const client = new sdk.PollyClient({ region: env.AWS_REGION || 'us-east-1' })
  const out = await client.send(new sdk.SynthesizeSpeechCommand({
    Text: String(text).slice(0, 600), OutputFormat: 'mp3', VoiceId: cfg.voice, Engine: 'neural',
  }))
  const body = Buffer.from(await out.AudioStream.transformToByteArray())
  return { contentType: 'audio/mpeg', body }
}
