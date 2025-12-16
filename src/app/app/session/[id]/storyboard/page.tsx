'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import ErrorHintBubble from '@/components/ErrorHintBubble'
import { niceAlert } from '@/lib/niceAlert'

export default function StoryboardPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [storyboard, setStoryboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorHint, setErrorHint] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [regeneratingScript, setRegeneratingScript] = useState(false)

  const deriveErrorHint = (message: string | undefined | null): string | null => {
    if (!message) return null
    const msg = message.toLowerCase()
    if (msg.includes('sensitive') || msg.includes('policy') || msg.includes('usage')) return 'Bloqueado por seguridad. Usa texto e imágenes más neutros.'
    if (msg.includes('token')) return 'No hay tokens suficientes para completar la generación.'
    if (msg.includes('storyboard not found')) return 'No encontramos el guion. Genera el guion antes de crear el video.'
    if (msg.includes('api key') || msg.includes('openai')) return 'Tuvimos un problema técnico. Prueba de nuevo en unos minutos.'
    return null
  }

  const fetchStoryboard = useCallback(
    async (withLoader = false) => {
      if (withLoader) setLoading(true)

      const { data } = await supabase
        .from('storyboards')
        .select('*')
        .eq('session_id', params.id)
        .single()

      if (data) setStoryboard(data)
      if (withLoader) setLoading(false)
    },
    [params.id, supabase]
  )

  useEffect(() => {
    fetchStoryboard(true)
  }, [fetchStoryboard])

  const briefData = useMemo(() => {
    if (!storyboard?.brief) return null
    try {
      return JSON.parse(storyboard.brief)
    } catch (err) {
      console.error('Error parsing brief', err)
      return null
    }
  }, [storyboard?.brief])

  const handleGenerate = async () => {
    setGenerating(true)
    setErrorMsg(null)
    setErrorHint(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create Render Job
      const { error } = await supabase
        .from('render_jobs')
        .insert({
          session_id: params.id,
          user_id: user.id,
          kind: 'preview', // Start with preview
          status: 'queued'
        })

      if (error) throw error

      router.push('/app/dashboard')
    } catch (error: any) {
      setErrorMsg(error?.message || 'No se pudo crear el anuncio.')
      setErrorHint(deriveErrorHint(error?.message))
      setGenerating(false)
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerateScript = async () => {
    if (!briefData) {
      niceAlert('No se pudo cargar el brief original para regenerar el guion.')
      return
    }

    setRegeneratingScript(true)
    try {
      const numScenes = Number(briefData.num_scenes ?? (storyboard?.storyboard?.length ?? 4)) || 4

      const payload = {
        session_id: params.id,
        ...briefData,
        num_scenes: numScenes,
        reference_script: storyboard?.storyboard ? JSON.stringify(storyboard.storyboard, null, 2) : null,
        feedback: feedback.trim()
      }

      const response = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'No se pudo regenerar el guion')
      }

      await fetchStoryboard()
      setShowEditModal(false)
      setFeedback('')
    } catch (error: any) {
      niceAlert('Error: ' + error.message)
    } finally {
      setRegeneratingScript(false)
    }
  }

  if (loading) return <div>Cargando storyboard...</div>
  if (!storyboard) return <div>No se encontró el storyboard.</div>

  const scenes = storyboard.storyboard || []

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow sm:rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Storyboard Generado</h2>
        <p className="text-gray-600 mb-4">{storyboard.summary}</p>

        {errorMsg && (
          <div className="relative mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
            <span className="mt-0.5">⚠️</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>No se pudo generar el video</span>
                {errorHint && <ErrorHintBubble message={errorHint} label="Posible motivo" />}
              </div>
              <div className="text-sm leading-5">{errorMsg}</div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {scenes.map((shot: any, idx: number) => (
            <div key={idx} className="border rounded-lg p-4 flex gap-4 items-start bg-gray-50">
              <div className="bg-gradient-to-br from-indigo-100 to-indigo-200 w-24 h-40 flex-shrink-0 flex items-center justify-center rounded text-xs text-indigo-700 font-semibold">
                📹 {shot.camera_style}
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm text-indigo-600 mb-1">Escena {idx + 1} ({shot.duration}s)</div>
                <div className="text-sm text-gray-600 italic mb-2">{shot.visual}</div>
                <p className="text-gray-900 font-medium mb-2">"{shot.dialogue}"</p>
                {shot.on_screen_text && (
                  <div className="mt-2 inline-block bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                    <span className="text-xs font-semibold text-yellow-800">📝 Texto en pantalla:</span>
                    <span className="text-xs text-yellow-900 ml-1">{shot.on_screen_text}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Editar Guion
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? 'Enviando...' : 'Generar Video (Preview)'}
          </button>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">¿Qué cambiamos del guion?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Cuéntanos qué no te convenció o qué detalles quieres ajustar. Usaremos el brief original y este feedback para generar una nueva versión.
                </p>
              </div>
              <button
                onClick={() => !regeneratingScript && setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <textarea
              className="mt-4 w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={5}
              placeholder="Ejemplo: Quiero un tono más entusiasta, resalta la oferta en la primera escena y añade una llamada a la acción más directa."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={regeneratingScript}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegenerateScript}
                disabled={regeneratingScript || !briefData}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {regeneratingScript ? 'Generando...' : 'Generar nuevo guion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
