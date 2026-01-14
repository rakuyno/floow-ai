import { createClient } from '@supabase/supabase-js'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

// Helpers
import {
  generateKeyframe,
  generateVeoVideoClip,
  generateTTS,
  VERTEX_CONFIG
} from './lib/ai-providers'
import { classifyScenesByVisualType } from './lib/scene-classifier'
import { ensureAvatarAndProductAssets } from './lib/assets'
import { getAvatarVoiceForLanguage, normalizeTargetLanguage, getLanguageLabel, type AvatarVoiceMeta, type TargetLanguage } from './lib/tts'
import { replaceAudioWithNarration, extractAudioTrack, hasAudioStream, getAudioStreamInfo } from './lib/audio'
import {
  concatVideos,
  addWatermark
} from './lib/video-processing'
import {
  getUserPlan,
  deductTokens,
  refundTokens,
  TOKENS_PER_SCENE
} from './lib/billing'
import { type ElevenLabsVoiceProfile } from './lib/elevenlabs'

console.log('[ENV] SUPABASE_URL=', process.env.SUPABASE_URL);
console.log('[ENV] SERVICE_ROLE prefix=', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8));


// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// Configure ffmpeg
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
} else {
  console.error('[Worker] FFmpeg binary not found')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '1', 10)
const JOB_DELAY_MS = parseInt(process.env.JOB_DELAY_MS || '10000', 10)
const ENABLE_TTS = process.env.ENABLE_TTS !== 'false'

let activeJobs = 0
let processingEnabled = true

const SAFE_TEMPLATE_RAW_AVATAR = 'Vertical 9:16 talking-head. Avatar en plano medio, mira a cámara y habla con naturalidad entregando el mensaje. Entorno limpio, luminoso, fondo neutro tipo estudio u hogar moderno. Iluminación agradable, composición sencilla, estilo anuncio ecommerce.'
const SAFE_TEMPLATE_RAW_BROLL = 'Vertical 9:16 b-roll con producto y acciones suaves. Narración en off acompaña las imágenes mientras se muestra el uso del producto. Entorno limpio y luminoso, fondo neutro o hogar, estilo anuncio ecommerce premium.'
const SAFE_TEMPLATE_VOICEOVER_AVATAR = 'Vertical 9:16. Avatar en plano medio, posa amable y mira a cámara sin hablar. Muestra el producto con gestos suaves. Entorno limpio, luminoso, fondo neutro tipo estudio u hogar moderno.'
const SAFE_TEMPLATE_VOICEOVER_BROLL = 'Vertical 9:16 b-roll de producto. Primeros planos y uso cotidiano, movimientos de cámara suaves. Entorno limpio, luminoso, fondo neutro o superficie de producto. Estilo anuncio ecommerce premium.'

const buildVoiceGuide = (meta: { gender: string | null; age_style: string | null }): string => {
  const g = (meta.gender || '').toLowerCase().trim()
  const a = (meta.age_style || '').toLowerCase().trim()
  let gender: 'male' | 'female' | 'neutral' = 'neutral'
  if (g.includes('hombre') || g.includes('male')) gender = 'male'
  if (g.includes('mujer') || g.includes('female')) gender = 'female'

  let ageBucket: 'youthful' | 'adult' | 'mature' = 'adult'
  const minAge = parseInt((a.match(/\d+/) || [])[0] || '', 10)
  if (!isNaN(minAge)) {
    if (minAge < 20) ageBucket = 'youthful'
    else if (minAge >= 40) ageBucket = 'mature'
    else ageBucket = 'adult'
  }

  const genderLabel = gender === 'neutral' ? 'natural' : gender
  return `${genderLabel} ${ageBucket} voice`.trim()
}

const RISKY_KEYWORDS = [
  'skate',
  'skater',
  'trucos',
  'truco',
  'salto',
  'saltos',
  'rail',
  'parkour',
  'escalada',
  'alpinismo',
  'extremo',
  'acrobacia',
  'acrobacias',
  'pirueta',
  'piruetas',
  'maniobra',
  'maniobras',
  'golpe',
  'golpes',
  'pelea',
  'pelea',
  'caída',
  'caidas',
  'lesión',
  'lesiones',
  'arma',
  'armas',
  'daño',
  'daños'
]

const selectSafeTemplate = (mode: 'raw' | 'voiceover', isAvatar: boolean): string => {
  if (mode === 'raw') {
    return isAvatar ? SAFE_TEMPLATE_RAW_AVATAR : SAFE_TEMPLATE_RAW_BROLL
  }
  return isAvatar ? SAFE_TEMPLATE_VOICEOVER_AVATAR : SAFE_TEMPLATE_VOICEOVER_BROLL
}

