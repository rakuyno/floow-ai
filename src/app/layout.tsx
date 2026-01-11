import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    metadataBase: new URL('https://floow.ai'),
    title: {
        default: 'Floow AI - Create AI UGC Videos for Your Products',
        template: '%s | Floow AI'
    },
    description: 'Generate influencer-style product videos with AI avatars. Create professional UGC ads in minutes for e-commerce and digital marketing.',
    keywords: ['AI video generation', 'UGC ads', 'product videos', 'AI avatars', 'video marketing', 'influencer videos', 'e-commerce videos'],
    authors: [{ name: 'Floow AI' }],
    creator: 'Floow AI',
    publisher: 'Floow AI',
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://floow.ai',
        siteName: 'Floow AI',
        title: 'Floow AI - Create AI UGC Videos',
        description: 'Generate influencer-style product videos with AI avatars in minutes',
        images: [{
            url: '/og-image.png',
            width: 1200,
            height: 630,
            alt: 'Floow AI - AI UGC Video Generator',
        }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Floow AI - Create AI UGC Videos',
        description: 'Generate influencer-style product videos with AI avatars',
        images: ['/og-image.png'],
    },
    alternates: {
        canonical: 'https://floow.ai',
        languages: {
            'en-US': 'https://floow.ai/us',
            'es-ES': 'https://floow.ai/es',
            'es-MX': 'https://floow.ai/mx',
        },
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <SpeedInsights />
                {children}
            </body>
        </html>
    )
}
