# Floow Worker System - Technical Summary

## Overview

The Floow Worker is a **video generation pipeline** that transforms text-based storyboards into UGC-style video ads. It operates as a **job queue processor** that claims rendering jobs, orchestrates multi-modal AI generation (images, video, audio), applies billing logic, and produces final MP4 files with optional watermarks.

**Core Flow**: Storyboard → Keyframes (Image AI) → Video Clips (Video AI) → Audio (TTS/Raw) → Concatenation → Watermark → Upload

---

## Architecture & Components

### Main Entry Point: `worker/index.ts`

**Worker Loop**:
- Polls database every 5s using `claim_job` RPC (atomic job claiming prevents race conditions)
- Supports concurrent job processing (configurable via `MAX_CONCURRENT_JOBS`, default: 1)
- Graceful shutdown on SIGINT/SIGTERM

**Job Processing Pipeline** (sequential per job):
1. **Data Fetch**: Retrieve storyboard, session, user, brief from Supabase
2. **Billing**: Atomic token deduction (prevents double-charging with ledger checks)
3. **Asset Preparation**: Download/generate avatar and product images
4. **Scene Classification**: AI-powered visual type detection (avatar vs product scenes)
5. **Generation Loop**: For each scene → Keyframe → Video → Audio → Merge
6. **Post-Processing**: Concatenate clips → Apply watermark (if free plan) → Upload to storage
7. **Cleanup**: Update job status to `done` or `failed`, refund tokens on failure

---

## Key Configuration Parameters

### Environment Variables

**Core Settings**:
- `MAX_CONCURRENT_JOBS` (default: 1) - Parallel job capacity
- `JOB_DELAY_MS` (default: 10000) - Delay between job polls
- `ENABLE_TTS` (default: true) - Toggle TTS generation (can force-enable for voiceover mode)

**AI Providers**:
- `GOOGLE_CLOUD_PROJECT_ID` - GCP project for Vertex AI
- `GOOGLE_CLOUD_REGION` (default: us-central1)
- `VERTEX_VIDEO_MODEL` (default: veo-3.1-fast-generate-preview)
- `VERTEX_IMAGE_MODEL` (default: imagen-4.0-ultra-generate-001)
- `HIGGSFIELD_API_KEY` / `HIGGSFIELD_API_KEY_SECRET` - Nano Banana Pro for keyframes
- `ELEVENLABS_API_KEY` - Voice synthesis

**Veo Timing Controls**:
- `VEO_POLL_DELAY_MS` (default: 5000) - Polling interval for video generation
- `VEO_SOFT_TIMEOUT_MS` (default: 240000 / 4min) - Retry with new operation after this
- `VEO_TIMEOUT_MS` (default: 480000 / 8min) - Hard failure threshold
- `VEO_MAX_OPERATION_ATTEMPTS` (default: 2) - Max retries per prompt variant

**Voice Defaults** (per language):
- `ELEVENLABS_DEFAULT_VOICE_EN` / `_EN_MALE` / `_EN_FEMALE`
- `ELEVENLABS_DEFAULT_VOICE_ES` / `_ES_MALE` / `_ES_FEMALE`

---

## Module Breakdown

### 1. `ai-providers.ts` - Multi-Modal AI Orchestration

**Keyframe Generation** (`generateKeyframe`):
- **Provider**: Higgsfield Nano Banana Pro (image_edit model)
- **Strategy**: Image-to-image editing using avatar/product references + prompt
- **Input**: Text prompt, optional style reference, base64 images or URLs, seed
- **Output**: PNG/JPEG buffer
- **Retry Logic**: Up to 8 retries with exponential backoff (5s → 60s)
- **Polling**: Async job status checks (max 120 attempts, 4s intervals, 5min timeout)
- **Fallback**: If no user images, uses `HIGGSFIELD_BASE_IMAGE_URL`

**Video Generation** (`generateVeoVideoClip`):
- **Provider**: Google Vertex AI Veo 3.1
- **Modes**:
  - `withAudio=true`: Raw mode (Veo generates speech from prompt)
  - `withAudio=false`: Silent mode (for voiceover overlay)
- **Features**: Image-to-video (keyframe reference), text-to-video, aspect ratio control (9:16)
- **Timing**: Soft timeout triggers new operation, hard timeout fails
- **Prompt Variants**: Tries original prompt, then sanitized version if sensitive content detected
- **Safety**: Checks `raiMediaFilteredCount` for policy violations
- **Output**: MP4 buffer (from GCS URI or base64)