const moderateVisualDescription = (
  visual: string | null | undefined,
  mode: 'raw' | 'voiceover',
  isAvatar: boolean
): { visual: string; moderated: boolean } => {
  const txt = (visual || '').toLowerCase()
  const containsRisk = RISKY_KEYWORDS.some((kw) => txt.includes(kw))
  const safeTemplate = selectSafeTemplate(mode, isAvatar)
  if (containsRisk) {
    return { visual: safeTemplate, moderated: true }
  }
  return { visual: visual || safeTemplate, moderated: false }
}

// Sanitize text before sending to image/video models (remove URLs, @handles, special chars)
const sanitizeForModel = (text: string | null | undefined, fallback: string): string => {
  if (!text || typeof text !== 'string') return fallback
  let t = text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/@\S+/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/["'*`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (t.length === 0) t = fallback
  if (t.length > 320) t = t.slice(0, 320)
  return t
}

const SENSITIVE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /antes\s+y\s+despu[eé]s|before\s+and\s+after/gi, replacement: 'mostrando una mejora gradual' },
  { pattern: /piel\s+(da[ñn]ada|muy\s+seca|irritada|heridas|cicatrices)/gi, replacement: 'piel sensible que va mejorando con el producto' },
  { pattern: /(manchas\s+fuertes|acn[eé]|lesiones|heridas|cortes)/gi, replacement: 'pequeñas imperfecciones que lucen mejoradas' },
  { pattern: /(tratamiento|cl[ií]nico|m[eé]dico|cura|medicinal)/gi, replacement: 'cuidado cotidiano de bienestar' },
  { pattern: /(sexual|sensual|er[oó]tico|desnudo|semidesnudo)/gi, replacement: 'estilo sobrio y completamente vestido' }
]

const softenSensitiveCopy = (text: string): string => {
  let t = text || ''
  for (const { pattern, replacement } of SENSITIVE_REPLACEMENTS) {
    t = t.replace(pattern, replacement)
  }
  return t
}

const buildSafeVisualPrompt = (visual: string): string => {
  const softened = softenSensitiveCopy(visual)
  return `${softened}. Ambiente amable y cotidiano, apto para todo público.`
}

const SAFE_KEYFRAME_TEMPLATE_AVATAR = 'Vertical 9:16 ecommerce ad. Single adult subject holding the product. Clean bright indoor background. Simple composition. Single-subject only, clean composition, no secondary photo elements, no comparison layout. Natural lighting.'
const SAFE_KEYFRAME_TEMPLATE_PRODUCT = 'Vertical 9:16 product shot. Product on clean neutral surface. Soft studio lighting. Simple composition. Single-subject only, clean composition, no secondary photo elements, no comparison layout.'

const buildVeoPrompt = ({
  visual,
  cameraStyle,
  isAvatar,
  isVoiceoverMode,
  fallbackTemplate
}: {
  visual: string
  cameraStyle?: string
  isAvatar?: boolean
  isVoiceoverMode?: boolean
  fallbackTemplate: string
}) => {
  const cam = cameraStyle || 'mid-shot'
  const extra = isAvatar
    ? (
      isVoiceoverMode
        ? 'Avatar completamente vestido, mira a cámara, posa y acompaña la escena sin hablar, expresión amable.'
        : 'Avatar habla a cámara, entrega el guion con articulación clara, labios sincronizados, expresión amable y natural.'
    )
    : 'Personas vestidas de forma discreta y cotidiana, o producto en primer plano.'

  const safetyEnvelope =
    'Family-friendly ecommerce commercial. Adult (25–40), fully clothed in modest casual outfit. Bright, clean home or simple studio with neutral background. Friendly expression, natural pose, soft camera motion. Vertical 9:16, high-quality lighting, logo-free frame, text-free composition.'

  const base = `Scene: ${buildSafeVisualPrompt(visual)} ${extra} Cámara: ${cam}. ${safetyEnvelope} Aspect ratio 9:16, fondo neutro, atmósfera amable y relajada.`
  return sanitizeForModel(base, fallbackTemplate)
}

const isInputImageViolation = (msg: string): boolean => {
  const m = (msg || '').toLowerCase()
  return m.includes('input image violates') || m.includes('because the input image violates')
}

const isUsageGuidelines = (msg: string): boolean => {
  const m = (msg || '').toLowerCase()
  return (
    m.includes('usage guidelines') ||
    m.includes('violates') && m.includes('usage') ||
    m.includes('rai policy') ||
    m.includes('sensitive content')
  )
}

const extractSupportCode = (msg: string): string | null => {
  const match = /Support codes:\s*([0-9]+)/i.exec(msg || '')
  return match ? match[1] : null
}

