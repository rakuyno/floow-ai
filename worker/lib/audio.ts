import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

export type MusicMood = 'generic' | 'energetic' | 'calm' | 'luxury'

export async function hasAudioStream(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) {
                return reject(err)
            }
            const hasAudio = (data.streams || []).some(stream => stream.codec_type === 'audio')
            resolve(hasAudio)
        })
    })
}

export async function extractAudioTrack({
    inputVideoPath,
    outputAudioPath
}: {
    inputVideoPath: string
    outputAudioPath: string
}): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log('[AUDIO] Extracting audio track for STS...')
        ffmpeg()
            .input(inputVideoPath)
            .noVideo()
            .audioCodec('pcm_s16le')
            .audioFrequency(44100)
            .audioChannels(1)
            .format('wav')
            .save(outputAudioPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
    })
}

export async function getAudioStreamInfo(filePath: string): Promise<{ codec?: string; channels?: number; sample_rate?: number; duration?: number }> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) {
                return reject(err)
            }
            const audioStream = (data.streams || []).find(stream => stream.codec_type === 'audio')
            resolve({
                codec: audioStream?.codec_name,
                channels: audioStream?.channels,
                sample_rate: audioStream?.sample_rate ? Number(audioStream.sample_rate) : undefined,
                duration: audioStream?.duration ? Number(audioStream.duration) : undefined
            })
        })
    })
}

export async function pickBackgroundMusicForJob(job: any): Promise<{ audioUrl: string | null; mood: MusicMood }> {
    // TODO: Implement DB lookup
    // For now, return null or a placeholder if you have one locally
    // Returning null means no music for now unless we have a file
    return { audioUrl: null, mood: 'generic' }
}

export async function mixBackgroundMusic({
    inputVideoPath,
    musicPath,
    outputPath,
    hasVoice
}: {
    inputVideoPath: string
    musicPath: string
    outputPath: string
    hasVoice: boolean
}): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`[AUDIO] Mixing background music... Has Voice: ${hasVoice}`)

        if (!fs.existsSync(musicPath)) {
            console.warn('[AUDIO] Music file not found, skipping mix')
            fs.copyFileSync(inputVideoPath, outputPath)
            resolve()
            return
        }

        const volume = hasVoice ? 0.1 : 0.3 // Lower volume if voice exists (ducking)

        ffmpeg()
            .input(inputVideoPath)
            .input(musicPath)
            .complexFilter([
                `[1:a]volume=${volume}[music]`,
                `[0:a][music]amix=inputs=2:duration=first[aout]`
            ])
            .outputOptions([
                '-map 0:v',
                '-map [aout]',
                '-c:v copy',
                '-c:a aac',
                '-shortest'
            ])
            .save(outputPath)
            .on('end', () => {
                console.log('[AUDIO] Music mix completed')
                resolve()
            })
            .on('error', (err) => {
                console.error('[AUDIO] Music mix failed:', err)
                reject(err)
            })
    })
}

export async function replaceAudioWithNarration({
    videoPath,
    narrationPath,
    outputPath
}: {
    videoPath: string
    narrationPath: string
    outputPath: string
}): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`[AUDIO] Replacing video audio with narration...`)

        ffmpeg()
            .input(videoPath)
            .input(narrationPath)
            .outputOptions([
                '-c:v copy',
                '-c:a aac',
                '-map 0:v:0',
                '-map 1:a:0',
                '-shortest'
            ])
            .save(outputPath)
            .on('end', () => {
                console.log('[AUDIO] Narration replace completed')
                resolve()
            })
            .on('error', (err) => {
                console.error('[AUDIO] Narration replace failed:', err)
                reject(err)
            })
    })
}

export async function mixNarrationWithVideoAudio({
    videoPath,
    narrationPath,
    outputPath,
    narrationVolume = 1.0,
    originalVolume = 0.35
}: {
    videoPath: string
    narrationPath: string
    outputPath: string
    narrationVolume?: number
    originalVolume?: number
}): Promise<void> {
    const videoHasAudio = await hasAudioStream(videoPath)

    return new Promise((resolve, reject) => {
        console.log(`[AUDIO] Mixing narration with original audio (has audio: ${videoHasAudio})...`)

        const filters = videoHasAudio
            ? [
                `[0:a]volume=${originalVolume}[orig]`,
                `[1:a]volume=${narrationVolume}[narr]`,
                `[orig][narr]amix=inputs=2:duration=first:dropout_transition=2[aout]`
            ]
            : [
                `[1:a]volume=${narrationVolume}[aout]`
            ]

        ffmpeg()
            .input(videoPath)
            .input(narrationPath)
            .complexFilter(filters)
            .outputOptions([
                '-map 0:v:0',
                '-map [aout]',
                '-c:v copy',
                '-c:a aac',
                '-shortest'
            ])
            .save(outputPath)
            .on('end', () => {
                console.log('[AUDIO] Narration mix completed')
                resolve()
            })
            .on('error', (err) => {
                console.error('[AUDIO] Narration mix failed:', err)
                reject(err)
            })
    })
}
