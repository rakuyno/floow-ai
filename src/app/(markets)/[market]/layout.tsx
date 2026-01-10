import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VALID_MARKETS, type Market, MARKET_CONFIG } from '@/lib/market';

interface MarketLayoutProps {
    children: React.ReactNode;
    params: {
        market: string;
    };
}

/**
 * Generate static params for all valid markets
 * This enables static generation for /us, /es, /mx
 */
export function generateStaticParams() {
    return VALID_MARKETS.map((market) => ({
        market,
    }));
}

/**
 * Generate metadata for each market
 */
export async function generateMetadata({
    params,
}: {
    params: { market: string };
}): Promise<Metadata> {
    const market = params.market as Market;
    
    if (!VALID_MARKETS.includes(market)) {
        return {
            title: 'AnunciosUGC',
        };
    }
    
    const config = MARKET_CONFIG[market];
    
    // Localized titles
    const titles: Record<Market, string> = {
        us: 'AnunciosUGC - Create AI UGC Videos',
        es: 'AnunciosUGC - Crea Videos UGC con IA',
        mx: 'AnunciosUGC - Crea Videos UGC con IA',
    };
    
    const descriptions: Record<Market, string> = {
        us: 'Generate influencer-style videos where AI avatars hold and talk about your products.',
        es: 'Genera videos estilo influencer donde avatares IA sostienen y hablan de tus productos.',
        mx: 'Genera videos estilo influencer donde avatares IA sostienen y hablan de tus productos.',
    };
    
    return {
        title: titles[market],
        description: descriptions[market],
        openGraph: {
            title: titles[market],
            description: descriptions[market],
            locale: config.locale,
        },
    };
}

export default function MarketLayout({ children, params }: MarketLayoutProps) {
    const market = params.market as Market;
    
    // Validate market parameter
    if (!VALID_MARKETS.includes(market)) {
        notFound();
    }
    
    return <>{children}</>;
}

