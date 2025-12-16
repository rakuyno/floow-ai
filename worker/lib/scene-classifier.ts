import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Ensure env vars are loaded if this file is imported directly
if (!process.env.OPENAI_API_KEY) {
    dotenv.config({ path: path.join(process.cwd(), '.env.local') })
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface SceneClassification {
    index: number
    scene_type: 'avatar' | 'product'
    reason: string
}

export async function classifyScenesByVisualType(jobId: string, storyboard: any): Promise<void> {
    console.log(`[SceneClassifier] Classifying scenes for job ${jobId}...`)

    try {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY not configured')
        }

        const openai = new OpenAI({ apiKey })

        const systemPrompt = `Eres un asistente que clasifica escenas de anuncios UGC.
        Analiza el guion y clasifica cada escena visualmente como:
        - "avatar": Se ve principalmente a una persona/creador hablando a cámara (talking head).
        - "product": Se ve principalmente el producto, manos usándolo, o b-roll sin cara hablando.

        IMPORTANTE: NO existe el tipo "mixed".
        - Si hay una mezcla, decide cuál es el elemento dominante.
        - Si el creador habla a cámara, es "avatar".
        - Si es voz en off sobre imágenes, es "product".

        Devuelve un JSON válido con la estructura solicitada.`

        const userPrompt = `Guion del Anuncio:
        ${JSON.stringify(storyboard, null, 2)}

        Clasifica cada escena.
        Output JSON format:
        {
            "scenes": [
                { "index": number, "scene_type": "avatar" | "product", "reason": "breve explicación" }
            ]
        }`

        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: 'gpt-4o', // Using gpt-4o as requested
            response_format: { type: 'json_object' }
        })

        const content = completion.choices[0].message.content
        if (!content) throw new Error('No content from OpenAI')

        const result = JSON.parse(content)

        // Validate result structure roughly
        if (!result.scenes || !Array.isArray(result.scenes)) {
            throw new Error('Invalid JSON structure from classifier')
        }

        console.log(`[SceneClassifier] Classification complete. Saving to DB...`)

        // Save to database
        const { error } = await supabase
            .from('render_jobs')
            .update({
                scene_metadata: result
            })
            .eq('id', jobId)

        if (error) throw error

        console.log(`[SceneClassifier] Saved scene_metadata for job ${jobId}`)

    } catch (error: any) {
        console.error(`[SceneClassifier] Error classifying scenes for job ${jobId}:`, error.message)
        // We do NOT throw here, as we don't want to stop the whole job if classification fails
        // The job will continue with scene_metadata as null (or whatever it was)
    }
}
