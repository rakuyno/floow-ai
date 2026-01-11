'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/lib/hooks/useMarket'

export default function TokenCounter({ className = '' }: { className?: string }) {
    const [balance, setBalance] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()
    const t = useTranslations()

    useEffect(() => {
        console.log('[TokenCounter] Component mounted, fetching balance...')
        fetchBalance()

        // Poll every 5 seconds to keep balance updated
        const pollInterval = setInterval(() => {
            fetchBalance()
        }, 5000)

        // Set up realtime subscription to user_token_balances
        let realtimeChannel: ReturnType<typeof supabase.channel> | null = null
        
        const setupRealtimeSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            console.log('[TokenCounter] Setting up realtime subscription for user:', user.id)
            
            realtimeChannel = supabase
                .channel('token-balance-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'user_token_balances',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('[TokenCounter] Realtime update received:', payload)
                        if (payload.new && 'balance' in payload.new) {
                            setBalance((payload.new as any).balance)
                        }
                    }
                )
                .subscribe()
        }

        setupRealtimeSubscription()

        return () => {
            clearInterval(pollInterval)
            if (realtimeChannel) {
                console.log('[TokenCounter] Cleaning up realtime subscription')
                realtimeChannel.unsubscribe()
            }
        }
    }, [])

    const fetchBalance = async () => {
        try {
            setLoading(true)
            setError(null)

            const { data: { user }, error: userError } = await supabase.auth.getUser()

            if (userError) {
                console.error('[TokenCounter] Error getting user:', userError)
                setError(t.errors.authError)
                return
            }

            if (!user) {
                console.warn('[TokenCounter] No user found')
                return
            }

            console.log('[TokenCounter] User ID:', user.id)

            const { data, error: balanceError } = await supabase
                .from('user_token_balances')
                .select('balance')
                .eq('user_id', user.id)
                .single()

            if (balanceError) {
                console.error('[TokenCounter] Error fetching balance:', balanceError)
                console.error('[TokenCounter] Error code:', balanceError.code)
                console.error('[TokenCounter] Error message:', balanceError.message)
                console.error('[TokenCounter] Error details:', balanceError.details)
                setError(t.errors.loadBalanceError)
                return
            }

            if (data) {
                console.log('[TokenCounter] Balance fetched successfully:', data.balance)
                setBalance(data.balance)
            } else {
                console.warn('[TokenCounter] No balance data found for user')
                setError(t.errors.noBalanceRecord)
            }
        } catch (err) {
            console.error('[TokenCounter] Unexpected error:', err)
            setError(t.errors.unexpectedError)
        } finally {
            setLoading(false)
        }
    }

    // Show loading state
    if (loading) {
        return (
            <div className={`inline-flex items-center bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm ${className}`}>
                <span className="text-lg mr-1.5">🪙</span>
                <span className="font-bold text-gray-400 animate-pulse">...</span>
                <span className="ml-1 text-xs text-gray-500 font-medium uppercase tracking-wide">{t.common.tokens}</span>
            </div>
        )
    }

    // Show error state temporarily (will help with debugging)
    if (error) {
        return (
            <div className={`inline-flex items-center bg-red-50 border border-red-200 rounded-full px-3 py-1 shadow-sm ${className}`}>
                <span className="text-lg mr-1.5">⚠️</span>
                <span className="font-bold text-red-600 text-xs">{error}</span>
            </div>
        )
    }

    // Don't show anything if balance is still null (no data yet)
    if (balance === null) {
        console.warn('[TokenCounter] Balance is null after loading')
        return null
    }

    return (
        <div className={`inline-flex items-center bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm ${className}`}>
            <span className="text-lg mr-1.5">🪙</span>
            <span className="font-bold text-gray-900">{balance}</span>
            <span className="ml-1 text-xs text-gray-500 font-medium uppercase tracking-wide">{t.common.tokens}</span>
        </div>
    )
}
