import { SupabaseClient } from '@supabase/supabase-js'
import axios from 'axios'
import { generateKeyframe } from './ai-providers'

export interface JobAssets {
    avatarImageBuffer: Buffer | null
    avatarImageMimeType: string | null
    productImageBuffer: Buffer | null
    productImageMimeType: string | null
    productImageUrl: string | null
    avatarImageUrl: string | null
}

export async function ensureAvatarAndProductAssets(
    job: any,
    supabase: SupabaseClient,
    scenes: any[],
    sceneMetadata: any[]
): Promise<JobAssets> {
    console.log(`[ASSETS] Ensuring assets for Job ${job.id}...`)

    // 1. Fetch Product Image
    const { data: assetsData } = await supabase
        .from('ad_assets')
        .select('storage_path')
        .eq('session_id', job.session_id)
        .eq('type', 'image')
        .limit(1)

    let productImageUrl: string | null = null
    let productImageBuffer: Buffer | null = null
    let productImageMimeType: string | null = null

    if (assetsData && assetsData.length > 0) {
        const { data: { publicUrl } } = supabase.storage
            .from('assets')
            .getPublicUrl(assetsData[0].storage_path)
        productImageUrl = publicUrl

        try {
            console.log(`[ASSETS] Downloading product image from ${productImageUrl}...`)
            const response = await axios.get(productImageUrl, { responseType: 'arraybuffer' })
            productImageBuffer = Buffer.from(response.data)
            productImageMimeType = (response.headers['content-type'] as string | undefined)?.split(';')[0] || 'image/jpeg'
            console.log(`[ASSETS] Product image downloaded. Size: ${productImageBuffer.length} bytes`)
        } catch (error: any) {
            console.warn(`[ASSETS] Failed to download product image:`, error.message)
        }
    }

    // 2. Fetch Avatar/Character Reference
    const { data: questionnaireData } = await supabase
        .from('ad_questionnaire')
        .select('avatar_image_url, character_reference_url')
        .eq('session_id', job.session_id)
        .single()

    const avatarImageUrl = questionnaireData?.avatar_image_url || null
    let characterReferenceUrl = questionnaireData?.character_reference_url || null
    let avatarImageBuffer: Buffer | null = null
    let avatarImageMimeType: string | null = null

    // Priority 1: User Uploaded Avatar
    if (avatarImageUrl) {
        try {
            console.log(`[ASSETS] Downloading user avatar from ${avatarImageUrl}...`)
            const response = await axios.get(avatarImageUrl, { responseType: 'arraybuffer' })
            avatarImageBuffer = Buffer.from(response.data)
            avatarImageMimeType = (response.headers['content-type'] as string | undefined)?.split(';')[0] || 'image/jpeg'
            console.log(`[ASSETS] User avatar downloaded. Size: ${avatarImageBuffer.length} bytes`)
        } catch (error: any) {
            console.warn(`[ASSETS] Failed to download user avatar:`, error.message)
        }
    }
    // Priority 2: Existing Character Reference in DB
    else if (characterReferenceUrl) {
        try {
            console.log(`[ASSETS] Downloading existing character reference from ${characterReferenceUrl}...`)
            const response = await axios.get(characterReferenceUrl, { responseType: 'arraybuffer' })
            avatarImageBuffer = Buffer.from(response.data)
            avatarImageMimeType = (response.headers['content-type'] as string | undefined)?.split(';')[0] || 'image/jpeg'
            console.log(`[ASSETS] Character reference downloaded. Size: ${avatarImageBuffer.length} bytes`)
        } catch (error: any) {
            console.warn(`[ASSETS] Failed to download character reference:`, error.message)
        }
    }
    // Priority 3: Generate New Character Reference
    else {
        // Check if we need a character (are there avatar scenes?)
        const hasAvatarScenes = scenes.some((s: any, idx: number) => {
            const meta = sceneMetadata.find((m: any) => m.index === idx + 1) || {}
            const type = meta.scene_type || 'avatar'
            return type === 'avatar' || type === 'mixed' || s.role === 'talking_head'
        })

        if (hasAvatarScenes) {
            console.log(`[ASSETS] No avatar/reference found. Generating NEW character reference...`)
            try {
                const jobSeed = Math.floor(Math.random() * 1000000)
                const characterPrompt = "Portrait of a friendly UGC content creator, neutral lighting, simple background, looking at camera, high quality, realistic, 9:16 vertical."

                const charResult = await generateKeyframe(characterPrompt, undefined, {}, jobSeed)

                avatarImageBuffer = charResult.buffer
                avatarImageMimeType = charResult.mimeType
                console.log(`[ASSETS] Character reference generated. Size: ${avatarImageBuffer.length} bytes`)

                // Upload to storage
                const charRefPath = `${job.session_id}/character_reference_${Date.now()}.jpg`
                const { error: uploadError } = await supabase.storage.from('assets').upload(
                    charRefPath,
                    avatarImageBuffer,
                    { contentType: 'image/jpeg', upsert: true }
                )

                if (uploadError) throw uploadError

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(charRefPath)
                characterReferenceUrl = publicUrl

                // Save to DB for future use
                await supabase.from('ad_questionnaire')
                    .update({ character_reference_url: characterReferenceUrl })
                    .eq('session_id', job.session_id)

                console.log(`[ASSETS] Created character_reference at ${characterReferenceUrl}`)

            } catch (error: any) {
                console.warn(`[ASSETS] Failed to generate character reference:`, error.message)
            }
        } else {
            console.log('[ASSETS] No avatar scenes detected, skipping avatar generation.')
        }
    }

    return {
        avatarImageBuffer,
        avatarImageMimeType,
        productImageBuffer,
        productImageMimeType,
        productImageUrl,
        avatarImageUrl
    }
}
