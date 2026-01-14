import type { SupabaseClient } from '@supabase/supabase-js'

export type TargetLanguage = 'en-US' | 'es-ES' | 'es-MX'

export interface ElevenLabsVoiceProfile {
  voiceId: string
  languageCode: TargetLanguage
  voiceSettings?: Record<string, any>
}

export interface AvatarVoiceMeta {
  gender: string | null
  age_style: string | null
  default_voice_id: string | null
}

interface AvatarVoiceProfileRow {
  voice_id: string
  voice_settings: Record<string, any> | null
}

export function normalizeGender(raw: string | null): 'Hombre' | 'Mujer' | null {
  if (!raw) return null
  const cleaned = raw.trim().toLowerCase()
  if (cleaned === 'hombre' || cleaned === 'male' || cleaned === 'masculino') return 'Hombre'
  if (cleaned === 'mujer' || cleaned === 'female' || cleaned === 'femenino') return 'Mujer'
  return null
}

export function normalizeTargetLanguage(lang: string | null | undefined): TargetLanguage {
  const normalized = (lang || '').toLowerCase().trim()
  if (normalized === 'en-us' || normalized === 'en') return 'en-US'
  if (normalized === 'es-es') return 'es-ES'
  if (normalized === 'es-mx' || normalized === 'es') return 'es-MX'
  // Default to Spanish Mexico if not specified
  return 'es-MX'
}

// Helper function to get the base language code (for TTS voice selection)
export function getBaseLanguage(targetLanguage: TargetLanguage): 'en' | 'es' {
  return targetLanguage === 'en-US' ? 'en' : 'es'
}

// Helper function to get human-readable language label with accent
export function getLanguageLabel(targetLanguage: TargetLanguage): { language: string; accent: string; full: string } {
  switch (targetLanguage) {
    case 'en-US':
      return { 
        language: 'English', 
        accent: 'American accent',
        full: 'English with American accent'
      }
    case 'es-ES':
      return { 
        language: 'Spanish', 
        accent: 'Spanish accent from Madrid',
        full: 'Spanish with Spanish accent from Madrid'
      }
    case 'es-MX':
      return { 
        language: 'Spanish', 
        accent: 'Mexican accent',
        full: 'Spanish with Mexican accent'
      }
  }
}

const DEFAULT_VOICES: Record<
  'en' | 'es',
  { neutral?: string; male?: string; female?: string }
> = {
  en: {
    neutral: process.env.ELEVENLABS_DEFAULT_VOICE_EN,
    male: process.env.ELEVENLABS_DEFAULT_VOICE_EN_MALE || process.env.ELEVENLABS_DEFAULT_VOICE_EN,
    female:
      process.env.ELEVENLABS_DEFAULT_VOICE_EN_FEMALE || process.env.ELEVENLABS_DEFAULT_VOICE_EN
  },
  es: {
    neutral: process.env.ELEVENLABS_DEFAULT_VOICE_ES,
    male: process.env.ELEVENLABS_DEFAULT_VOICE_ES_MALE || process.env.ELEVENLABS_DEFAULT_VOICE_ES,
    female:
      process.env.ELEVENLABS_DEFAULT_VOICE_ES_FEMALE || process.env.ELEVENLABS_DEFAULT_VOICE_ES
  }
}

export async function getAvatarVoiceForLanguage(
  supabase: SupabaseClient,
  avatarId: string | null,
  targetLanguage: TargetLanguage,
  meta?: AvatarVoiceMeta
): Promise<ElevenLabsVoiceProfile> {
  // For voice profile lookup, we use the base language (en or es)
  const baseLanguage = getBaseLanguage(targetLanguage)
  
  if (avatarId) {
    const { data, error } = await supabase
      .from('avatar_voice_profiles')
      .select('voice_id, voice_settings')
      .eq('avatar_id', avatarId)
      .eq('language_code', baseLanguage)
      .limit(1)

    if (error) {
      console.warn('[TTS] avatar_voice_profiles lookup failed:', error.message)
    }

    const match: AvatarVoiceProfileRow | undefined = data?.[0]
    if (match?.voice_id) {
      return {
        voiceId: match.voice_id,
        languageCode: targetLanguage,
        voiceSettings: match.voice_settings || undefined
      }
    }
  }

  const gender = normalizeGender(meta?.gender || null)
  const genderKey = gender === 'Hombre' ? 'male' : gender === 'Mujer' ? 'female' : null
  const defaults = DEFAULT_VOICES[baseLanguage]
  const candidates = [
    genderKey ? defaults[genderKey] : undefined,
    defaults.neutral,
    defaults.male,
    defaults.female
  ]
  const resolvedVoiceId = candidates.find(Boolean)

  if (!resolvedVoiceId) {
    throw new Error(
      `No ElevenLabs voice configured for language ${baseLanguage}. Please set ELEVENLABS_DEFAULT_VOICE_${baseLanguage.toUpperCase()}.`
    )
  }

  return {
    voiceId: resolvedVoiceId,
    languageCode: targetLanguage
  }
}
