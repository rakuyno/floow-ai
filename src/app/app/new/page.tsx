'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { niceAlert } from '@/lib/niceAlert'

export default function NewSessionPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createSessionAndRedirect()
  }, [])

  const createSessionAndRedirect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Create Session
      const { data: session, error: sessionError } = await supabase
        .from('ad_sessions')
        .insert({
          user_id: user.id,
          reference_title: 'Nuevo Anuncio',
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Redirect to Questionnaire
      router.push(`/app/session/${session.id}/questionnaire`)

    } catch (error: any) {
      niceAlert('Error: ' + error.message)
      router.push('/app/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Preparando tu nuevo anuncio...</p>
      </div>
    </div>
  )
}
