import axios from 'axios'
import { GoogleAuth } from 'google-auth-library'
import { Storage } from '@google-cloud/storage'
import dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'
import { fal } from '@fal-ai/client'
import { synthesizeWithElevenLabs } from './elevenlabs'
import type { ElevenLabsVoiceProfile } from './elevenlabs'

// Load environment variables if not already loaded
if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
    dotenv.config({ path: path.join(process.cwd(), '.env.local') })
}

// ============================================================================
// CONFIGURATION & TYPES
// ============================================================================

export const VERTEX_CONFIG = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'gen-lang-client-0412493534',
    location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
    veoModel: process.env.VERTEX_VIDEO_MODEL || 'veo-3.1-fast-generate-preview',
    imageModel: process.env.VERTEX_IMAGE_MODEL || 'imagen-4.0-ultra-generate-001'
} as const

// Higgsfield Nano Banana Pro (image_edit) for keyframes
const HIGGS_CONFIG = {
    apiKey: process.env.HIGGSFIELD_API_KEY || '',
    apiKeySecret: process.env.HIGGSFIELD_API_KEY_SECRET || '',
    baseUrl: 'https://platform.higgsfield.ai',
    // Replace with the exact model_id from your Higgsfield dashboard API reference
    modelId: 'nano-banana-pro/edit',
    baseImageUrl: process.env.HIGGSFIELD_BASE_IMAGE_URL || ''
} as const

// Build Vertex AI endpoint URLs (image unused after switching to Flux2 for keyframes)
const VERTEX_ENDPOINTS = {
    image: '',
} as const

// Image Generation Strategy - now Higgsfield Nano Banana Pro for keyframes
const IMAGE_STRATEGY = 'nano-banana-pro-edit'

// Retry configuration
const RETRY_CONFIG = {
    MAX_RETRIES: 8,
    DELAYS: [5000, 10000, 20000, 30000, 45000, 60000, 60000, 60000]
} as const

// Seedance (fal.ai) configuration for video generation
const SEEDANCE_CONFIG = {
    falKey: process.env.FAL_KEY || '',
    resolution: process.env.SEEDANCE_RESOLUTION || '720p',
    endpoint: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
    endpointText: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'
} as const

// Configure fal client
if (SEEDANCE_CONFIG.falKey) {
    fal.config({ credentials: SEEDANCE_CONFIG.falKey })
} else {
    console.warn('[SEEDANCE] FAL_KEY not configured')
}

console.log('ai-providers.ts VERSION 15 - Seedance 1.5 Pro + Nano Banana Pro Keyframes')
console.log('Vertex/Flux Configuration:')
console.log('- Project ID:', VERTEX_CONFIG.projectId)
console.log('- Location:', VERTEX_CONFIG.location)
console.log('- Image Model:', VERTEX_CONFIG.imageModel)
console.log('- Video Model:', VERTEX_CONFIG.veoModel)
console.log('- Keyframe Strategy:', IMAGE_STRATEGY)

// ============================================================================
// AUTHENTICATION
// ============================================================================

const googleAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
})

const storage = new Storage()

/**
 * Get an OAuth access token for Vertex AI API calls
 */
async function getAccessToken(): Promise<string> {
    const client = await googleAuth.getClient()
    const token = await client.getAccessToken()

    if (!token.token) {
        throw new Error('Failed to obtain access token from Google Auth')
    }

    return token.token
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

interface RetryOptions {
    maxRetries?: number
    delays?: number[]
    retryOn?: (error: any) => boolean
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = RETRY_CONFIG.MAX_RETRIES,
        delays = RETRY_CONFIG.DELAYS,
        retryOn = (error: any) => {
            const status = error?.response?.status
            return status === 429 || status === 503
        }
    } = options

    let lastError: any

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error: any) {
            lastError = error

            // Check if we should retry
            if (attempt < maxRetries && retryOn(error)) {
                const delay = delays[attempt] || delays[delays.length - 1]
                const status = error?.response?.status
                const message = error?.response?.data?.error?.message || error.message

                console.warn(`[Retry ${attempt + 1}/${maxRetries}] Status ${status}: ${message}`)
                console.warn(`Waiting ${delay}ms before retry...`)

                await new Promise(resolve => setTimeout(resolve, delay))
            } else {
                throw error
            }
        }
    }

    throw lastError
}