console.log('')
console.log('========================================')
console.log('WORKER CONFIGURATION (v2 Senior Refactor)')
console.log('========================================')
console.log(`Keyframe Provider: vertex (${VERTEX_CONFIG.imageModel})`)
console.log(`Video Model: veo-3.1 (${VERTEX_CONFIG.veoModel})`)
console.log(`Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`)
console.log('========================================')
console.log('')

// ============================================================================
// WORKER LOGIC
// ============================================================================

const getMediaDurationSeconds = async (filePath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) return reject(err)
      const duration = metadata?.format?.duration
      resolve(typeof duration === 'number' ? duration : 0)
    })
  })
}

async function waitForSlot(): Promise<void> {
  while (activeJobs >= MAX_CONCURRENT_JOBS) {
    // Reduce log spam
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}

async function processJob(job: any) {
  console.log(`[Job ${job.id}] Processing started...`)
  let cost = 0
  let isRefundNeeded = false
  let userId: string = ''

  try {
    // 1. Fetch Data (status already set to 'processing' by claim_job RPC)
    const { data: storyboardData } = await supabase
      .from('storyboards').select('*').eq('session_id', job.session_id).single()

    if (!storyboardData) {
      console.error(`[Job ${job.id}] Storyboard not found for session_id: ${job.session_id}`)
      throw new Error('Storyboard not found')
    }

    console.log(`[Job ${job.id}] DEBUG: Querying ad_sessions for user_id (FIXED)...`)

    // Explicitly selecting id and user_id to ensure we have a valid query
    const { data: sessionData, error: sessionError } = await supabase
      .from('ad_sessions')
      .select('id, user_id')
      .eq('id', job.session_id)
      .single()

    if (sessionError) {
      console.error(`[Job ${job.id}] Session lookup error (Post-Fix):`, sessionError)
    }

    if (!sessionData?.user_id) {
      console.error(`[Job ${job.id}] Session Data missing or no user_id`, sessionData)
      throw new Error('Session/User not found')
    }

    userId = sessionData.user_id
    const scenes = storyboardData.storyboard || []
    if (scenes.length === 0) throw new Error('No scenes in storyboard')

    const brief = storyboardData.brief ? JSON.parse(storyboardData.brief) : {}
    const audioModeRaw = String(brief.audio_mode ?? 'raw').toLowerCase().trim()
    const audioMode = audioModeRaw === 'tts' ? 'voiceover' : audioModeRaw === 'raw' ? 'raw' : 'voiceover' // enforce known modes



    // 3. Billing: Deduct Tokens (atomic RPC) — refunds handled on failure
    cost = scenes.length * TOKENS_PER_SCENE
    
    // Check if tokens were already deducted for this job (prevent double charging)
    const { data: existingDeduction } = await supabase
      .from('user_token_ledger')
      .select('id')
      .eq('metadata->>job_id', job.id)
      .eq('metadata->>type', 'deduction')
      .eq('reason', 'video_generation')
      .maybeSingle()
    
    if (existingDeduction) {
      console.log(`[Job ${job.id}] Tokens already deducted, skipping charge`)
      isRefundNeeded = true // Can refund if job fails
    } else {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e1f7b8b0-81a2-4d1e-9e1b-0200dc15d131',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'worker/index.ts:cost',message:'About to deduct tokens',data:{jobId:job.id,userId,sessionId:job.session_id,cost},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        const deduction = await deductTokens(supabase, userId, cost, job.id)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e1f7b8b0-81a2-4d1e-9e1b-0200dc15d131',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'worker/index.ts:cost',message:'Deduction success',data:{jobId:job.id,userId,sessionId:job.session_id,cost,deduction},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        console.log(`[Job ${job.id}] Tokens deducted. Prev=${deduction.previous_balance} New=${deduction.new_balance} Required=${cost}`)
        isRefundNeeded = true // If we fail after this, we refund
      } catch (deductErr: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e1f7b8b0-81a2-4d1e-9e1b-0200dc15d131',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'worker/index.ts:cost',message:'Deduction error',data:{jobId:job.id,userId,sessionId:job.session_id,cost,errorMessage:deductErr?.message,current_balance:deductErr?.current_balance,required:deductErr?.required},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        if (deductErr?.code === 'INSUFFICIENT_TOKENS') {
          const bal = deductErr.current_balance ?? 'desconocido'
          const req = deductErr.required ?? cost
          throw new Error(`Insufficient tokens. Balance: ${bal}, Required: ${req}`)
        }
        throw deductErr
      }
    }

    // 4. Billing: Check Plan (Watermark)
    const planId = await getUserPlan(supabase, userId)
    const normalizedPlan = (planId || 'free').trim().toLowerCase()
    const paidPlans = new Set(['starter', 'growth', 'agency', 'pro', 'enterprise', 'business'])
    const needsWatermark = !paidPlans.has(normalizedPlan)
    console.log(`[Job ${job.id}] User Plan: ${normalizedPlan} (${needsWatermark ? 'Watermark' : 'No Watermark'})`)

    // 5. Config
    const targetLanguage: TargetLanguage = normalizeTargetLanguage(brief.target_language || brief.language)
    const jobSeed = Math.floor(Math.random() * 1000000)
    const visualMode: 'mixed' | 'avatar' | 'product' = brief.visual_mode || 'mixed'

    console.log(`[Job ${job.id}] Scenes: ${scenes.length}, Cost: ${cost} tokens`)
    console.log(`[Job ${job.id}] Audio Mode: ${audioMode}, Language: ${targetLanguage}, Visual Mode: ${visualMode}`)

    // 6. Assets & Classification
    // Classify only if visual_mode is 'mixed'
    let sceneMetadata: any[] = []
    let updatedJob: any = null
    if (visualMode === 'mixed') {
      await classifyScenesByVisualType(job.id, scenes)
      // Fetch Updated Metadata
      const { data } = await supabase
        .from('render_jobs').select('scene_metadata').eq('id', job.id).single()
      updatedJob = data
      sceneMetadata = updatedJob?.scene_metadata?.scenes || []
    } else {
      // Force all scenes to the specified visual_mode
      console.log(`[Job ${job.id}] Visual mode is '${visualMode}', skipping classification. All scenes will be '${visualMode}'.`)
      sceneMetadata = scenes.map((_scene: any, idx: number) => ({
        index: idx + 1,
        scene_type: visualMode,
        reason: `Forced by global visual_mode: ${visualMode}`
      }))
    }

    // Ensure Assets
    const assets = await ensureAvatarAndProductAssets(job, supabase, scenes, sceneMetadata)
    const {
      avatarImageBuffer,
      avatarImageMimeType,
      productImageBuffer,
      productImageMimeType,
      productImageUrl,
      avatarImageUrl
    } = assets

    // FORCE AVATAR logic: If brief has avatar_id, ensure at least first scene is 'avatar'
    const avatarId = brief.avatar_id

    // Voice Profile (only needed for voiceover mode)
    let voiceProfile: ElevenLabsVoiceProfile | null = null
    let avatarVoiceMeta: AvatarVoiceMeta = { gender: null, age_style: null, default_voice_id: null }

    if (audioMode === 'voiceover') {
      if (avatarId) {
        // Fetch avatar details
        const { data: av } = await supabase.from('avatars').select('*').eq('id', avatarId).single()
        if (av) {
          avatarVoiceMeta = {
            gender: av.gender,
            age_style: av.age_style,
            default_voice_id: av.default_voice_id
          }
        }
      }

      // Get voice profile for TTS
      voiceProfile = await getAvatarVoiceForLanguage(supabase, avatarId, targetLanguage, avatarVoiceMeta)
      if (!voiceProfile) {
        throw new Error('Unable to resolve ElevenLabs voice profile for voiceover mode')
      }
      console.log(`[Voice] ElevenLabs voice: ${voiceProfile.voiceId} (${voiceProfile.languageCode})`)
    }

    const tempDir = path.resolve('./tmp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)
    const clipPaths: string[] = []

    const isVoiceoverMode = audioMode === 'voiceover'
    const languageInfo = getLanguageLabel(targetLanguage)
    
    // Simple i18n for worker error messages
    const getErrorMessage = (key: 'content_rejected'): string => {
      const messages = {
        'en-US': {
          content_rejected: 'Content rejected by Floow AI safety filters. Please use more neutral descriptions.'
        },
        'es-ES': {
          content_rejected: 'Contenido rechazado por filtros de seguridad de Floow AI. Usa descripciones más neutrales.'
        },
        'es-MX': {
          content_rejected: 'Contenido rechazado por filtros de seguridad de Floow AI. Usa descripciones más neutrales.'
        }
      }
      return messages[targetLanguage][key]
    }
    
    const synthesizeNarration = async (text: string, sceneIndex: number): Promise<string> => {
      if (!voiceProfile) throw new Error('Voice profile not resolved for TTS')
      const safeText = (text || '').trim()
      if (!safeText) {
        throw new Error(`Scene ${sceneIndex + 1} missing narration text for audio generation`)
      }

      if (!ENABLE_TTS) {
        console.warn('[TTS] ENABLE_TTS=false but narration is required. Forcing TTS generation.')
      }

      const ttsPath = path.join(tempDir, `${job.id}_s${sceneIndex}_tts.mp3`)
      let lastErr: any = null

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const ttsBuffer = await generateTTS(safeText, voiceProfile, { allowWhenDisabled: true })
          fs.writeFileSync(ttsPath, ttsBuffer)
          return ttsPath
        } catch (err: any) {
          lastErr = err
          console.error(`[Scene ${sceneIndex + 1}] TTS attempt ${attempt} failed:`, err?.message || err)
          if (attempt === 2) break
          await new Promise(r => setTimeout(r, 1000))
        }
      }

      throw new Error(`TTS failed for scene ${sceneIndex + 1}: ${lastErr?.message || lastErr}`)
    }

    const assertAudioTrack = async (filePath: string, sceneIndex: number) => {
      const hasAudio = await hasAudioStream(filePath)
      if (!hasAudio) {
        throw new Error(`No audio detected after processing scene ${sceneIndex + 1}`)
      }
    }

    const decideBackgroundStyle = (scene: any): string => {
      const explicit = (scene.background_style || '').trim()
      if (explicit) return explicit
      // Fallback heuristics if GPT did not provide one
      const txt = (scene.visual || '').toLowerCase()
      if (txt.includes('street') || txt.includes('skate') || txt.includes('urban')) return 'street'
      if (txt.includes('park') || txt.includes('outdoor') || txt.includes('beach')) return 'outdoor'
      if (txt.includes('studio') || txt.includes('set') || txt.includes('production')) return 'studio'
      if (txt.includes('office') || txt.includes('corporate')) return 'professional'
      return 'home'
    }

    // 7. GENERATION LOOP
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const m = sceneMetadata.find((meta: any) => meta.index === i + 1) || {}

      // STRICT SCENE LOGIC
      let type = m.scene_type || 'product' // default to product if no metadata
      
      const role = scene.role || 'voiceover_broll' // visual role (legacy)
      const isAvatar = (type === 'avatar' || role === 'talking_head')

      console.log(`[Scene ${i + 1}] Type: ${type}, IsAvatar: ${isAvatar}, VisualMode: ${visualMode}`)

      // Prepare Keyframe References
      const keyframeOptions = {
        avatarImageBase64: isAvatar ? avatarImageBuffer?.toString('base64') : undefined,
        avatarImageMimeType: avatarImageMimeType || undefined,
        productImageBase64: productImageBuffer?.toString('base64'),
        productImageMimeType: productImageMimeType || undefined,
        avatarImageUrl: isAvatar ? avatarImageUrl || undefined : undefined,
        productImageUrl: productImageUrl || undefined,
        backgroundStyle: decideBackgroundStyle(scene)
      }

      // A. Prepare prompts and narration text
      const narrationText = (scene.spoken_text || scene.dialogue || scene.voiceover || '').trim()
      if (!narrationText) {
        throw new Error(`Scene ${i + 1} is missing narrationText (spoken_text/dialogue/voiceover). RAW and TTS modes require explicit script.`)
      }
      const narrationPreview = narrationText.slice(0, 80)
      const withAudioForVeo = !isVoiceoverMode
      const safeTemplate = selectSafeTemplate(audioMode === 'raw' ? 'raw' : 'voiceover', isAvatar)
      console.log(`[Scene ${i + 1}] audioMode=${audioMode}, isVoiceoverMode=${isVoiceoverMode}, withAudioForVeo=${withAudioForVeo}, isAvatar=${isAvatar}, safeTemplate=${safeTemplate}, scene_type=${type}, role=${role}, narration="${narrationPreview}${narrationText.length > 80 ? '...' : ''}"`)
      const cleanText = narrationText.replace(/["*]/g, '')
      const { visual: moderatedVisual, moderated } = moderateVisualDescription(
        scene.visual || cleanText,
        audioMode === 'raw' ? 'raw' : 'voiceover',
        isAvatar
      )
      const safeVisual = sanitizeForModel(
        moderatedVisual,
        safeTemplate
      )
      if (moderated) {
        console.log(`[Scene ${i + 1}] Visual moderated for safety -> ${safeVisual}`)
      }
      const veoPrompt = buildVeoPrompt({
        visual: safeVisual,
        cameraStyle: scene.camera_style,
        isAvatar,
        isVoiceoverMode,
        fallbackTemplate: safeTemplate
      })
      console.log(`[Scene ${i + 1}] Veo prompt -> ${veoPrompt}`)
      let keyframe: Buffer
      let keyframeMime: string

      try {
        const kf = await generateKeyframe(veoPrompt, undefined, keyframeOptions, jobSeed + i)
        keyframe = kf.buffer
        keyframeMime = kf.mimeType

        // Upload Keyframe (namespace by user + session to satisfy storage policies)
        const kfPath = path.join(tempDir, `${job.id}_s${i}_key.png`)
        fs.writeFileSync(kfPath, keyframe)
        const storageKey = `${userId}/${job.session_id}/${job.id}_s${i}_key.png`
        const { error: keyframeUploadErr } = await supabase.storage
          .from('assets')
          .upload(storageKey, keyframe, { contentType: keyframeMime, upsert: true })
        if (keyframeUploadErr) {
          throw new Error(`Keyframe upload failed: ${keyframeUploadErr.message}`)
        }
        const { data: keyframePublic } = supabase.storage.from('assets').getPublicUrl(storageKey)
        console.log(`[Scene ${i + 1}] Keyframe stored -> ${keyframePublic.publicUrl}`)

      } catch (e: any) {
        console.error(`[Scene ${i + 1}] Keyframe failed:`, e)
        // Fallback to product if available
        if (productImageBuffer) {
          console.log(`[Scene ${i + 1}] Keyframe fallback -> Product Image`)
          keyframe = productImageBuffer
          keyframeMime = 'image/jpeg'
        } else {
          throw new Error(`Scene ${i + 1} keyframe generation failed`)
        }
      }

      // B. Audio & Video Pipeline
      // Unified: Always TTS from script + silent Veo + merge (voiceover + raw)

      let finalScenePath = path.join(tempDir, `${job.id}_s${i}_final.mp4`)

      let narrationPath: string | null = null
      const clipDurationSeconds = 4
      console.log(`[Scene ${i + 1}] Duration fixed to ${clipDurationSeconds}s`)
      if (isVoiceoverMode) {
        narrationPath = await synthesizeNarration(narrationText, i)
      }

      type SceneAttemptDebug = {
        attempt: number
        strategyId: string
        usedReferenceImage: boolean
        regeneratedKeyframe: boolean
        supportCode: string | null
        errorType?: string
        errShort?: string
      }

      const generateSceneVeoClipWithRetries = async ({
        basePrompt,
        safeVisualPrompt,
        durationSeconds,
        seed,
        originalKeyframe,
        originalKeyframeMime,
        isAvatarScene,
        withAudio
      }: {
        basePrompt: string
        safeVisualPrompt: string
        durationSeconds: number
        seed: number
        originalKeyframe: Buffer
        originalKeyframeMime: string
        isAvatarScene: boolean
        withAudio: boolean
      }): Promise<{ buffer: Buffer, debug: SceneAttemptDebug[] }> => {
        const MAX_ATTEMPTS = 5
        const MAX_POLICY_STRIKES = 1 // Fail fast on sensitive content (was 3)
        let attempt = 0
        let sawImageViolation = false
        let usageGuidelineStrikes = 0
        let regeneratedKeyframe: Buffer | null = null
        let regeneratedKeyframeMime: string | null = null
        const attempts: SceneAttemptDebug[] = []

        const strategies: Array<{
          id: string
          prompt: string
          useReference: boolean
          regenKeyframe: boolean
        }> = [
          {
            id: 'S1_NORMAL_REF',
            prompt: basePrompt,
            useReference: true,
            regenKeyframe: false
          },
          {
            id: 'S2_REGEN_KF_REF',
            prompt: basePrompt,
            useReference: true,
            regenKeyframe: true
          },
          {
            id: 'S3_DROP_REF',
            prompt: basePrompt,
            useReference: false,
            regenKeyframe: false
          },
          {
            id: 'S4_SAFE_PROMPT_NO_REF',
            prompt: buildSafeVisualPrompt(`${safeVisualPrompt} (versión más neutra: adulto 25-40, ropa casual modesta, entorno luminoso hogareño o estudio, detalles suaves, fondo simple)`),
            useReference: false,
            regenKeyframe: false
          },
          {
            id: 'S5_PRODUCT_ONLY_NO_REF',
            prompt: 'Vertical 9:16 product demo. Product on clean neutral surface, soft lighting, slow camera motion, premium ecommerce look.',
            useReference: false,
            regenKeyframe: false
          }
        ]

        for (let sIdx = 0; sIdx < strategies.length && attempt < MAX_ATTEMPTS; sIdx++) {
          const strategy = strategies[sIdx]

          // Skip regen strategy if we never saw image violation
          if (strategy.id === 'S2_REGEN_KF_REF' && !sawImageViolation) {
            continue
          }

          let refBuffer = strategy.regenKeyframe ? regeneratedKeyframe || null : originalKeyframe
          let refMime = strategy.regenKeyframe ? regeneratedKeyframeMime || null : originalKeyframeMime
          let regenThisAttempt = false

          if (strategy.regenKeyframe && !regeneratedKeyframe) {
            try {
              regenThisAttempt = true
              const safeTemplate = isAvatarScene ? SAFE_KEYFRAME_TEMPLATE_AVATAR : SAFE_KEYFRAME_TEMPLATE_PRODUCT
              const kf = await generateKeyframe(safeTemplate, undefined, keyframeOptions, seed + 999)
              regeneratedKeyframe = kf.buffer
              regeneratedKeyframeMime = kf.mimeType
              refBuffer = regeneratedKeyframe
              refMime = regeneratedKeyframeMime
              console.log(`[Scene ${i + 1}] Regenerated keyframe with SAFE template for strategy ${strategy.id}`)
            } catch (err: any) {
              console.warn(`[Scene ${i + 1}] Failed to regenerate keyframe for strategy ${strategy.id}: ${err?.message || err}`)
              continue
            }
          }

          const useReference = strategy.useReference && !!refBuffer && !!refMime
          let retrySameStrategy = false
          do {
            attempt += 1
            if (attempt > MAX_ATTEMPTS) break

            console.log(`[Scene ${i + 1}] Veo attempt ${attempt}/${MAX_ATTEMPTS} strategy=${strategy.id} usedRef=${useReference} regenKF=${regenThisAttempt}`)
            try {
              const buffer = await generateVeoVideoClip({
                prompt: strategy.prompt,
                durationSeconds,
                withAudio,
                referenceImageBuffer: useReference ? refBuffer || undefined : undefined,
                referenceImageMimeType: useReference ? refMime || undefined : undefined,
                seed
              })

              attempts.push({
                attempt,
                strategyId: strategy.id,
                usedReferenceImage: useReference,
                regeneratedKeyframe: strategy.regenKeyframe,
                supportCode: null
              })

              console.log(`[Scene ${i + 1}] Veo success with strategy ${strategy.id} on attempt ${attempt}/${MAX_ATTEMPTS}`)
              return { buffer, debug: attempts }
            } catch (err: any) {
              const msg = err?.message || ''
              const msgLower = msg.toLowerCase()
              const supportCode = extractSupportCode(msg) || null
              const imageViolation = isInputImageViolation(msg)
              const guidelines = isUsageGuidelines(msg)
              const softTimeout = /soft timeout/i.test(msgLower)
              const transient = softTimeout || /timeout/i.test(msgLower) || /unavailable/i.test(msgLower) || /deadline/i.test(msgLower)

              attempts.push({
                attempt,
                strategyId: strategy.id,
                usedReferenceImage: useReference,
                regeneratedKeyframe: strategy.regenKeyframe,
                supportCode,
                errorType: imageViolation ? 'input_image' : guidelines ? 'usage_guidelines' : softTimeout ? 'soft_timeout' : transient ? 'transient' : 'other',
                errShort: msg.slice(0, 200)
              })

              console.warn(`[Scene ${i + 1}] Veo attempt ${attempt}/${MAX_ATTEMPTS} strategy=${strategy.id} failed: ${msg} supportCode=${supportCode || 'n/a'}`)

              if (imageViolation) {
                sawImageViolation = true
              }

              if (guidelines) {
                usageGuidelineStrikes += 1
                const policyMessage = getErrorMessage('content_rejected')

                if (usageGuidelineStrikes >= MAX_POLICY_STRIKES) {
                  console.error(`[Scene ${i + 1}] FAIL FAST: Content policy violation detected, stopping retries to free queue`)
                  throw new Error(policyMessage)
                }
                // Skip remaining strategies when we hit sensitive content - fail fast
                console.warn(`[Scene ${i + 1}] Policy violation detected, skipping remaining strategies`)
                break // Exit strategy loop immediately
              }

              retrySameStrategy = false

              if (softTimeout && attempt < MAX_ATTEMPTS) {
                retrySameStrategy = true
              } else if (transient && attempt < MAX_ATTEMPTS) {
                retrySameStrategy = false
              }
            }
          } while (retrySameStrategy && attempt < MAX_ATTEMPTS)
        }

        throw new Error(`Veo failed after ${attempts.length} attempts for scene ${i + 1}`)
      }

      const audioPromptText = sanitizeForModel(narrationText, safeTemplate)
      const voiceGuide = buildVoiceGuide(avatarVoiceMeta)
      const veoPromptWithAudio = isVoiceoverMode
        ? veoPrompt
        : isAvatar
          ? `${veoPrompt} Audio: avatar speaking to camera in ${languageInfo.full}, ${voiceGuide}, natural pacing, clear diction, delivering the script in ${languageInfo.language} with ${languageInfo.accent}: ${audioPromptText}.`
          : `${veoPrompt} Audio: voiceover narration in ${languageInfo.full}, ${voiceGuide}, natural pacing, delivering the script in ${languageInfo.language} with ${languageInfo.accent}: ${audioPromptText}.`

      const { buffer: veoBuffer, debug: veoAttempts } = await generateSceneVeoClipWithRetries({
        basePrompt: veoPromptWithAudio,
        safeVisualPrompt: safeVisual,
        durationSeconds: clipDurationSeconds,
        seed: jobSeed + i,
        originalKeyframe: keyframe,
        originalKeyframeMime: keyframeMime,
        isAvatarScene: isAvatar,
        withAudio: withAudioForVeo
      })
      const veoPath = path.join(tempDir, `${job.id}_s${i}_${audioMode}.mp4`)
      fs.writeFileSync(veoPath, veoBuffer)

      if (isVoiceoverMode) {
        if (!narrationPath) {
          throw new Error('Narration audio missing for voiceover mode')
        }
        // Voiceover: Replace video audio with narration TTS
        const mergedPath = path.join(tempDir, `${job.id}_s${i}_merged.mp4`)
        await replaceAudioWithNarration({
          videoPath: veoPath,
          narrationPath,
          outputPath: mergedPath
        })
        finalScenePath = mergedPath
      } else {
        // RAW mode: mantener SOLO el audio generado por Veo (sin ElevenLabs encima)
        finalScenePath = veoPath
      }

      // Persist attempts into scene metadata if available
      try {
        m.veo_attempts = veoAttempts
        const sceneMetadataEnvelope = updatedJob?.scene_metadata || { scenes: sceneMetadata }
        sceneMetadataEnvelope.scenes = sceneMetadata
        await supabase.from('render_jobs').update({ scene_metadata: sceneMetadataEnvelope }).eq('id', job.id)
      } catch (metaErr: any) {
        console.warn(`[Scene ${i + 1}] Failed to persist veo_attempts: ${metaErr?.message || metaErr}`)
      }

      await assertAudioTrack(finalScenePath, i)

      clipPaths.push(finalScenePath)
      console.log(`[Scene ${i + 1}] Complete: ${finalScenePath}`)

      // Wait briefly between scenes to be nice to API
      await new Promise(r => setTimeout(r, 2000))
    }

    // 8. Concatenate
    console.log(`[Job ${job.id}] Concatenating ${clipPaths.length} clips...`)
    const concatPath = path.join(tempDir, `${job.id}_concat.mp4`)
    await concatVideos(clipPaths, concatPath)

    // 9. Watermark (Logic: Agency -> No, Free -> Yes)
    let finalPath = concatPath
    if (needsWatermark) {
      console.log(`[Job ${job.id}] Applying Watermark (Free Plan)`)
      const watermarkedPath = path.join(tempDir, `${job.id}_wm.mp4`)
      await addWatermark(concatPath, watermarkedPath)
      finalPath = watermarkedPath
    } else {
      console.log(`[Job ${job.id}] Skipping Watermark (Paid Plan)`)
    }

    // 10. Upload
    console.log(`[Job ${job.id}] Uploading...`)
    const fileContent = fs.readFileSync(finalPath)
    const storagePath = `renders/${job.id}_final.mp4`
    const { error: upErr } = await supabase.storage.from('renders').upload(storagePath, fileContent, { contentType: 'video/mp4', upsert: true })
    if (upErr) throw upErr

    const { data: { publicUrl } } = supabase.storage.from('renders').getPublicUrl(storagePath)

    // 11. Finish
    await supabase.from('render_jobs').update({ status: 'done', output_url: publicUrl }).eq('id', job.id)
    console.log(`[Job ${job.id}] ✅ DONE. URL: ${publicUrl}`)

  } catch (error: any) {
    console.error(`[Job ${job.id}] ❌ FAILED:`, error.message)
    await supabase.from('render_jobs').update({ status: 'failed', error: error.message }).eq('id', job.id)

    // REFUND
    if (isRefundNeeded && cost > 0 && userId) {
      try {
        await refundTokens(supabase, userId, cost, job.id)
      } catch (refundErr) {
        console.error('Refund failed:', refundErr)
      }
    }
  }
}

// ----------------------
// WORKER LOOP
// ----------------------
async function pollJobs() {
  while (processingEnabled) {
    try {
      await waitForSlot()
      
      // Use RPC to atomically claim next job (prevents double processing)
      const { data: job, error } = await supabase.rpc('claim_job')

      if (error) {
        console.warn('[Worker] claim_job RPC error:', error.message)
        await new Promise(r => setTimeout(r, 5000))
        continue
      }

      if (job && job.id) {
        console.log(`[Worker] Claimed job ${job.id}`)
        activeJobs++
        processJob(job)
          .finally(() => {
            activeJobs--
          })
      } else {
        // No jobs available, wait before polling again
        await new Promise(r => setTimeout(r, 5000))
      }
    } catch (e) {
      console.error('Worker polling error:', e)
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}

console.log('Worker starting...')
pollJobs()

// Graceful shutdown
process.on('SIGINT', () => { processingEnabled = false; process.exit(0) })
process.on('SIGTERM', () => { processingEnabled = false; process.exit(0) })
