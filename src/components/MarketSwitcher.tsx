'use client';

import { useMarket } from '@/lib/hooks/useMarket';
import { MARKET_CONFIG, type Market } from '@/lib/market';
import { useState } from 'react';

/**
 * Market Switcher Component
 * 
 * Allows switching between markets without navigation.
 * Sets cookie and reloads current page to maintain context.
 */
export default function MarketSwitcher() {
    const currentMarket = useMarket();
    const [isOpen, setIsOpen] = useState(false);
    const [switching, setSwitching] = useState(false);

    const markets: Market[] = ['us', 'es', 'mx'];

    const handleMarketChange = async (market: Market) => {
        if (market === currentMarket || switching) return;
        
        setSwitching(true);
        setIsOpen(false);

        try {
            // Call API to set market cookie
            const response = await fetch('/api/market/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ market })
            });

            if (!response.ok) {
                throw new Error('Failed to set market');
            }

            console.log('[MarketSwitcher] Market changed to:', market);
            
            // Reload page to apply new market (maintains session and current page)
            window.location.reload();
        } catch (error) {
            console.error('[MarketSwitcher] Error changing market:', error);
            setSwitching(false);
        }
    };

    const currentConfig = MARKET_CONFIG[currentMarket];
    const currentFlag = getFlag(currentMarket);

    return (
        <div className="relative">
            {/* Compact market indicator */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={switching}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
                title={`Current market: ${currentConfig.name} (${currentConfig.currency})`}
            >
                <span className="text-base">{currentFlag}</span>
                <span className="hidden sm:inline uppercase font-semibold">{currentMarket}</span>
                <svg 
                    className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Dropdown */}
                    <div className="absolute right-0 z-20 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1">
                        {markets.map((market) => {
                            const config = MARKET_CONFIG[market];
                            const isCurrent = market === currentMarket;
                            const flag = getFlag(market);
                            
                            return (
                                <button
                                    key={market}
                                    onClick={() => handleMarketChange(market)}
                                    disabled={isCurrent || switching}
                                    className={`w-full flex items-center justify-between px-4 py-2 text-sm ${
                                        isCurrent
                                            ? 'bg-gray-50 text-gray-900 font-medium cursor-default'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    } disabled:opacity-50`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{flag}</span>
                                        <span className="uppercase font-medium">{market}</span>
                                        <span className="text-gray-500">·</span>
                                        <span className="text-gray-500">{config.currency}</span>
                                    </div>
                                    {isCurrent && (
                                        <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

function getFlag(market: Market): string {
    const flags: Record<Market, string> = {
        us: '🇺🇸',
        es: '🇪🇸',
        mx: '🇲🇽',
    };
    return flags[market];
}
