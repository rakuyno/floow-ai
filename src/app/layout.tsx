import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'AnunciosUGC',
    description: 'Genera anuncios UGC con IA',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es">
            <body className={inter.className}>{children}</body>
        </html>
    )
}
