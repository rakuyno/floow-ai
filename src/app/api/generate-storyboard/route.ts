import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { adjustUserTokens } from '@/lib/tokens'

// Initialize Supabase Admin Client (Service Role) for token adjustments
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
    try {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
        }

        const openai = new OpenAI({ apiKey })

        const {
            session_id,
            product_name,
            target_users,
            selling_points,
            offer,
            cta,
            style_notes,
            video_type,
            audio_mode,
            avatar_image_url,
            avatar_id,
            video_mode,
            num_scenes = 4, // Default to 4 if not provided
            reference_script = null, // Optional reference script from user
            target_language = 'es',
            feedback = '' // Optional improvement feedback from user
        } = await req.json()

        if (!session_id) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
        }

        // 1. Get authenticated user from cookies (Next.js approach)
        // First, we need to get user_id from the session_id since cookies aren't available in App Router API routes
        // Let's query the session to get the user_id
        const { data: sessionData, error: sessionError } = await supabaseAdmin
            .from('ad_sessions')
            .select('user_id')
            .eq('id', session_id)
            .single()

        if (sessionError || !sessionData) {
            console.error('Error fetching session:', sessionError)
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        const user = { id: sessionData.user_id }

        // 2. Calculate Token Cost (simplified - no subtitles)
        const tokensPerScene = 10 // Fixed cost per scene
        const totalTokensNeeded = num_scenes * tokensPerScene

        // 3. Deduct Tokens
        const deduction = await adjustUserTokens(
            supabaseAdmin,
            user.id,
            -totalTokensNeeded,
            `generation_${audio_mode === 'raw' ? 'raw' : 'tts'}`,
            { session_id, num_scenes, video_type }
        )

        if (!deduction.success) {
            return NextResponse.json({
                error: 'Insufficient tokens',
                details: deduction.error
            }, { status: 402 }) // Payment Required
        }

        const targetLanguageNormalized = (target_language || 'es').toLowerCase() === 'en' ? 'en' : 'es'
        const languageLabel = targetLanguageNormalized === 'en' ? 'ENGLISH' : 'SPANISH'
        const voiceoverVisualRule = audio_mode === 'voiceover'
            ? `- Si audio_mode es "voiceover" (voz en off), NO describas al avatar moviendo la boca ni "hablando". En esas escenas, el avatar debe mirar a cámara o reaccionar/posar mientras escucha la narración en off (labios relajados, sin lip-sync).\n`
            : ''

        // 4. Build System Prompt (language-aware)
        const systemPrompt = `Eres un guionista experto en anuncios UGC para ecommerce. Generas guiones claros, directos y efectivos para anuncios verticales.

REGLAS GENERALES:
- Devuelves ÚNICAMENTE JSON válido sin texto adicional.
- Todo el contenido debe estar en ${languageLabel}.
- Debes generar EXACTAMENTE el número de escenas indicado por el usuario.
- Cada escena dura aproximadamente 3–4 segundos.
- "spoken_text" es obligatorio en TODAS las escenas.
- "spoken_text" debe ser natural, breve, máximo 10–12 palabras.
- "spoken_text" es exactamente lo que se dirá (sin comillas, sin emojis, sin notas).
- NO inventes datos fuera del brief.
- NO mezcles idiomas ni cambies de idioma entre escenas.
- NO generes texto vacío.
- Prepara "spoken_text" para que se lea bien en voz (evita símbolos raros y escribe cifras, fechas y porcentajes de forma clara).
${voiceoverVisualRule}\

ROLES PERMITIDOS:
- "talking_head": avatar hablando a cámara.
- "voiceover_broll": planos de producto con voz en off.

FONDO (background_style):
- Devuelve por escena un campo background_style con uno de: "home", "professional", "street", "outdoor", "studio".
  - home: interiores cálidos/cotidianos.
  - professional/studio: set de grabación o ambiente cuidado.
  - street/outdoor: exterior urbano, parque, playa, etc.
- Mantén consistencia de fondo entre escenas salvo que una escena requiera explícitamente otro ambiente por la narrativa del anuncio.

FORMATO JSON ESTRICTO:
{
  "scenes": [
    {
      "index": 1,
      "title": "Título corto",
      "visual": "Descripción de lo que se ve",
      "spoken_text": "Frase que se dirá",
      "role": "talking_head" | "voiceover_broll",
      "duration": 4,
      "camera_style": "selfie" | "mid-shot" | "close-up" | "product-detail",
      "on_screen_text": "Texto opcional",
      "notes": "Notas opcionales"
    }
  ]
}

ANTES DE RESPONDER:
- Verifica que scenes.length es EXACTAMENTE el número solicitado.
- Verifica que TODAS las escenas tienen spoken_text no vacío.
- Verifica que todo está en ${languageLabel === 'ENGLISH' ? 'inglés' : 'español'}.
- Verifica que el JSON es válido.`

        // 5. Build Video Type Instructions
        let videoTypeInstruction = ""
        if (video_type === 'product_only') {
            videoTypeInstruction = `TODAS las escenas deben ser role: "voiceover_broll" (solo producto, sin cara a cámara).`
        } else if (video_type === 'avatar_only') {
            videoTypeInstruction = `TODAS las escenas deben ser role: "talking_head" (avatar hablando a cámara).`
        } else {
            videoTypeInstruction = `Mezcla de "talking_head" y "voiceover_broll" (ejemplo: escena 1 talking, escena 2 broll, etc.).`
        }

        // 6. Build Brief Data
        const briefData = {
            product_name,
            target_users,
            selling_points,
            offer,
            cta,
            style_notes,
            video_type,
            audio_mode: audio_mode || 'raw',
            avatar_image_url,
            avatar_id,
            video_mode,
            num_scenes,
            reference_script: reference_script || null,
            target_language: targetLanguageNormalized
        }

        // 7. Build User Prompt (CONTENT ONLY)
        const userPrompt = `BRIEF DEL ANUNCIO (JSON):
${JSON.stringify(briefData, null, 2)}

GUION DE REFERENCIA DEL USUARIO (OPCIONAL):
${reference_script ? reference_script : "Ninguno"}

FEEDBACK DEL USUARIO PARA MEJORAR EL GUION (OPCIONAL):
${feedback && feedback.trim() !== '' ? feedback : 'Sin feedback adicional'}

INSTRUCCIONES SI EXISTE GUION DE REFERENCIA:
- Úsalo como inspiración de ritmo, estilo y vibe.
- NO copies frases textuales.
- NO repitas palabra por palabra.
- Adáptalo completamente al producto y contexto actual.

INSTRUCCIONES SI HAY FEEDBACK:
- Reescribe el guion aplicando el feedback punto por punto.
- Mantén el número de escenas y el formato JSON solicitado.
- No introduzcas datos nuevos que no estén en el brief original.

DATOS TÉCNICOS:
- Número de escenas: ${num_scenes}
- Tipo de vídeo: ${video_type}
- Modo de audio: ${audio_mode}
- Idioma objetivo: ${languageLabel}
- No hagas traducciones ni mezcles idiomas (todo en ${languageLabel}).

INSTRUCCIONES SEGÚN TIPO DE VÍDEO:
${videoTypeInstruction}

OBJETIVO:
Genera un guion UGC en formato JSON siguiendo TODAS las reglas del systemPrompt aplicadas al brief.`

        // 8. Call OpenAI
        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: 'gpt-4-turbo-preview',
            response_format: { type: 'json_object' },
        })

        const content = completion.choices[0].message.content
        if (!content) throw new Error('No content from OpenAI')

        // 9. Parse and Validate Response
        const result = JSON.parse(content)

        // Validate scene count
        if (!result.scenes || !Array.isArray(result.scenes)) {
            throw new Error('Invalid response: "scenes" must be an array')
        }

        if (result.scenes.length !== num_scenes) {
            throw new Error(
                `AI returned ${result.scenes.length} scenes but expected exactly ${num_scenes}. ` +
                `Please try again.`
            )
        }

        // Validate each scene has spoken_text
        const scenesWithoutSpokenText = result.scenes.filter((scene: any, index: number) =>
            !scene.spoken_text || scene.spoken_text.trim() === ''
        )

        if (scenesWithoutSpokenText.length > 0) {
            const invalidIndexes = scenesWithoutSpokenText.map((s: any) => s.index || 'unknown').join(', ')
            throw new Error(
                `Validation failed: ${scenesWithoutSpokenText.length} scene(s) missing spoken_text ` +
                `(indexes: ${invalidIndexes}). Please try again.`
            )
        }

        // Map to ensure backward compatibility (add 'dialogue' field)
        const finalStoryboard = result.scenes.map((scene: any) => ({
            ...scene,
            dialogue: scene.spoken_text, // Map spoken_text to dialogue for frontend/worker compatibility
            background_style: scene.background_style || null
        }))

        // 10. Save to database (upsert to allow regenerations)
        const { error } = await supabaseAdmin.from('storyboards').upsert({
            session_id,
            summary: `Anuncio ${video_type} para ${product_name}`,
            brief: JSON.stringify(briefData),
            storyboard: finalStoryboard,
            updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' })

        if (error) throw error

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Error generating storyboard:', error)
        return NextResponse.json({
            error: error.message,
            details: error.stack
        }, { status: 500 })
    }
}
