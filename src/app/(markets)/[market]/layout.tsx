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
            title: 'Floow AI',
        };
    }
    
    const config = MARKET_CONFIG[market];
    const baseUrl = 'https://floow.ai';
    
    const seoData: Record<Market, {
        title: string;
        description: string;
        keywords: string[];
    }> = {
        us: {
            title: 'Floow AI - Create AI UGC Videos | Product Video Generator',
            description: 'Generate professional UGC ads with AI avatars. Create influencer-style product videos in minutes. Perfect for e-commerce, TikTok, and digital marketing.',
            keywords: ['AI video generator', 'UGC ads', 'product videos', 'AI avatars', 'influencer marketing', 'TikTok ads', 'e-commerce videos', 'video marketing'],
        },
        es: {
            title: 'Floow AI - Crea Videos UGC con IA | Generador de Videos de Producto',
            description: 'Genera anuncios UGC profesionales con avatares IA. Crea videos estilo influencer para tus productos en minutos. Perfecto para e-commerce, TikTok y marketing digital.',
            keywords: ['generador videos IA', 'anuncios UGC', 'videos producto', 'avatares IA', 'marketing influencer', 'anuncios TikTok', 'videos ecommerce', 'marketing video'],
        },
        mx: {
            title: 'Floow AI - Crea Videos UGC con IA | Generador de Videos de Producto',
            description: 'Genera anuncios UGC profesionales con avatares IA. Crea videos estilo influencer para tus productos en minutos. Perfecto para e-commerce, TikTok y marketing digital.',
            keywords: ['generador videos IA', 'anuncios UGC', 'videos producto', 'avatares IA', 'marketing influencer', 'anuncios TikTok', 'videos ecommerce', 'marketing video'],
        },
    };
    
    const data = seoData[market];
    const ogImage = `${baseUrl}/og-image-${market}.png`;
    
    return {
        title: data.title,
        description: data.description,
        keywords: data.keywords,
        openGraph: {
            title: data.title,
            description: data.description,
            url: `${baseUrl}/${market}`,
            siteName: 'Floow AI',
            locale: config.locale,
            type: 'website',
            images: [
                {
                    url: ogImage,
                    width: 1200,
                    height: 630,
                    alt: data.title,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: data.title,
            description: data.description,
            images: [ogImage],
        },
        alternates: {
            canonical: `${baseUrl}/${market}`,
            languages: {
                'en-US': `${baseUrl}/us`,
                'es-ES': `${baseUrl}/es`,
                'es-MX': `${baseUrl}/mx`,
            },
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

