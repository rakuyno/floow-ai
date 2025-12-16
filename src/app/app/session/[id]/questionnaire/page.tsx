'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Avatar } from '@/lib/avatars'
import AvatarSelectorModal from '@/components/AvatarSelectorModal'
import TokenCounter from '@/components/TokenCounter'
import { niceAlert } from '@/lib/niceAlert'

export default function QuestionnairePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)

  const [formData, setFormData] = useState<{
    product_name: string
    target_users: string
    selling_points: string
    offer: string
    cta: string
    video_type: string
    audio_mode: string
    avatar_image_url: string | null
    avatar_id: string | null
    avatar_name: string | null
    num_scenes: number
    target_language: 'en' | 'es'
  }>({
    product_name: '',
    target_users: '',
    selling_points: '',
    offer: '',
    cta: '',
    video_type: 'mixed',
    audio_mode: 'voiceover', // Default to voiceover (recommended)
    avatar_image_url: null,
    avatar_id: null,
    avatar_name: null,
    num_scenes: 4, // Default to 4 scenes
    target_language: 'es' // Default to Spanish
  })

  useEffect(() => {
    fetchTokenBalance()
  }, [])

  const fetchTokenBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('user_token_balances')
        .select('balance')
        .eq('user_id', user.id)
        .single()
      if (data) setTokenBalance(data.balance)
    }
  }

  const handleAvatarSelect = (avatar: Avatar) => {
    setFormData(prev => ({
      ...prev,
      avatar_id: avatar.id,
      avatar_image_url: avatar.image_url,
      avatar_name: avatar.name
    }))
  }

  // Calculate Token Cost (simplified - fixed 10 tokens per scene)
  const totalCost = formData.num_scenes * 10
  const hasInsufficientTokens = tokenBalance !== null && tokenBalance < totalCost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation: Require avatar if style is avatar/mixed
    if ((formData.video_type === 'avatar' || formData.video_type === 'mixed') && !formData.avatar_id) {
      niceAlert('Por favor, selecciona un avatar para este estilo de vídeo.')
      return
    }

    // Validation: Token Balance
    if (hasInsufficientTokens) {
      niceAlert(`No tienes suficientes tokens. Necesitas ${totalCost} tokens pero tienes ${tokenBalance}.`)
      return
    }

    setLoading(true)

    try {
      const videoTypeDb = formData.video_type === 'broll' ? 'product_only' : formData.video_type
      const sellingPointsArray = formData.selling_points.split('\n').filter(Boolean)

      // Calculate videoMode based on audio selection
      const videoMode = formData.audio_mode === 'voiceover' ? 'kling_voiceover' : 'veo_style'

      // 1. Save Questionnaire Data (upsert to allow resubmission)
      const { error } = await supabase
        .from('ad_questionnaire')
        .upsert({
          session_id: params.id,
          product_name: formData.product_name,
          target_users: formData.target_users,
          selling_points: sellingPointsArray,
          offer: formData.offer,
          cta: formData.cta,
          video_type: videoTypeDb,
          audio_mode: formData.audio_mode,
          avatar_image_url: formData.avatar_image_url,
          avatar_id: formData.avatar_id,
          video_mode: videoMode,
          num_scenes: formData.num_scenes,
          target_language: formData.target_language
        })

      if (error) throw error

      // 2. Generate Storyboard via API
      const response = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: params.id,
          product_name: formData.product_name,
          target_users: formData.target_users,
          selling_points: sellingPointsArray,
          offer: formData.offer,
          cta: formData.cta,
          video_type: videoTypeDb,
          audio_mode: formData.audio_mode,
          avatar_image_url: formData.avatar_image_url,
          avatar_id: formData.avatar_id,
          video_mode: videoMode,
          num_scenes: formData.num_scenes,
          target_language: formData.target_language
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to generate storyboard')
      }

      router.push(`/app/session/${params.id}/storyboard`)

    } catch (error: any) {
      niceAlert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-select voiceover for avatar/mixed video types
  useEffect(() => {
    if (formData.video_type === 'avatar' || formData.video_type === 'mixed') {
      if (formData.audio_mode !== 'voiceover') {
        setFormData(prev => ({ ...prev, audio_mode: 'voiceover' }))
      }
    }
  }, [formData.video_type])

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Detalles del Anuncio</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del Producto</label>
            <input
              type="text"
              required
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
            />
          </div>

          {/* Target Users */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Usuario Objetivo (Target)</label>
            <input
              type="text"
              required
              value={formData.target_users}
              onChange={(e) => setFormData({ ...formData, target_users: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
              placeholder="Ej: Mujeres de 25-35 años interesadas en fitness"
            />
          </div>

          {/* Selling Points */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Puntos de Venta (uno por línea)</label>
            <textarea
              required
              rows={4}
              value={formData.selling_points}
              onChange={(e) => setFormData({ ...formData, selling_points: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
              placeholder="Ingredientes naturales&#10;Envío gratis&#10;Resultados en 30 días"
            />
          </div>

          {/* Offer */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Oferta</label>
            <input
              type="text"
              value={formData.offer}
              onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
              placeholder="Ej: 50% de descuento hoy"
            />
          </div>

          {/* CTA */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Llamada a la Acción (CTA)</label>
            <input
              type="text"
              value={formData.cta}
              onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
              placeholder="Ej: Compra ahora"
            />
          </div>



          {/* Video Type - Card Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de Video</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, video_type: 'mixed' })}
                className={`relative p-4 border-2 rounded-lg text-left transition-all ${formData.video_type === 'mixed'
                  ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600 ring-offset-1'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Mix</p>
                    <p className="text-xs text-gray-600 mt-1">Avatar + Producto</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                    Recomendado
                  </span>
                </div>
                {formData.video_type === 'mixed' && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, video_type: 'avatar' })}
                className={`relative p-4 border-2 rounded-lg text-left transition-all ${formData.video_type === 'avatar'
                  ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600 ring-offset-1'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Solo Avatar</p>
                  <p className="text-xs text-gray-600 mt-1">Persona hablando</p>
                </div>
                {formData.video_type === 'avatar' && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, video_type: 'broll' })}
                className={`relative p-4 border-2 rounded-lg text-left transition-all ${formData.video_type === 'broll'
                  ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600 ring-offset-1'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Solo Producto</p>
                  <p className="text-xs text-gray-600 mt-1">Imágenes del producto</p>
                </div>
                {formData.video_type === 'broll' && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Avatar Selection Section - Only if video type involves avatar */}
          {(formData.video_type === 'avatar' || formData.video_type === 'mixed') && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Avatar</h3>

              {formData.avatar_id ? (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <img
                    src={formData.avatar_image_url || ''}
                    alt={formData.avatar_name || 'Avatar'}
                    className="w-20 h-20 rounded-lg object-cover ring-2 ring-indigo-100"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{formData.avatar_name || 'Avatar seleccionado'}</p>
                    <p className="text-sm text-gray-600 mt-1">Avatar listo para usar</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    Cambiar avatar
                  </button>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">No has seleccionado un avatar</p>
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    className="mt-3 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                  >
                    Seleccionar avatar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Audio Mode - Redesigned with user-friendly labels */}
          <div className="border-t pt-6 mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Audio del anuncio</label>
            <div className="space-y-3">
              <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                <input
                  type="radio"
                  name="audio_mode"
                  value="raw"
                  checked={formData.audio_mode === 'raw'}
                  onChange={(e) => setFormData({ ...formData, audio_mode: e.target.value })}
                  className="h-4 w-4 mt-0.5 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <div className="ml-3 flex-1">
                  <span className="block text-sm font-medium text-gray-900">
                    Audio del vídeo (voces/ambiente)
                  </span>
                  <span className="block text-xs text-gray-600 mt-1">
                    Usamos el audio original que genera la IA de vídeo (voces, sonidos y ambiente) y lo mezclamos con una voz en off generada con IA para mayor claridad.
                  </span>
                  <p className="text-xs font-semibold text-indigo-600 mt-2">
                    Coste: 10 tokens/escena
                  </p>
                </div>
              </label>

              <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                <input
                  type="radio"
                  name="audio_mode"
                  value="voiceover"
                  checked={formData.audio_mode === 'voiceover'}
                  onChange={(e) => setFormData({ ...formData, audio_mode: e.target.value })}
                  className="h-4 w-4 mt-0.5 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="block text-sm font-medium text-gray-900">
                      Voz en off con IA
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      Recomendado
                    </span>
                  </div>
                  <span className="block text-xs text-gray-600 mt-1">
                    Silenciamos el audio original del vídeo y añadimos una narración con voz en off generada con IA.
                  </span>
                  <p className="text-xs font-semibold text-indigo-600 mt-2">
                    Coste: 10 tokens/escena
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Language selector (EN / ES) */}
          <div className="border-t pt-6 mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Idioma del anuncio (guion, TTS y audio RAW)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                <input
                  type="radio"
                  name="target_language"
                  value="en"
                  checked={formData.target_language === 'en'}
                  onChange={(e) => setFormData({ ...formData, target_language: e.target.value as 'en' | 'es' })}
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-900">
                  🇺🇸/🇬🇧 Inglés
                </span>
              </label>
              <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                <input
                  type="radio"
                  name="target_language"
                  value="es"
                  checked={formData.target_language === 'es'}
                  onChange={(e) => setFormData({ ...formData, target_language: e.target.value as 'en' | 'es' })}
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-900">
                  🇪🇸 Español
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              El guion, la voz en off (TTS) y el audio RAW procesado por ElevenLabs se generan en el idioma seleccionado.
            </p>
          </div>

          {/* Scenes Slider */}
          <div className="border-t pt-6 mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Escenas: <span className="text-indigo-600 font-bold">{formData.num_scenes}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.num_scenes}
              onChange={(e) => setFormData({ ...formData, num_scenes: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 escena</span>
              <span>10 escenas</span>
            </div>
          </div>

          {/* Token Summary */}
          <div className="bg-gray-100 p-4 rounded-lg flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Coste:</p>
              <p className="text-lg font-bold text-gray-900">{totalCost} tokens</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Tu saldo:</p>
              <p className={`text-lg font-bold ${hasInsufficientTokens ? 'text-red-600' : 'text-green-600'}`}>
                {tokenBalance !== null ? tokenBalance : '...'} tokens
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              ← Atrás
            </button>
            <button
              type="submit"
              disabled={loading || hasInsufficientTokens}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium shadow-sm"
            >
              {loading ? 'Guardando...' : hasInsufficientTokens ? 'Saldo insuficiente' : 'Continuar al Storyboard'}
            </button>
          </div>

        </form>
      </div>

      {/* Avatar Selector Modal */}
      <AvatarSelectorModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        onSelect={handleAvatarSelect}
        selectedAvatarId={formData.avatar_id}
      />
    </div>
  )
}