// ============================================================================
// KEYFRAME GENERATION (HIGGSFIELD NANO BANANA PRO image_edit)
// ============================================================================

interface KeyframeOptions {
    avatarImageBase64?: string
    avatarImageMimeType?: string
    productImageBase64?: string
    productImageMimeType?: string
    avatarImageUrl?: string
    productImageUrl?: string
    backgroundStyle?: string
    role?: 'avatar' | 'product'
}

// New Higgsfield Nano Banana Pro (image_edit) keyframe generator
export async function generateKeyframe(
    prompt: string,
    styleReference?: string,
    options?: KeyframeOptions,
    seed?: number
): Promise<{ buffer: Buffer, mimeType: string }> {
    console.log(`[Keyframe] Provider: nano_banana (${HIGGS_CONFIG.modelId})`)

    const normalizeReference = async (
        base64: string,
        mime?: string
    ): Promise<{ base64: string, mime: string }> => {
        try {
            // Lazy require to avoid hard dependency errors if sharp is absent.
            // If sharp is not installed, we fallback to the original image.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            // @ts-ignore - optional dependency
            const sharpLib = require('sharp') as any
            const sharp = (sharpLib?.default || sharpLib) as any
            const input = Buffer.from(base64, 'base64')
            const processed = await sharp(input)
                .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
                .png({ compressionLevel: 8 })
                .toBuffer()
            return { base64: processed.toString('base64'), mime: 'image/png' }
        } catch (err: any) {
            console.warn('[Keyframe] normalizeReference failed or sharp not available, using original image:', err?.message || err)
            return { base64, mime: mime || 'image/png' }
        }
    }

    const buildPrompt = () => {
        let p = prompt
        if (options?.avatarImageUrl) p = `Use the provided avatar reference (same face, hair, pose). Preserve identity. ${p}`
        if (options?.productImageUrl) p = `${p} featuring the provided product reference (exact label/logo, colors, shape).`
        if (styleReference && !options?.avatarImageUrl && !options?.productImageUrl) {
            p = `${p}. Style: ${styleReference}`
        }
        const backgroundStyle = options?.backgroundStyle || 'home'
        const backgroundDesc = `environment: ${backgroundStyle}, 9:16 vertical video frame`
        const safety = 'single uninterrupted frame, no split screen, no collage, no multiple panels, no picture-in-picture.'
        return `${p}, ${backgroundDesc}. High quality, 4k, ${safety}`
    }

    const augmentedPrompt = buildPrompt()

    return retryWithBackoff(async () => {
        try {
            if (!HIGGS_CONFIG.apiKey || !HIGGS_CONFIG.apiKeySecret) {
                throw new Error('HIGGSFIELD_API_KEY/SECRET not configured')
            }

            // Build request payload using URL-based images as expected by Nano Banana Pro.
            const imageUrls: string[] = []
            if (options?.avatarImageUrl) imageUrls.push(options.avatarImageUrl)
            if (options?.productImageUrl) imageUrls.push(options.productImageUrl)

            // Fallback to base image if no user images provided
            if (imageUrls.length === 0 && HIGGS_CONFIG.baseImageUrl) {
                console.log('[NanoBanana] No user images, using base image URL')
                imageUrls.push(HIGGS_CONFIG.baseImageUrl)
            }

            if (imageUrls.length === 0) {
                throw new Error('Keyframe generation requires at least one image URL (user or base image). Set HIGGSFIELD_BASE_IMAGE_URL.')
            }

            const requestBody: any = {
                prompt: augmentedPrompt,
                image_urls: imageUrls, // Higgsfield expects array of image URLs
                aspect_ratio: '9:16'
            }
            if (seed !== undefined) requestBody.seed = seed

            console.log('[NanoBanana] Submitting generation job...')

            const startRes = await axios.post(
                `${HIGGS_CONFIG.baseUrl}/${HIGGS_CONFIG.modelId}`,
                requestBody,
                {
                    headers: {
                        'Authorization': `Key ${HIGGS_CONFIG.apiKey}:${HIGGS_CONFIG.apiKeySecret}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            )

            const requestId = startRes.data?.request_id
            const statusUrl = startRes.data?.status_url || (requestId ? `${HIGGS_CONFIG.baseUrl}/requests/${requestId}/status` : null)
            if (!requestId || !statusUrl) throw new Error('NanoBanana: missing request_id or status_url')

            const maxAttempts = 120
            const delayMs = 4000
            const timeoutMs = 300000 // 5 minutes
            const startedAt = Date.now()

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                if (Date.now() - startedAt > timeoutMs) {
                    throw new Error('NanoBanana: polling timeout')
                }
                await new Promise(r => setTimeout(r, delayMs))

                const pollRes = await axios.get(statusUrl, {
                    headers: {
                        'Authorization': `Key ${HIGGS_CONFIG.apiKey}:${HIGGS_CONFIG.apiKeySecret}`,
                        'Accept': 'application/json'
                    }
                })

                const status = pollRes.data?.status
                if (status === 'completed') {
                    const images = pollRes.data?.images
                    const first = Array.isArray(images) && images.length > 0 ? images[0] : null
                    const url = first?.url || pollRes.data?.result?.sample || pollRes.data?.result?.url
                    if (!url) throw new Error('NanoBanana: completed but no image url')
                    console.log('[NanoBanana] Job completed')
                    console.log('[NanoBanana] Image URL:', url)

                    const download = await axios.get(url, { responseType: 'arraybuffer' })
                    const mime = download.headers['content-type'] || 'image/png'
                    return {
                        buffer: Buffer.from(download.data),
                        mimeType: mime
                    }
                }
                if (status === 'failed' || status === 'error') {
                    const errMsg = pollRes.data?.message || 'NanoBanana job failed'
                    throw new Error(errMsg)
                }
                if (status === 'nsfw') {
                    throw new Error('NanoBanana job flagged as NSFW')
                }

                if (attempt % 5 === 0) {
                    console.log(`[NanoBanana] Polling attempt ${attempt}, status=${status}`)
                }
            }

            throw new Error('NanoBanana: polling exceeded attempts')

        } catch (error: any) {
            const errorDetails = error.response?.data?.error || error.message
            console.error('[NanoBanana Image ERROR]', JSON.stringify(errorDetails, null, 2))
            throw new Error(`NanoBanana Image Generation Failed: ${error.message}`)
        }
    })
}

// ============================================================================
// TEXT-TO-SPEECH (ELEVENLABS FLASH v2.5)
// ============================================================================

export async function generateTTS(
    text: string,
    profile: ElevenLabsVoiceProfile,
    options?: { allowWhenDisabled?: boolean }
): Promise<Buffer> {
    const enabled = process.env.ENABLE_TTS !== 'false'
    if (!enabled && !options?.allowWhenDisabled) throw new Error('TTS is disabled')

    console.log(`[TTS] ElevenLabs Flash v2.5 | ${profile.languageCode} | Voice ${profile.voiceId}`)

    return synthesizeWithElevenLabs(text, profile)
}

// ============================================================================
// VIDEO GENERATION (SEEDANCE 1.5 PRO via fal.ai)
// ============================================================================

/**
 * Generate video from image using Seedance 1.5 Pro via fal.ai
 * Replaces Veo 3.1 as primary video generation provider
 */
export async function generateSeedanceVideoFromImage(options: {
    prompt: string
    imageBase64?: string
    mimeType?: string
    durationSeconds?: number
    aspectRatio?: '9:16'
    resolution?: '720p'
    generateAudio?: boolean
}): Promise<{ buffer: Buffer; mimeType: 'video/mp4' }> {
    const {
        prompt,
        imageBase64,
        mimeType,
        durationSeconds = 4,
        aspectRatio = '9:16',
        resolution = '720p',
        generateAudio = true
    } = options

    console.log(`[SEEDANCE] Starting video generation`)
    console.log(`[SEEDANCE] Duration: ${durationSeconds}s, Ratio: ${aspectRatio}, Resolution: ${resolution}`)
    console.log(`[SEEDANCE] Audio: ${generateAudio ? 'ENABLED' : 'DISABLED (Silent)'}`)
    console.log(`[SEEDANCE] Has reference image: ${!!imageBase64}`)

    if (!SEEDANCE_CONFIG.falKey) {
        throw new Error('FAL_KEY not configured for Seedance')
    }

    // Retry logic for transient errors
    const MAX_RETRIES = 3
    const RETRY_DELAYS = [2000, 5000, 10000]

    const executeGeneration = async (endpoint: string, useImage: boolean): Promise<Buffer> => {
        const input: any = {
            prompt,
            duration: String(durationSeconds),
            aspect_ratio: aspectRatio,
            resolution: resolution,
            generate_audio: generateAudio,
            enable_safety_checker: true
        }

        if (useImage && imageBase64) {
            input.image_url = `data:${mimeType || 'image/png'};base64,${imageBase64}`
        }

        console.log(`[SEEDANCE] Using endpoint: ${endpoint}`)
        console.log(`[SEEDANCE] Input summary:`, JSON.stringify({
            prompt: prompt.slice(0, 100) + '...',
            duration: input.duration,
            aspect_ratio: input.aspect_ratio,
            resolution: input.resolution,
            generate_audio: input.generate_audio,
            has_image: useImage && !!imageBase64
        }))

        let lastError: any = null

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[SEEDANCE] Attempt ${attempt + 1}/${MAX_RETRIES + 1}`)

                // Subscribe to fal endpoint
                const result = await fal.subscribe(endpoint as any, {
                    input,
                    logs: true,
                    onQueueUpdate: (update: any) => {
                        if (update.status) {
                            console.log(`[SEEDANCE] Queue status: ${update.status}`)
                        }
                        if (update.logs) {
                            update.logs.forEach((log: any) => {
                                console.log(`[SEEDANCE] Log: ${log.message || JSON.stringify(log)}`)
                            })
                        }
                    }
                })

                // Extract video URL from result (fal.ai returns data in .data property)
                const resultData: any = result.data || result
                const videoUrl = resultData?.video?.url || resultData?.url
                if (!videoUrl) {
                    throw new Error('No video URL in response: ' + JSON.stringify(result.data || result))
                }

                console.log(`[SEEDANCE] Video ready, downloading from: ${videoUrl}`)

                // Download video
                const downloadResponse = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000 // 2 minutes
                })

                const buffer = Buffer.from(downloadResponse.data)
                console.log(`[SEEDANCE] Downloaded ${buffer.length} bytes`)

                return buffer

            } catch (error: any) {
                lastError = error
                const status = error?.response?.status || error?.status
                const message = error?.message || String(error)

                console.error(`[SEEDANCE] Attempt ${attempt + 1} failed:`, message)

                // Determine if we should retry
                const isTransient = 
                    status === 429 || 
                    status === 503 || 
                    status === 504 ||
                    status === 500 ||
                    message.includes('timeout') ||
                    message.includes('ECONNRESET') ||
                    message.includes('ETIMEDOUT')

                const is4xxClientError = status && status >= 400 && status < 500 && status !== 429

                if (is4xxClientError) {
                    console.error(`[SEEDANCE] Client error (${status}), not retrying`)
                    throw error
                }

                if (!isTransient || attempt >= MAX_RETRIES) {
                    throw error
                }

                const delay = RETRY_DELAYS[attempt]
                console.log(`[SEEDANCE] Retrying in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }

        throw lastError
    }

    try {
        // Primary strategy: image-to-video with reference
        if (imageBase64) {
            try {
                return {
                    buffer: await executeGeneration(SEEDANCE_CONFIG.endpoint, true),
                    mimeType: 'video/mp4'
                }
            } catch (error: any) {
                const status = error?.response?.status || error?.status
                const is4xxClientError = status && status >= 400 && status < 500

                if (is4xxClientError) {
                    console.warn(`[SEEDANCE] Image-to-video rejected (${status}), falling back to text-to-video`)
                    // Fall through to text-to-video fallback
                } else {
                    throw error
                }
            }
        }

        // Fallback: text-to-video without reference
        console.log(`[SEEDANCE] Using text-to-video endpoint (no image reference)`)
        return {
            buffer: await executeGeneration(SEEDANCE_CONFIG.endpointText, false),
            mimeType: 'video/mp4'
        }

    } catch (error: any) {
        const errorMsg = error?.message || String(error)
        const errorBody = error?.response?.data ? JSON.stringify(error.response.data).slice(0, 500) : ''
        console.error(`[SEEDANCE] Generation failed:`, errorMsg)
        if (errorBody) {
            console.error(`[SEEDANCE] Error body:`, errorBody)
        }
        throw new Error(`Seedance video generation failed: ${errorMsg}`)
    }
}

// ============================================================================
// VIDEO GENERATION (VERTEX VEO) - LEGACY, NOT USED
// ============================================================================

// Helper to parse integer envs safely with fallback
const intFromEnv = (value: string | undefined, fallback: number): number => {
    const n = Number.parseInt((value || '').trim(), 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
}

const safeStringify = (obj: any): string => {
    try {
        return JSON.stringify(obj)
    } catch {
        return '[unserializable]'
    }
}

const sanitizeVeoPrompt = (raw: string): string => {
    const cleaned = (raw || '')
        .replace(/["'`]/g, '')
        .replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ\s.,:;()\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    return cleaned.slice(0, 240) // keep concise to avoid sensitive/overlong payloads
}

export async function generateVeoVideoClip(options: {
    prompt: string
    seed?: number
    durationSeconds: number
    aspectRatio?: '9:16' | '16:9' | '1:1'
    withAudio?: boolean // Critical: false = silent (for voiceover mode), true = raw audio
    referenceImageBuffer?: Buffer
    referenceImageMimeType?: string
}): Promise<Buffer> {
    const {
        prompt, seed, durationSeconds, aspectRatio = '9:16',
        withAudio = false, referenceImageBuffer, referenceImageMimeType
    } = options

    console.log(`[Veo] Generating clip. Model: ${VERTEX_CONFIG.veoModel}`)
    console.log(`[Veo] Audio: ${withAudio ? 'ENABLED (Raw)' : 'DISABLED (Silent)'}, Ratio: ${aspectRatio}`)

    const client = await googleAuth.getClient()
    const accessToken = await client.getAccessToken()
    const token = accessToken.token || accessToken

    // Predict Long Running URL
    const predictUrl = `https://${VERTEX_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${VERTEX_CONFIG.projectId}/locations/${VERTEX_CONFIG.location}/publishers/google/models/${VERTEX_CONFIG.veoModel}:predictLongRunning`
    const fetchUrl = `https://${VERTEX_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${VERTEX_CONFIG.projectId}/locations/${VERTEX_CONFIG.location}/publishers/google/models/${VERTEX_CONFIG.veoModel}:fetchPredictOperation`

    const pollDelayMs = intFromEnv(process.env.VEO_POLL_DELAY_MS, 5000)
    const timeoutMs = intFromEnv(process.env.VEO_TIMEOUT_MS, 480000) // hard ceiling default 8 minutes
    const softTimeoutMsRaw = intFromEnv(process.env.VEO_SOFT_TIMEOUT_MS, 240000) // default 4 minutes
    const softTimeoutMs = Math.min(timeoutMs - pollDelayMs, softTimeoutMsRaw) // keep below hard cap
    const maxOperationAttempts = intFromEnv(process.env.VEO_MAX_OPERATION_ATTEMPTS, 2)

    console.log(`[Veo] Timing config -> pollDelayMs=${pollDelayMs}ms, softTimeoutMs=${softTimeoutMs}ms, timeoutMs=${timeoutMs}ms, maxOpAttempts=${maxOperationAttempts}`)

    const payloadBase: any = {
        instances: [{ prompt }],
        parameters: {
            aspectRatio,
            durationSeconds,
            generateAudio: withAudio
        }
    }

    if (referenceImageBuffer && referenceImageMimeType) {
        console.log('[Veo] Image-to-Video mode')
        payloadBase.instances[0].image = {
            bytesBase64Encoded: referenceImageBuffer.toString('base64'),
            mimeType: referenceImageMimeType
        }
    } else {
        console.log('[Veo] Text-to-Video mode')
    }

    if (seed !== undefined) payloadBase.parameters.seed = seed

    const runOneOperation = async (opIndex: number, promptVariant: string): Promise<Buffer> => {
        const payload = { ...payloadBase, instances: [{ ...payloadBase.instances[0], prompt: promptVariant }] }

        let operationName: string
        try {
            const res = await axios.post(predictUrl, payload, {
                headers: { Authorization: `Bearer ${token}` }
            })
            operationName = res.data.name
            console.log(`[Veo] Op started (attempt ${opIndex}/${maxOperationAttempts}):`, operationName)
            console.log(`[Veo] Payload summary:`, safeStringify({
                aspectRatio,
                durationSeconds,
                generateAudio: withAudio,
                hasReferenceImage: Boolean(referenceImageBuffer),
                seed
            }))
        } catch (error: any) {
            console.error('[VEO PREDICT ERROR]', error.response?.data || error.message)
            throw new Error(`Veo start failed: ${error.response?.status}`)
        }

        const maxAttempts = Math.ceil(timeoutMs / pollDelayMs)
        const startTime = Date.now()

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const elapsed = Date.now() - startTime
            if (elapsed > timeoutMs) throw new Error('Veo timeout exceeded')
            if (elapsed > softTimeoutMs) {
                console.warn(`[Veo] Soft-timeout reached at ${(elapsed / 1000).toFixed(1)}s, retrying with new operation`)
                throw new Error('Veo soft timeout — retrying new operation')
            }

            await new Promise(r => setTimeout(r, pollDelayMs))

            if (attempt % 5 === 0) {
                const minutes = (elapsed / 60000).toFixed(2)
                console.log(`[Veo] Polling op ${opIndex}, t=${minutes}m, attempt=${attempt}`)
            }

            try {
                const res = await axios.post(fetchUrl, { operationName }, {
                    headers: { Authorization: `Bearer ${token}` }
                })

                if (!res.data.done) {
                    const state = res.data?.metadata?.state || res.data?.state || 'running'
                    const progress = res.data?.metadata?.progressPercent ?? res.data?.metadata?.progress
                    if (attempt % 5 === 0) {
                        console.log(`[Veo] State=${state} progress=${progress ?? 'n/a'} op=${opIndex} attempt=${attempt}`)
                    }
                    continue
                }
                if (res.data.error) throw new Error(`Veo op failed: ${res.data.error.message}`)

                const video = res.data.response?.videos?.[0]
                if (!video) throw new Error('Veo completed but no video returned')

                // Safety check
                if (res.data.response.raiMediaFilteredCount > 0) {
                    console.error('[Veo] Blocked by safety filter (raiMediaFilteredCount > 0)')
                    const raiReason = res.data.response.raiMediaFilteredReasons?.[0] || 'policy violation'
                    throw new Error(`Content blocked by Floow AI safety filters: ${raiReason}`)
                }

                if (video.gcsUri) {
                    console.log(`[Veo] Downloading from GCS: ${video.gcsUri}`)
                    const match = video.gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
                    if (!match) throw new Error('Invalid GCS URI')
                    const [buffer] = await storage.bucket(match[1]).file(match[2]).download()
                    return buffer
                } else if (video.bytesBase64Encoded) {
                    console.log('[Veo] Received Base64 video')
                    return Buffer.from(video.bytesBase64Encoded, 'base64')
                }

                throw new Error('No video data found in response')

            } catch (err: any) {
                if (err.response?.status === 404) throw new Error('Veo operation not found (404)')
                if (attempt === maxAttempts) throw err
                console.warn('[Veo] Poll error, will retry poll:', err?.message || err)
                // transient error, continue
            }
        }

        throw new Error('Veo polling loop exited unexpectedly')
    }

    let lastError: any = null
    const promptVariants = [prompt, sanitizeVeoPrompt(prompt)]

    for (const variant of promptVariants) {
        for (let op = 1; op <= maxOperationAttempts; op++) {
            try {
                return await runOneOperation(op, variant)
            } catch (err: any) {
                lastError = err
                const isSoft = /soft timeout/i.test(err?.message || '')
                const isSensitive = /sensitive words|responsible ai/i.test(err?.message || '')
                console.warn(`[Veo] Operation attempt ${op} failed: ${err?.message || err}`)
                if (err?.response?.data) {
                    console.warn('[Veo] Error payload:', safeStringify(err.response.data))
                }
                if (isSensitive && variant !== promptVariants[promptVariants.length - 1]) {
                    console.warn('[Veo] Retrying with sanitized prompt variant due to sensitivity error')
                    break // move to next prompt variant
                }
                if (!isSoft || op === maxOperationAttempts) {
                    throw lastError
                }
                // retry with new operation id (soft timeout)
            }
        }
    }

    throw lastError || new Error('Veo generation failed')
}
