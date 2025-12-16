import axios from 'axios'
import type { TargetLanguage, ElevenLabsVoiceProfile } from './tts'

// Re-export type so consumers can import from this module directly
export type { ElevenLabsVoiceProfile } from './tts'

const ELEVEN_BASE_URL = 'https://api.elevenlabs.io/v1'
const ELEVEN_TTS_MODEL = 'eleven_flash_v2_5'
const ELEVEN_STS_MODEL = 'eleven_multilingual_sts_v2'

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.65,
  similarity_boost: 0.75,
  style: 0.0
}

export function normalizeTtsText(input: string): string {
  if (!input) return ''
  const cleanedBullets = input.replace(/[•\u2022]/g, ' ')
  const condensed = cleanedBullets.replace(/\s+/g, ' ').trim()
  // Collapse excessive punctuation that can degrade prosody
  return condensed
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/,{2,}/g, ',')
}

export async function synthesizeWithElevenLabs(
  text: string,
  voice: ElevenLabsVoiceProfile
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured')

  const payload: any = {
    text: normalizeTtsText(text),
    model_id: ELEVEN_TTS_MODEL,
    voice_settings: voice.voiceSettings || DEFAULT_VOICE_SETTINGS
  }

  try {
    const res = await axios.post(
      `${ELEVEN_BASE_URL}/text-to-speech/${voice.voiceId}/stream`,
      payload,
      {
        responseType: 'arraybuffer',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        }
      }
    )
    return Buffer.from(res.data)
  } catch (err: any) {
    const status = err?.response?.status
    const message = err?.response?.data || err?.message
    console.error('[ElevenLabs TTS] Error', status, message)
    throw new Error(`ElevenLabs TTS failed: ${status || ''} ${message || ''}`.trim())
  }
}

export async function transformSpeechWithElevenLabs(
  audio: Buffer,
  voice: ElevenLabsVoiceProfile
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured')

  const form = new FormData()
  form.append('model_id', ELEVEN_STS_MODEL)
  // Aggressive settings to force target voice timbre over source characteristics
  const aggressiveSettings = {
    stability: 0.9,
    similarity_boost: 1.0,
    style: 0.0,
    use_speaker_boost: true,
    ...(voice.voiceSettings || {})
  }
  form.append('voice_settings', JSON.stringify(aggressiveSettings))
  // Convert Buffer to ArrayBuffer (avoid SharedArrayBuffer issues)
  const outgoingBuffer = audio.byteLength === audio.buffer.byteLength
    ? audio.buffer
    : audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength)
  const audioArrayBuffer = outgoingBuffer instanceof ArrayBuffer
    ? outgoingBuffer
    : Uint8Array.from(audio).buffer
  form.append('audio', new Blob([audioArrayBuffer], { type: 'audio/wav' }), 'input.wav')

  const res = await fetch(`${ELEVEN_BASE_URL}/speech-to-speech/${voice.voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg'
    },
    body: form
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`ElevenLabs STS failed: ${res.status} ${res.statusText} ${text}`)
  }

  const respArrayBuffer = await res.arrayBuffer()
  return Buffer.from(respArrayBuffer)
}

