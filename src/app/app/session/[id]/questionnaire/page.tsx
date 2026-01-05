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
  const [files, setFiles] = useState<FileList | null>(null)
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [existingImages, setExistingImages] = useState<any[]>([])

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
    num_scenes: 3, // Default to 3 scenes (30 tokens for free users)
    target_language: 'es' // Default to Spanish
  })

  useEffect(() => {
    fetchTokenBalance()
    fetchExistingImages()
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

  const fetchExistingImages = async () => {
    const { data } = await supabase
      .from('ad_assets')
      .select('*')
      .eq('session_id', params.id)
      .eq('type', 'image')
    if (data) setExistingImages(data)
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
  const isBalanceLoading = tokenBalance === null
  const hasInsufficientTokens = !isBalanceLoading && tokenBalance < totalCost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation: Require images
    if (!files && existingImages.length === 0) {
      niceAlert('Por favor, sube al menos una imagen de tu producto.')
      return
    }

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // Upload new images if any
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const fileExt = file.name.split('.').pop()
          const fileName = `${user.id}/${params.id}/${Math.random()}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(fileName, file)

          if (uploadError) throw uploadError

          await supabase.from('ad_assets').insert({
            session_id: params.id,
            user_id: user.id,
            storage_path: fileName,
            type: 'image'
          })
        }
      }

      // Update session with TikTok URL if provided
      if (tiktokUrl) {
        await supabase
          .from('ad_sessions')
          .update({ reference_tiktok_url: tiktokUrl })
          .eq('id', params.id)
      }
      // Map frontend video_type values to database values
      let videoTypeDb = formData.video_type
      if (formData.video_type === 'broll') videoTypeDb = 'product_only'
      if (formData.video_type === 'avatar') videoTypeDb = 'avatar_only'
      // 'mixed' stays as 'mixed'
      
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
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Crear Nuevo Anuncio</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600">Completa la información para generar tu video publicitario</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* PASO 1: INFORMACIÓN BÁSICA */}
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-600">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-sm">
                1
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Información Básica</h2>
            </div>

            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Producto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
                  placeholder="Ej: Crema Facial Hidratante"
                />
              </div>

              {/* Target Users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuario Objetivo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.target_users}
                  onChange={(e) => setFormData({ ...formData, target_users: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
                  placeholder="Ej: Mujeres de 25-40 años que buscan cuidado de piel natural"
                />
                <p className="mt-1 text-xs text-gray-500">Describe quién es tu cliente ideal</p>
              </div>

              {/* Product Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imágenes del Producto (1-5) <span className="text-red-500">*</span>
                </label>
                {existingImages.length > 0 && (
                  <div className="mb-2 text-sm text-green-600">
                    ✓ {existingImages.length} imagen(es) ya subida(s)
                  </div>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setFiles(e.target.files)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <p className="mt-1 text-xs text-gray-500">Sube fotos de calidad de tu producto</p>
              </div>
            </div>
          </div>

          {/* PASO 2: BENEFICIOS DEL PRODUCTO */}
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-600">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm">
                2
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Beneficios y Características</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿Qué hace especial a tu producto? <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={formData.selling_points}
                onChange={(e) => setFormData({ ...formData, selling_points: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
                placeholder="Escribe un beneficio por línea:&#10;Reduce arrugas visiblemente en 7 días&#10;Ingredientes 100% naturales&#10;Hidratación profunda 24h&#10;Testado dermatológicamente"
              />
              <p className="mt-1 text-xs text-gray-500">Escribe cada beneficio o característica en una línea nueva</p>
            </div>
          </div>

          {/* PASO 3: CONFIGURACIÓN DEL VIDEO */}
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-600">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                3
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Configuración del Video</h2>
            </div>

            <div className="space-y-6">
              {/* Video Type - Card Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tipo de Video <span className="text-red-500">*</span>
                </label>
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
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Seleccionar Avatar <span className="text-red-500">*</span>
                  </label>

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
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Audio del Anuncio <span className="text-red-500">*</span>
                </label>
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
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Idioma del Anuncio <span className="text-red-500">*</span>
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
                  El guion, la voz en off (TTS) y el audio se generan en el idioma seleccionado
                </p>
              </div>

              {/* Scenes Slider */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Número de Escenas <span className="text-red-500">*</span>
                  </label>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-indigo-600">{formData.num_scenes}</div>
                    <div className="text-xs text-gray-500">escenas</div>
                  </div>
                </div>
                
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Coste de esta configuración:</span>
                    <div className="text-right">
                      <span className="text-xl font-bold text-indigo-600">{totalCost}</span>
                      <span className="text-sm text-gray-600 ml-1">tokens</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.num_scenes} escena{formData.num_scenes !== 1 ? 's' : ''} × 10 tokens = {totalCost} tokens
                  </div>
                </div>

                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.num_scenes}
                  onChange={(e) => setFormData({ ...formData, num_scenes: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  style={{
                    background: `linear-gradient(to right, rgb(79 70 229) 0%, rgb(79 70 229) ${((formData.num_scenes - 1) / 9) * 100}%, rgb(229 231 235) ${((formData.num_scenes - 1) / 9) * 100}%, rgb(229 231 235) 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                  <span>7</span>
                  <span>8</span>
                  <span>9</span>
                  <span>10</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">💡 Más escenas = video más largo y completo</p>
              </div>
            </div>
          </div>

          {/* PASO 4: MARKETING (OPCIONAL) */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg shadow border-l-4 border-amber-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-sm">
                4
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Marketing y Extras</h2>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                💡 Opcional
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4 ml-11">Estos campos son opcionales pero pueden mejorar tu anuncio</p>

            <div className="space-y-4 ml-11">
              {/* Offer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Oferta Especial <span className="text-gray-400 text-xs">(Opcional)</span> 💡
                </label>
                <input
                  type="text"
                  value={formData.offer}
                  onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm px-3 py-2 border text-gray-900"
                  placeholder="Ej: 50% descuento, Envío gratis, 2x1, Oferta limitada"
                />
                <p className="mt-1 text-xs text-gray-500">Promoción o descuento especial que quieras destacar</p>
              </div>

              {/* CTA */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Llamada a la Acción <span className="text-gray-400 text-xs">(Opcional)</span> 💡
                </label>
                <input
                  type="text"
                  value={formData.cta}
                  onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm px-3 py-2 border text-gray-900"
                  placeholder="Ej: Compra ahora, Consigue el tuyo, Visita nuestra web, Descúbrelo"
                />
                <p className="mt-1 text-xs text-gray-500">Acción que quieres que tome el espectador</p>
              </div>

              {/* TikTok Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia TikTok <span className="text-gray-400 text-xs">(Opcional)</span> 💡
                </label>
                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm px-3 py-2 border text-gray-900"
                  placeholder="https://www.tiktok.com/@user/video/..."
                />
                <p className="mt-1 text-xs text-gray-500">URL de un video de TikTok que te inspire</p>
              </div>

              {/* Additional Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instrucciones Adicionales <span className="text-gray-400 text-xs">(Opcional)</span> 💡
                </label>
                <textarea
                  rows={3}
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm px-3 py-2 border text-gray-900"
                  placeholder="Cualquier detalle especial o preferencia que quieras que tengamos en cuenta..."
                />
                <p className="mt-1 text-xs text-gray-500">Agrega cualquier indicación extra sobre el tono, estilo o contenido</p>
              </div>
            </div>
          </div>

          {/* Token Summary */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Coste Total:</p>
                <p className="text-2xl font-bold text-gray-900">{totalCost} tokens</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Tu Saldo:</p>
                <p className={`text-2xl font-bold ${hasInsufficientTokens ? 'text-red-600' : 'text-green-600'}`}>
                  {tokenBalance !== null ? tokenBalance : '...'} tokens
                </p>
              </div>
            </div>
            {hasInsufficientTokens && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">⚠️ Saldo insuficiente. Necesitas comprar más tokens para continuar.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end items-center pt-6">
            <button
              type="submit"
              disabled={loading || isBalanceLoading || hasInsufficientTokens}
              className="bg-indigo-600 text-white px-8 py-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg text-base transition-all"
            >
              {loading
                ? '⏳ Generando...'
                : hasInsufficientTokens
                  ? '⚠️ Saldo insuficiente'
                  : isBalanceLoading
                    ? '⏳ Cargando...'
                    : '🚀 Generar Video'}
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
