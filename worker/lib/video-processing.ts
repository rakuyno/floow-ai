import * as fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

export type TextOverlay = {
    sceneIndex: number
    text: string
    position: 'top' | 'center' | 'bottom'
    style: 'big_caption' | 'small_subtitle'
}

export function generateOverlaysFromScript(scenes: any[]): TextOverlay[] {
    return scenes.map((scene, index) => ({
        sceneIndex: index,
        text: scene.overlay_text || scene.visual || '', // Use overlay_text if available, else visual summary
        position: 'bottom' as const,
        style: 'big_caption' as const
    })).filter(o => o.text && o.text.length > 0)
}

function wrapSubtitle(text: string, maxLine = 32): string {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''

    for (const w of words) {
        const candidate = (current ? current + ' ' : '') + w
        if (candidate.length > maxLine) {
            if (current) lines.push(current)
            current = w
        } else {
            current = candidate
        }
    }
    if (current) lines.push(current)
    return lines.join('\n')
}

export async function burnSubtitleIntoVideo({
    inputVideoPath,
    text,
    outputPath
}: {
    inputVideoPath: string
    text: string
    outputPath: string
}): Promise<void> {
    return new Promise((resolve, reject) => {
        // Use full text with wrapping, no truncation
        const wrappedText = wrapSubtitle(text)
        console.log(`[VIDEO] Burning subtitle (wrapped): \n${wrappedText}`)

        // Sanitize text for drawtext
        // Escape special characters: : \ '
        const sanitizedText = wrappedText
            .replace(/\\/g, '\\\\')
            .replace(/:/g, '\\:')
            .replace(/'/g, "'\\\\''")

        // Construct filter string manually to avoid type issues
        // drawtext=text='...':fontsize=24:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h-(h/5):shadowcolor=black:shadowx=2:shadowy=2
        const filterString = `drawtext=text='${sanitizedText}':fontsize=24:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h-(h/5):shadowcolor=black:shadowx=2:shadowy=2`

        ffmpeg(inputVideoPath)
            .videoFilters(filterString)
            .outputOptions('-c:a copy')
            .save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => {
                console.error('[VIDEO] Subtitle burn failed:', err)
                // Fallback: just copy if drawtext fails (e.g. missing font)
                fs.copyFileSync(inputVideoPath, outputPath)
                resolve()
            })
    })
}

export async function mergeVideoAndAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`[VIDEO] Merging video + audio: ${videoPath} + ${audioPath}`)

        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions([
                '-c:v copy', // Copy video stream without re-encoding
                '-c:a aac',  // Encode audio to AAC
                '-shortest'  // Finish when shortest input ends (usually video)
            ])
            .save(outputPath)
            .on('end', () => {
                console.log(`[VIDEO] Merge complete: ${outputPath}`)
                resolve()
            })
            .on('error', (err) => {
                console.error('[VIDEO] Merge failed:', err)
                reject(err)
            })
    })
}

export async function renderTextOverlays({
    inputVideoPath,
    overlays,
    outputPath
}: {
    inputVideoPath: string
    overlays: TextOverlay[]
    outputPath: string
}): Promise<void> {
    // Placeholder - we are now doing per-scene burning
    console.log('[VIDEO] renderTextOverlays called (deprecated in favor of per-scene burning)')
    fs.copyFileSync(inputVideoPath, outputPath)
}

export async function concatVideos(videoPaths: string[], outputPath: string): Promise<void> {
    console.log(`[VIDEO] Concatenating ${videoPaths.length} clips...`)
    console.log(`[VIDEO] Output path: ${outputPath}`)

    // Check all input files exist
    for (let i = 0; i < videoPaths.length; i++) {
        const p = videoPaths[i]
        console.log(`[VIDEO] Checking clip ${i + 1}/${videoPaths.length}: ${p}`)
        if (!fs.existsSync(p)) {
            const error = `Missing clip file: ${p}`
            console.error(`[VIDEO] ${error}`)
            throw new Error(error)
        }
        const stats = fs.statSync(p)
        console.log(`[VIDEO] Clip ${i + 1} size: ${stats.size} bytes`)
    }

    const CONCAT_TIMEOUT_MS = 120000 // 2 minutes timeout

    return new Promise((resolve, reject) => {
        let resolved = false
        const timeoutHandle = setTimeout(() => {
            if (!resolved) {
                resolved = true
                const err = new Error('Concatenation timed out')
                console.error(`[VIDEO] ${err.message}`)
                reject(err)
            }
        }, CONCAT_TIMEOUT_MS)

        const cmd = ffmpeg()

        // Add inputs
        videoPaths.forEach(p => cmd.input(p))

        // Set complex filter for safer concatenation (handles different audio layouts better than mergeToFile sometimes)
        // But mergeToFile is simpler. Let's start with mergeToFile which is standard for fluent-ffmpeg.
        // If that fails we can use complex filter. For now, mergeToFile is usually robust enough for same-source clips.

        cmd.on('end', () => {
            if (resolved) return
            resolved = true
            clearTimeout(timeoutHandle)
            console.log(`[VIDEO] ✅ Concatenation complete: ${outputPath}`)
            resolve()
        })
            .on('error', (err) => {
                if (resolved) return
                resolved = true
                clearTimeout(timeoutHandle)
                console.error(`[VIDEO] ❌ Concatenation failed:`, err)
                reject(err)
            })
            .mergeToFile(outputPath, fs.existsSync(path.dirname(outputPath)) ? path.dirname(outputPath) : '/tmp')
    })
}

export async function addWatermark(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`[VIDEO] Adding watermark to ${inputPath}`)

        // Watermark text
        const text = "CREATED WITH ANUNCIOS UGC"

        // Draw text in center with some opacity
        // escaping single quotes: ' -> '\'', : -> \:
        const filterString = `drawtext=text='${text}':fontsize=36:fontcolor=white@0.5:x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black@0.5:shadowx=2:shadowy=2`

        ffmpeg(inputPath)
            .videoFilters(filterString)
            .outputOptions('-c:a copy')
            .save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => {
                console.error('[VIDEO] Watermark failed:', err)
                // Fallback: copy without watermark
                try {
                    fs.copyFileSync(inputPath, outputPath)
                } catch (copyErr) {
                    console.error('[VIDEO] Fallback copy failed:', copyErr)
                    reject(err)
                    return
                }
                resolve()
            })
    })
}

