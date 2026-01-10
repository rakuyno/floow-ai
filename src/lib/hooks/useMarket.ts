/**
 * React Hooks for Market System
 * 
 * Provides easy access to current market from components
 */

'use client'

import { useParams, usePathname } from 'next/navigation'
import { Market, normalizeMarket, marketFromPath, DEFAULT_MARKET } from '@/lib/market'
import { getTranslations } from '@/lib/i18n'
import { useMemo } from 'react'

/**
 * Hook to get current market from URL params or path
 * 
 * Usage:
 * ```tsx
 * const market = useMarket()
 * console.log(market) // 'us' | 'es' | 'mx'
 * ```
 */
export function useMarket(): Market {
    const params = useParams()
    const pathname = usePathname()
    
    // Try params first (for pages in [market] route)
    if (params?.market) {
        return normalizeMarket(params.market as string)
    }
    
    // Try extracting from pathname
    if (pathname) {
        const pathMarket = marketFromPath(pathname)
        if (pathMarket) return pathMarket
    }
    
    // Default fallback
    return DEFAULT_MARKET
}

/**
 * Hook to get translations for current market
 * 
 * Usage:
 * ```tsx
 * const t = useTranslations()
 * console.log(t.nav.login) // "Log in" or "Iniciar sesión"
 * ```
 */
export function useTranslations() {
    const market = useMarket()
    return useMemo(() => getTranslations(market), [market])
}

/**
 * Hook to get market and translations together
 * 
 * Usage:
 * ```tsx
 * const { market, t } = useMarketContext()
 * ```
 */
export function useMarketContext() {
    const market = useMarket()
    const t = useTranslations()
    
    return { market, t }
}

