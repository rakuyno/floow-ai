import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SessionRedirectPage({ params }: { params: { id: string } }) {
    const supabase = createClient()

    // Check if storyboard exists
    const { data: storyboard } = await supabase
        .from('storyboards')
        .select('id')
        .eq('session_id', params.id)
        .single()

    if (storyboard) {
        redirect(`/app/session/${params.id}/storyboard`)
    } else {
        redirect(`/app/session/${params.id}/questionnaire`)
    }
}
