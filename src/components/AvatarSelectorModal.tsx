'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFilters, fetchAvatarsWithFilters, uploadUserAvatar } from '@/lib/avatars'
import { createClient } from '@/lib/supabase/client'
import { niceAlert } from '@/lib/niceAlert'

interface AvatarSelectorModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (avatar: Avatar) => void
    selectedAvatarId?: string | null
}



export default function AvatarSelectorModal({ isOpen, onClose, onSelect, selectedAvatarId }: AvatarSelectorModalProps) {
    const [avatars, setAvatars] = useState<Avatar[]>([])
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)

    const [filters, setFilters] = useState<AvatarFilters>({
        gender: 'todos',
        age_style: 'todos',
        search: ''
    })

    useEffect(() => {
        if (isOpen) {
            loadAvatars()
        }
    }, [isOpen, filters])

    const loadAvatars = async () => {
        setLoading(true)
        try {
            console.log('[Avatar Filters] UI Filters:', filters)

            // Map UI values to DB values
            const dbFilters: AvatarFilters = {
                gender: filters.gender === 'todos' ? undefined :
                    filters.gender === 'masculino' ? 'Hombre' :
                        filters.gender === 'femenino' ? 'Mujer' : undefined,
                age_style: filters.age_style === 'todos' ? undefined :
                    filters.age_style, // UI already uses DB format (20-30, 30-40, etc)
                search: filters.search
            }

            console.log('[Avatar Filters] DB Filters:', dbFilters)
            const results = await fetchAvatarsWithFilters(dbFilters)
            console.log('[Avatar Filters] Avatars returned:', results.length)
            setAvatars(results)
        } catch (error) {
            console.error('Error loading avatars:', error)
        } finally {
            setLoading(false)
        }
    }



    const handleAvatarSelect = (avatar: Avatar) => {
        setSelectedAvatar(avatar)
    }

    const handleConfirmSelection = () => {
        if (selectedAvatar) {
            onSelect(selectedAvatar)
            onClose()
        }
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        setUploading(true)
        try {
            const file = e.target.files[0]
            const supabase = createClient()
            const { data: { user }, error: authError } = await supabase.auth.getUser()

            console.log('[Avatar Upload] Auth check:', { user, authError })

            if (authError) {
                console.error('[Avatar Upload] Auth error:', authError)
                throw new Error('Error de autenticación: ' + authError.message)
            }

            if (!user) {
                throw new Error('Usuario no autenticado. Por favor, inicia sesión de nuevo.')
            }

            console.log('[Avatar Upload] Uploading for user:', user.id)

            const newAvatar = await uploadUserAvatar(file, user.id, {
                name: 'Mi Avatar Personalizado',
                gender: 'neutral',
                age_style: '30s',
                style_tags: ['personalizado'],
                voice_language: 'es-ES'
            })

            console.log('[Avatar Upload] Avatar created:', newAvatar)

            if (newAvatar) {
                setAvatars([newAvatar, ...avatars])
                setSelectedAvatar(newAvatar)
            }
        } catch (error: any) {
            console.error('[Avatar Upload] Full error:', error)
            niceAlert('Error al subir avatar: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>

                {/* Modal */}
                <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900">Elige un avatar</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex flex-col lg:flex-row">
                        {/* Filters Sidebar */}
                        <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 bg-gray-50">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Filtros</h3>

                            {/* Search */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
                                <input
                                    type="text"
                                    placeholder="Nombre del avatar..."
                                    value={filters.search || ''}
                                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            {/* Gender */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Género</label>
                                <select
                                    value={filters.gender || 'todos'}
                                    onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="todos">Todos</option>
                                    <option value="masculino">Masculino</option>
                                    <option value="femenino">Femenino</option>
                                </select>
                            </div>

                            {/* Age */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Edad</label>
                                <select
                                    value={filters.age_style || 'todos'}
                                    onChange={(e) => setFilters({ ...filters, age_style: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="todos">Todas</option>
                                    <option value="20-30">20-30 años</option>
                                    <option value="30-40">30-40 años</option>
                                    <option value="40-50">40-50 años</option>
                                    <option value="50-60">50-60 años</option>
                                    <option value="60+">60+ años</option>
                                </select>
                            </div>



                            {/* Clear Filters */}
                            <button
                                onClick={() => setFilters({ gender: 'todos', age_style: 'todos', search: '' })}
                                className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                Limpiar filtros
                            </button>
                        </div>

                        {/* Avatar Grid */}
                        <div className="flex-1 p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="text-gray-500">Cargando avatares...</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {/* Upload Card */}
                                    <label className="cursor-pointer relative rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-500 flex flex-col items-center justify-center aspect-[9/16] text-gray-500 hover:text-indigo-600 transition-colors bg-gray-50 hover:bg-indigo-50">
                                        {uploading ? (
                                            <span className="text-xs">Subiendo...</span>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                <span className="text-xs font-medium text-center px-2">Subir Avatar Propio</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleUpload}
                                            disabled={uploading}
                                        />
                                    </label>

                                    {/* Avatar Cards */}
                                    {avatars.map((avatar) => (
                                        <div
                                            key={avatar.id}
                                            onClick={() => handleAvatarSelect(avatar)}
                                            className={`cursor-pointer relative rounded-lg overflow-hidden border-2 aspect-[9/16] group transition-all ${selectedAvatar?.id === avatar.id
                                                ? 'border-indigo-600 ring-2 ring-indigo-600 ring-offset-2 shadow-lg'
                                                : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                                                }`}
                                        >
                                            <img
                                                src={avatar.image_url}
                                                alt={avatar.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                                                    <p className="text-xs font-semibold truncate">{avatar.name}</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {avatar.gender && (
                                                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                                                                {avatar.gender === 'masculino' ? '♂' : avatar.gender === 'femenino' ? '♀' : '⚲'}
                                                            </span>
                                                        )}
                                                        {avatar.age_style && (
                                                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">{avatar.age_style}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {selectedAvatar?.id === avatar.id && (
                                                <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!loading && avatars.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm">No se encontraron avatares con estos filtros</p>
                                    <button
                                        onClick={() => setFilters({ gender: 'todos', age_style: 'todos', search: '' })}
                                        className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        Limpiar filtros
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Selected Avatar Detail Panel (optional, shown on larger screens) */}
                        {selectedAvatar && (
                            <div className="hidden xl:block w-64 border-l border-gray-200 p-4 bg-gray-50">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Avatar Seleccionado</h3>
                                <div className="mb-4">
                                    <img
                                        src={selectedAvatar.image_url}
                                        alt={selectedAvatar.name}
                                        className="w-full aspect-[9/16] object-cover rounded-lg mb-3"
                                    />
                                    <p className="font-medium text-gray-900">{selectedAvatar.name}</p>
                                    {selectedAvatar.gender && (
                                        <p className="text-xs text-gray-600 mt-1">
                                            Género: <span className="capitalize">{selectedAvatar.gender}</span>
                                        </p>
                                    )}
                                    {selectedAvatar.age_style && (
                                        <p className="text-xs text-gray-600">
                                            Edad: {selectedAvatar.age_style}
                                        </p>
                                    )}
                                    {selectedAvatar.style_tags && selectedAvatar.style_tags.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-600 mb-1">Estilos:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {selectedAvatar.style_tags.map(tag => (
                                                    <span key={tag} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded capitalize">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                        <p className="text-sm text-gray-600">
                            {selectedAvatar ? (
                                <span className="font-medium text-gray-900">Seleccionado: {selectedAvatar.name}</span>
                            ) : (
                                'Selecciona un avatar o sube uno propio'
                            )}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmSelection}
                                disabled={!selectedAvatar}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Confirmar Selección
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
