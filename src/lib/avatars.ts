import { createClient } from '@/lib/supabase/client'

export interface Avatar {
    id: string
    name: string
    image_url: string
    is_default: boolean
    owner_user_id: string | null
    default_voice_id?: string
    gender?: string
    age_style?: string
    style_tags?: string[]
    voice_language?: string
}

export interface AvatarFilters {
    gender?: string
    age_style?: string
    voice_language?: string
    search?: string
}

export async function fetchAvailableAvatars(): Promise<Avatar[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false }) // System avatars first
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching avatars:', error)
        return []
    }

    return data as Avatar[]
}

export async function fetchAvatarsWithFilters(filters: AvatarFilters): Promise<Avatar[]> {
    const supabase = createClient()

    let query = supabase
        .from('avatars')
        .select('*')
        .eq('is_active', true)

    // Apply gender filter
    if (filters.gender && filters.gender !== 'todos') {
        query = query.eq('gender', filters.gender)
    }

    // Apply age filter
    if (filters.age_style && filters.age_style !== 'todos') {
        query = query.eq('age_style', filters.age_style)
    }

    // Apply voice/language filter
    if (filters.voice_language && filters.voice_language !== 'todos') {
        query = query.eq('voice_language', filters.voice_language)
    }

    // Order results
    query = query
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
        console.error('Error fetching avatars with filters:', error)
        return []
    }

    let results = data as Avatar[]

    // Apply search filter (client-side for simplicity)
    if (filters.search && filters.search.trim()) {
        const searchLower = filters.search.toLowerCase()
        results = results.filter(avatar =>
            avatar.name.toLowerCase().includes(searchLower)
        )
    }

    return results
}

export async function uploadUserAvatar(
    file: File,
    userId: string,
    metadata?: {
        name?: string
        gender?: string
        age_style?: string
        style_tags?: string[]
        voice_language?: string
    }
): Promise<Avatar | null> {
    const supabase = createClient()

    // 1. Upload image
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

    if (uploadError) {
        console.error('Error uploading avatar image:', uploadError)
        throw uploadError
    }

    const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

    // 2. Create avatar record
    const { data: avatar, error: dbError } = await supabase
        .from('avatars')
        .insert({
            owner_user_id: userId,
            name: metadata?.name || 'Mi Avatar',
            image_url: publicUrl,
            is_default: false,
            is_active: true,
            default_voice_id: 'female_es',
            gender: metadata?.gender || 'neutral',
            age_style: metadata?.age_style || '30s',
            style_tags: metadata?.style_tags || ['casual'],
            voice_language: metadata?.voice_language || 'es-ES'
        })
        .select()
        .single()

    if (dbError) {
        console.error('Error creating avatar record:', dbError)
        throw dbError
    }

    return avatar as Avatar
}

