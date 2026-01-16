import axios from 'axios'
import * as fs from 'fs'
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

/**
 * Convert speech from audio file using ElevenLabs Speech-to-Speech (Voice Changer)
 * Used for enhancing raw video audio with consistent voice quality
 */
export async function speechToSpeechConvert(options: {
  inputAudioPath: string
  voiceId: string
  modelId?: string
}): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured')

  const { inputAudioPath, voiceId, modelId = process.env.ELEVENLABS_STS_MODEL_ID || ELEVEN_STS_MODEL } = options

  console.log(`[STS] Converting speech with ElevenLabs`)
  console.log(`[STS] Model: ${modelId}`)
  console.log(`[STS] Voice ID: ${voiceId}`)
  console.log(`[STS] Input: ${inputAudioPath}`)

  // Read audio file
  if (!fs.existsSync(inputAudioPath)) {
    throw new Error(`STS input file not found: ${inputAudioPath}`)
  }

  const audioBuffer = fs.readFileSync(inputAudioPath)
  console.log(`[STS] Read ${audioBuffer.length} bytes from input file`)

  // Prepare form data for STS
  const form = new FormData()
  form.append('model_id', modelId)
  
  // STS settings optimized for voice enhancement
  const stsSettings = {
    stability: 0.75,
    similarity_boost: 0.85,
    style: 0.0,
    use_speaker_boost: true
  }
  form.append('voice_settings', JSON.stringify(stsSettings))

  // Convert Buffer to ArrayBuffer for FormData
  const outgoingBuffer = audioBuffer.byteLength === audioBuffer.buffer.byteLength
    ? audioBuffer.buffer
    : audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength)
  const audioArrayBuffer = outgoingBuffer instanceof ArrayBuffer
    ? outgoingBuffer
    : Uint8Array.from(audioBuffer).buffer

  // Determine MIME type from file extension
  const mimeType = inputAudioPath.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'
  form.append('audio', new Blob([audioArrayBuffer], { type: mimeType }), 'input_audio')

  try {
    const res = await fetch(`${ELEVEN_BASE_URL}/speech-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        Accept: 'audio/mpeg'
      },
      body: form
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      console.error(`[STS] Failed: ${res.status} ${res.statusText}`, errorText)
      throw new Error(`ElevenLabs STS failed: ${res.status} ${res.statusText} ${errorText}`)
    }

    const respArrayBuffer = await res.arrayBuffer()
    const resultBuffer = Buffer.from(respArrayBuffer)
    console.log(`[STS] Converted ${resultBuffer.length} bytes`)

    return resultBuffer

  } catch (error: any) {
    console.error(`[STS] Conversion error:`, error.message || error)
    throw error
  }
}

