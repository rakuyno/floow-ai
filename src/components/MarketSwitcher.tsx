'use client';

import { useMarket } from '@/lib/hooks/useMarket';
import { MARKET_CONFIG, type Market } from '@/lib/market';
import { useState } from 'react';

/**
 * Market Switcher Component
 * 
 * Allows easy switching between markets for testing purposes.
 * Shows current market and provides quick navigation to other markets.
 */
export default function MarketSwitcher() {
    const currentMarket = useMarket();
    const [isOpen, setIsOpen] = useState(false);

    const markets: Market[] = ['us', 'es', 'mx'];

    const handleMarketChange = (market: Market) => {
        // Navigate to root of selected market (this will set the cookie)
        window.location.href = `/${market}`;
    };

    const currentConfig = MARKET_CONFIG[currentMarket];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Switch Market (Testing)"
            >
                <span className="text-lg">🌍</span>
                <span className="uppercase font-bold">{currentMarket}</span>
                <span className="text-xs text-gray-500">({currentConfig.currency})</span>
                <svg 
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
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
                    <div className="absolute right-0 z-20 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                            Switch Market
                        </div>
                        {markets.map((market) => {
                            const config = MARKET_CONFIG[market];
                            const isCurrent = market === currentMarket;
                            
                            return (
                                <button
                                    key={market}
                                    onClick={() => handleMarketChange(market)}
                                    disabled={isCurrent}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm ${
                                        isCurrent
                                            ? 'bg-indigo-50 text-indigo-700 font-medium cursor-default'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-2xl">{getFlag(market)}</span>
                                    <div className="flex-1 text-left">
                                        <div className="font-medium">{config.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {market.toUpperCase()} • {config.currency}
                                        </div>
                                    </div>
                                    {isCurrent && (
                                        <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200 mt-1">
                            💡 Tip: Navigating to /{'{'}market{'}'} will set the cookie and update prices
                        </div>
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
