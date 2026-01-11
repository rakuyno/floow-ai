'use client'

import { useState } from 'react'
import Link from 'next/link'
import PricingModal from '@/components/PricingModal'
import { useTranslations } from '@/lib/hooks/useMarket'

interface AdActionsProps {
  outputUrl: string
  hasWatermark: boolean
}

export default function AdActions({ outputUrl, hasWatermark }: AdActionsProps) {
  const [isPricingOpen, setIsPricingOpen] = useState(false)
  const t = useTranslations()

  return (
    <>
      <div className="flex flex-col gap-2 items-end">
        <a
          href={outputUrl}
          target="_blank"
          download
          className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5 text-gray-500">
            <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
          </svg>
          {hasWatermark ? t.dashboard.downloadWatermark : t.dashboard.download}
        </a>
        {hasWatermark && (
          <button
            onClick={() => setIsPricingOpen(true)}
            className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5 text-yellow-300">
              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
            </svg>
            {t.dashboard.removeWatermark}
          </button>
        )}
      </div>
      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
    </>
  )
}

