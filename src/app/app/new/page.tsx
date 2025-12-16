'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { niceAlert } from '@/lib/niceAlert'
import { Paperclip, Send } from 'lucide-react'

export default function NewSessionPage() {
  const [prompt, setPrompt] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validation: Require at least one file
    if (!files || files.length === 0) {
      niceAlert('Por favor sube al menos una imagen de tu producto')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // 1. Create Session
      const { data: session, error: sessionError } = await supabase
        .from('ad_sessions')
        .insert({
          user_id: user.id,
          reference_tiktok_url: tiktokUrl || null, // Optional
          reference_title: 'Nuevo Anuncio', // Placeholder
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // 2. Upload Images
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const fileExt = file.name.split('.').pop()
          // RLS Policy requires path to start with user_id
          const fileName = `${user.id}/${session.id}/${Math.random()}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(fileName, file)

          if (uploadError) throw uploadError

          await supabase.from('ad_assets').insert({
            session_id: session.id,
            user_id: user.id,
            storage_path: fileName,
            type: 'image'
          })
        }
      }

      // 3. Redirect to Questionnaire (Chat flow continuation)
      router.push(`/app/session/${session.id}/questionnaire`)

    } catch (error: any) {
      niceAlert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900">
            Nuevo Anuncio UGC
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Sube las fotos de tu producto para comenzar. La referencia de TikTok es opcional.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-6">
            <div>
              <label htmlFor="tiktok" className="block text-sm font-medium leading-6 text-gray-900">
                URL de TikTok de referencia (Opcional)
              </label>
              <div className="mt-2">
                <input
                  type="url"
                  name="tiktok"
                  id="tiktok"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                  placeholder="https://www.tiktok.com/@user/video/..."
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="prompt" className="block text-sm font-medium leading-6 text-gray-900">
                Instrucciones adicionales (opcional)
              </label>
              <div className="mt-2">
                <textarea
                  id="prompt"
                  name="prompt"
                  rows={3}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">
                Imágenes del producto (1-5)
              </label>
              <div className="mt-2 flex items-center gap-x-3">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setFiles(e.target.files)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Comenzar'} <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