**TTS Generation** (`generateTTS`):
- **Provider**: ElevenLabs Flash v2.5
- **Input**: Text, voice profile (voiceId, languageCode, settings)
- **Output**: MP3 buffer
- **Text Normalization**: Removes bullets, condenses whitespace, collapses excessive punctuation

### 2. `assets.ts` - Image Asset Management

**Function**: `ensureAvatarAndProductAssets`

**Responsibilities**:
- Fetch product image from `ad_assets` table (user upload)
- Fetch avatar image (3-tier priority):
  1. User-uploaded avatar (`avatar_image_url`)
  2. Existing character reference (`character_reference_url`)
  3. AI-generated character (if avatar scenes detected)
- Download images to buffers with MIME type detection
- Generate fallback character reference using `generateKeyframe` if needed
- Returns URLs + buffers for both avatar and product

**Character Generation Prompt**:
```
"Portrait of a friendly UGC content creator, neutral lighting, simple background, 
looking at camera, high quality, realistic, 9:16 vertical."
```

### 3. `scene-classifier.ts` - AI Scene Type Detection

**Function**: `classifyScenesByVisualType`

**Provider**: OpenAI GPT-4o
**Purpose**: Analyze storyboard and classify each scene as `avatar` or `product`
- **avatar**: Person speaking to camera (talking head)
- **product**: Product shots, b-roll, hands using product, voiceover over visuals

**Input**: Full storyboard JSON
**Output**: Saved to `render_jobs.scene_metadata` as:
```json
{
  "scenes": [
    { "index": 1, "scene_type": "avatar", "reason": "Creator speaking to camera" },
    { "index": 2, "scene_type": "product", "reason": "Product demo with voiceover" }
  ]
}
```

**Behavior**: Non-blocking (failures don't stop job), only runs if `visual_mode = 'mixed'`

### 4. `billing.ts` - Token Management

**Constants**:
- `TOKENS_PER_SCENE = 10`

**Functions**:

**`getUserPlan(userId)`**:
- Checks `user_subscriptions` table for active plan
- Validates status (`active`, `trialing`, `past_due`) and `current_period_end`
- Fallback to legacy `profiles.plan` field
- Returns plan ID (e.g., `'starter'`, `'free'`)

**`deductTokens(userId, amount, jobId)`**:
- Atomic RPC call: `deduct_tokens` (prevents double-charging)
- Checks ledger for existing deduction with same `job_id`
- Throws `INSUFFICIENT_TOKENS` error if balance too low
- Returns: `{ previous_balance, new_balance, deducted }`

**`refundTokens(userId, amount, jobId)`**:
- Atomic RPC call: `refund_tokens`
- Triggered on job failure (after successful deduction)
- Adds refund entry to `user_token_ledger`

**Watermark Logic**:
```javascript
const paidPlans = ['starter', 'growth', 'agency', 'pro', 'enterprise', 'business']
const needsWatermark = !paidPlans.has(normalizedPlan)
```

### 5. `tts.ts` - Voice Profile Resolution

**Language Support**:
- `en-US` (English, American accent)
- `es-ES` (Spanish, Madrid accent)
- `es-MX` (Spanish, Mexican accent)

**Voice Selection Logic** (`getAvatarVoiceForLanguage`):
1. Query `avatar_voice_profiles` table (avatar_id + base language)
2. Fallback to default voices (env vars) with gender matching:
   - Normalize gender from avatar metadata (`Hombre`/`Mujer`)
   - Prefer gendered voice, then neutral, then any available
3. Returns: `{ voiceId, languageCode, voiceSettings }`

**Normalization**:
- Strips to base language for DB lookups (es-MX → es)
- Preserves full locale for TTS accent/prosody guidance

### 6. `audio.ts` - Audio Processing Utilities

**Key Functions**:
- `hasAudioStream(filePath)`: Probe for audio track presence
- `replaceAudioWithNarration`: **Voiceover mode** - strip video audio, replace with TTS
  ```
  ffmpeg -i video.mp4 -i narration.mp3 -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest output.mp4
  ```
- `mixNarrationWithVideoAudio`: Mix TTS over video audio with ducking
- `extractAudioTrack`: Export WAV for STS (Speech-to-Speech) workflows
- `mixBackgroundMusic`: Layer background music (ducking if voice present)

### 7. `video-processing.ts` - Video Post-Production

**`concatVideos(clipPaths, outputPath)`**:
- Uses `ffmpeg.mergeToFile` for clip concatenation
- Validates all clips exist before processing
- 2-minute timeout with error handling

**`addWatermark(inputPath, outputPath)`**:
- Downloads watermark asset from Supabase storage (cached locally)
- Applies 30% opacity, centered overlay
- Complex filter: `format=rgba,colorchannelmixer=aa=0.3[wm]`
- Preserves audio, re-encodes video (libx264, CRF 18, yuv420p)

**`burnSubtitleIntoVideo`** (deprecated in favor of per-scene burning):
- Wraps text (32 chars/line), sanitizes for drawtext filter
- Positioned at bottom fifth of frame with shadow/border

### 8. `elevenlabs.ts` - Voice Synthesis Integration

**TTS Model**: `eleven_flash_v2_5` (fast, multilingual)
**STS Model**: `eleven_multilingual_sts_v2` (speech transformation)

**Text Normalization**:
- Remove bullet characters (`•`)
- Collapse excessive punctuation (`!!!` → `!`)
- Condense whitespace

**Voice Settings**:
```javascript
{
  stability: 0.65,
  similarity_boost: 0.75,
  style: 0.0
}
```

**STS Aggressive Settings** (for voice cloning):
```javascript
{
  stability: 0.9,
  similarity_boost: 1.0,
  use_speaker_boost: true
}
```

---

## Core Workflow Logic

### Audio Mode Decision Tree

**Brief Property**: `audio_mode` (raw | tts)

**Mapping**:
- `raw` → **Raw Mode**: Veo generates speech directly from prompt
- `tts` / `voiceover` → **Voiceover Mode**: Silent Veo + ElevenLabs TTS overlay

**Scene-Level Execution**:

**Voiceover Mode** (`audioMode = 'voiceover'`):
1. Generate silent video (`withAudio=false`)
2. Synthesize narration via ElevenLabs from `scene.spoken_text`
3. Replace video audio with TTS using `replaceAudioWithNarration`

**Raw Mode** (`audioMode = 'raw'`):
1. Build audio-aware Veo prompt with voice guidance:
   ```
   "Audio: avatar speaking to camera in Spanish with Mexican accent, 
   adult female voice, natural pacing, delivering: {script}"
   ```
2. Generate video with audio (`withAudio=true`)
3. Use Veo-generated audio directly (no TTS overlay)

### Visual Mode Strategy

**Brief Property**: `visual_mode` (mixed | avatar | product)

**Behavior**:
- `mixed`: Run GPT-4o classifier → dynamic scene types
- `avatar`: Force all scenes to use avatar reference
- `product`: Force all scenes to product-only shots

**Scene Type Impact**:
```javascript
const isAvatar = (scene_type === 'avatar' || role === 'talking_head')
```
- Avatar scenes: Use avatar image reference for keyframe
- Product scenes: Use product image reference for keyframe

### Retry & Fallback Strategy

**Veo Generation** (5 strategies, up to 5 attempts):

1. **S1_NORMAL_REF**: Original prompt + reference image
2. **S2_REGEN_KF_REF**: Regenerate keyframe with safe template + reference
3. **S3_DROP_REF**: Original prompt, no reference image
4. **S4_SAFE_PROMPT_NO_REF**: Sanitized prompt (removes special chars), no reference
5. **S5_PRODUCT_ONLY_NO_REF**: Generic product demo prompt

**Trigger Logic**:
- **Image Violation** (`isInputImageViolation`): Skip to S2 (regen keyframe)
- **Usage Guidelines** (`isUsageGuidelines`): **FAIL FAST** after 1 strike (content policy)
- **Soft Timeout**: Retry same strategy with new operation
- **Transient Errors** (503, deadline): Move to next strategy

**Attempts Logged**: All attempts saved to `scene_metadata.scenes[i].veo_attempts` for debugging

### Content Safety System

**Risky Keywords** (block list):
```javascript
['skate', 'trucos', 'salto', 'parkour', 'extremo', 'acrobacia', 
 'golpe', 'pelea', 'arma', 'lesión', 'daño']
```

**Moderation Flow**:
1. Check `visual` description for risky keywords
2. If detected, replace with safe template:
   - Avatar → "Vertical 9:16 talking-head, neutral background, studio lighting"
   - Product → "Vertical 9:16 b-roll, clean surface, premium ecommerce"

**Sensitive Content Softening**:
```javascript
'antes y después' → 'mostrando una mejora gradual'
'piel dañada' → 'piel sensible que va mejorando'
'manchas fuertes' → 'pequeñas imperfecciones'
'tratamiento médico' → 'cuidado cotidiano de bienestar'
'sexual/sensual' → 'estilo sobrio y completamente vestido'
```

**Prompt Sanitization**:
- Remove URLs, @handles, special chars (`<>`, quotes)
- Max length: 240 chars (Veo), 320 chars (keyframe)

### Scene Duration & Timing

**Fixed Duration**: 4 seconds per scene (hardcoded)
```javascript
const clipDurationSeconds = 4
```

**Rationale**: Short clips for TikTok/Instagram Reels style (total video ~12-20s for 3-5 scenes)

---

## Data Flow & State Management

### Job Lifecycle States

```
pending → processing → done / failed
```

**State Transitions**:
- `pending → processing`: Atomic via `claim_job` RPC (updates job + returns row in one transaction)
- `processing → done`: After successful upload to storage, sets `output_url`
- `processing → failed`: On any error, sets `error` field, triggers token refund

### Database Tables Used

**Read**:
- `render_jobs` - Job queue and status
- `storyboards` - Scene scripts and brief
- `ad_sessions` - User ID lookup
- `ad_assets` - Product images
- `ad_questionnaire` - Avatar references
- `avatars` - Avatar metadata (gender, age_style)
- `avatar_voice_profiles` - Language-specific voice IDs
- `user_subscriptions` - Active plan detection
- `user_token_balances` - Token availability
- `user_token_ledger` - Deduction history (double-charge prevention)

**Write**:
- `render_jobs` - Update status, output_url, error, scene_metadata
- `ad_questionnaire` - Save generated character_reference_url
- `user_token_ledger` - Deduction/refund entries (via RPC)

### Storage Operations

**Buckets**:
- `assets` - Keyframes, avatar/product images (user-scoped paths: `{userId}/{sessionId}/...`)
- `renders` - Final videos (`renders/{jobId}_final.mp4`)

**Access Patterns**:
- Upload with `upsert: true` (overwrites existing files)
- Public URLs via `storage.getPublicUrl()`

---

## Critical Performance & Cost Parameters

### Token Costs
- **10 tokens per scene** (fixed)
- Pre-deduction before generation starts
- Refunded on failure (atomic ledger operations prevent loss)

### API Call Sequence per Scene

1. **Keyframe**: 1x Higgsfield job (polling ~30-60s)
2. **Video**: 1-5x Veo operations (polling ~2-8 min each)
3. **TTS** (voiceover only): 1x ElevenLabs call (~1-3s)
4. **FFmpeg**: 1-2x local operations (audio merge, concat)

**Estimated Costs per Scene**:
- Higgsfield: ~$0.02-0.05 (image_edit)
- Veo 3.1: ~$0.10-0.30 (4s video)
- ElevenLabs: ~$0.002-0.005 (Flash v2.5, ~50 chars)
- **Total**: ~$0.12-0.35 per scene

### Timeout Budgets

**Per-Scene Generation**:
- Keyframe: 5 min max (Higgsfield polling)
- Video: 8 min max (hard timeout), 4 min soft timeout
- TTS: 2 retries, ~10s total

**Full Job**:
- 5 scenes: ~30-60 min worst case
- Concat + watermark: ~1-2 min
- **Total**: ~35-65 min for complex jobs

---

## Error Handling & Observability

### Failure Modes

**Insufficient Tokens**:
- Caught at deduction step
- Job fails immediately, no resources consumed
- Error message: "Insufficient tokens. Balance: X, Required: Y"

**Content Policy Violation**:
- **Fail Fast**: After 1 usage guideline strike (reduced from 3)
- User-facing message: "Contenido rechazado por filtros de seguridad..."
- Rationale: Free queue capacity quickly for other jobs

**Transient API Failures**:
- Retries with backoff (Higgsfield: 8 retries, Veo: 2 ops × 2 variants)
- Soft timeout triggers new operation (different operation_id)

**Asset Missing**:
- Product image: Continue (use avatar or generated reference)
- Avatar image: Generate character reference on-the-fly

### Logging & Debugging

**Console Logs**:
- Job lifecycle: `[Job ${id}] Processing started...`, `✅ DONE`, `❌ FAILED`
- Scene progress: `[Scene ${i+1}] Type: ${type}, IsAvatar: ${isAvatar}`
- API calls: `[Veo] Polling attempt ${attempt}`, `[TTS] ElevenLabs Flash v2.5`
- Costs: `[Billing] Deducted ${amount} tokens. Prev=${x} New=${y}`

**Debug Artifacts**:
- `scene_metadata.scenes[i].veo_attempts`: Full retry history with strategy IDs
- Support codes extracted from Veo errors: `Support codes: ${code}`

**External Logging** (embedded in worker):
```javascript
fetch('http://127.0.0.1:7242/ingest/...') // Agent log endpoint (non-blocking)
```

---

## Integration Points for Extension

### Adding New AI Providers

**Pattern**: Follow `ai-providers.ts` structure
1. Add config constants (API keys, model IDs)
2. Implement retry wrapper with exponential backoff
3. Return Buffer + MIME type
4. Update `generateKeyframe` or `generateVeoVideoClip` with provider switch

**Example**: Adding Runway Gen-3 for video
```typescript
export async function generateRunwayVideoClip(options: {...}) {
  return retryWithBackoff(async () => {
    // Start job, poll status, download result
    return { buffer, mimeType }
  })
}
```

### Adding New Audio Modes

**Current Modes**: `raw` (Veo audio), `voiceover` (TTS)

**To Add** (e.g., `music_only`, `hybrid`):
1. Extend `audioMode` type in worker
2. Add branch in scene generation loop:
   ```javascript
   if (audioMode === 'music_only') {
     // Generate silent video + add background music
   } else if (audioMode === 'hybrid') {
     // Mix Veo audio + TTS narration
   }
   ```
3. Update `audio.ts` with new mixing functions

### Adding New Visual Effects

**Current**: Watermark (free plans only)

**To Add** (e.g., transitions, filters, captions):
1. Add FFmpeg processing step after concat:
   ```javascript
   await applyTransitions(concatPath, transitionedPath)
   ```
2. Update `video-processing.ts` with filter chains
3. Expose config in brief (e.g., `transition_style: 'fade'`)

### Multi-Language Scene Scripts

**Current**: Single `target_language` for full job

**To Add**: Per-scene language switching
1. Extend storyboard schema: `scenes[i].language`
2. Resolve voice profile per scene:
   ```javascript
   const sceneVoice = await getAvatarVoiceForLanguage(
     supabase, avatarId, scene.language || targetLanguage, avatarVoiceMeta
   )
   ```
3. Update Veo prompt with per-scene language guide

---

## Known Limitations & Improvement Opportunities

### Current Constraints

1. **Fixed Scene Duration**: 4s per scene (no dynamic timing based on script length)
2. **No Background Music**: Infrastructure exists (`audio.ts`) but not integrated
3. **Single Keyframe per Scene**: No multi-shot scenes or camera movement
4. **Limited Error Recovery**: Some failures (e.g., all keyframe strategies exhausted) are terminal
5. **No Scene Caching**: Regenerating identical scenes repeats all API calls

### Recommended Enhancements

**Dynamic Scene Duration**:
```javascript
const estimatedDuration = Math.max(3, Math.ceil(narrationText.length / 12)) // ~12 chars/sec
```

**Smart Caching**:
- Hash scene content (visual + dialogue) → cache keyframes/clips
- Check `scene_cache` table before generation
- Save 80%+ API costs on retries/similar scenes

**Adaptive Quality Tiers**:
```javascript
const quality = plan === 'enterprise' ? 'ultra' : plan === 'growth' ? 'high' : 'standard'
// Map to Veo parameters (resolution, bitrate)
```

**Parallel Scene Generation**:
- Current: Sequential (scene 1 → scene 2 → ...)
- Proposed: Parallel (all scenes start together)
- Requires: Semaphore for API rate limits, shared temp directory with scene IDs

**Voice Cloning Workflow**:
- Add `brief.clone_voice_from_audio` (uploaded sample)
- Use ElevenLabs `speech-to-speech` for consistent voice across all scenes
- Fallback to TTS if STS quality insufficient

**Real-Time Progress Updates**:
```javascript
await supabase.from('render_jobs').update({
  progress: { current_scene: i + 1, total_scenes: scenes.length, stage: 'generating_video' }
}).eq('id', job.id)
```

**Subtitle Burning**:
- Re-enable `burnSubtitleIntoVideo` per scene (disabled in current version)
- Add brief option: `enable_captions: boolean`
- Generate ASR transcripts for raw mode (validate lip-sync accuracy)

---

## Configuration Summary Table

| Parameter | Default | Impact | Tuning Guidance |
|-----------|---------|--------|-----------------|
| `MAX_CONCURRENT_JOBS` | 1 | Worker throughput | Increase for multi-core servers (monitor API rate limits) |
| `VEO_SOFT_TIMEOUT_MS` | 240000 (4m) | Retry aggressiveness | Lower for faster failures, higher for patient retries |
| `VEO_MAX_OPERATION_ATTEMPTS` | 2 | Max retries per strategy | Increase for flaky content, decrease to free queue faster |
| `TOKENS_PER_SCENE` | 10 | Billing rate | Adjust based on scene complexity/cost analysis |
| `clipDurationSeconds` | 4 | Scene pacing | Make dynamic based on script length |
| `RETRY_CONFIG.MAX_RETRIES` | 8 | Keyframe retry count | Balance between success rate and latency |
| `MAX_POLICY_STRIKES` | 1 | Content violation tolerance | Keep at 1 for fast failure (free queue) |

---

## Quick Start for New AI Integration

**Example: Adding Luma Dream Machine for video generation**

1. **Add Config** (`worker/lib/ai-providers.ts`):
```typescript
const LUMA_CONFIG = {
  apiKey: process.env.LUMA_API_KEY || '',
  baseUrl: 'https://api.lumalabs.ai/v1'
}
```

2. **Implement Generator**:
```typescript
export async function generateLumaVideoClip(options: {
  prompt: string
  imageBuffer?: Buffer
}): Promise<Buffer> {
  // Start generation
  const res = await axios.post(`${LUMA_CONFIG.baseUrl}/generations`, {...})
  const generationId = res.data.id
  
  // Poll for completion
  while (true) {
    const status = await axios.get(`${LUMA_CONFIG.baseUrl}/generations/${generationId}`)
    if (status.data.state === 'completed') {
      return await downloadVideo(status.data.video_url)
    }
    await sleep(5000)
  }
}
```

3. **Update Worker** (`worker/index.ts`):
```typescript
const videoProvider = process.env.VIDEO_PROVIDER || 'veo' // veo | luma

const veoBuffer = videoProvider === 'luma'
  ? await generateLumaVideoClip({ prompt: veoPrompt, imageBuffer: keyframe })
  : await generateVeoVideoClip({ prompt: veoPromptWithAudio, ... })
```

---

## Summary for AI Agent Handoff

**What the Worker Does**:
- Converts storyboard JSON → MP4 video ads
- Orchestrates 3 AI systems (image, video, voice)
- Manages billing (token deduction/refund)
- Applies safety filters & content moderation
- Handles 2 audio modes (raw AI speech vs TTS voiceover)

**Key Extension Points**:
1. **New Video Provider**: Modify `ai-providers.ts` generator functions
2. **New Audio Mode**: Add branch in scene loop + audio processing function
3. **Visual Effects**: Insert FFmpeg step after concat
4. **Performance**: Implement scene caching, parallel generation
5. **Quality Tiers**: Map user plan → provider parameters

**Critical Data**:
- `TOKENS_PER_SCENE = 10` (adjust if adding heavy features)
- Scene duration = 4s fixed (should be dynamic)
- Veo timeout = 4m soft / 8m hard (tune based on success rate)

**Testing Strategy**:
- Unit test individual modules (TTS, keyframe, video generation)
- Integration test: Mock Supabase + AI APIs
- End-to-end test: 1-scene job → verify MP4 output
- Load test: Concurrent jobs with rate limiting

This system is production-ready but optimized for **sequential processing**. Main opportunities: **parallelization**, **caching**, and **dynamic scene timing**.
