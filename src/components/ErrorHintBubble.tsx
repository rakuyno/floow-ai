'use client'

import { useState } from 'react'
import { useTranslations } from '@/lib/hooks/useMarket'

export default function ErrorHintBubble({
  message,
  label,
  buttonClassName = ''
}: {
  message: string
  label?: string
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const t = useTranslations()
  const displayLabel = label || t.errors.reasonDetected

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-300 bg-white text-[11px] font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 ${buttonClassName}`}
        aria-label={displayLabel}
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-30 w-64 max-w-[80vw] rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-900 shadow-lg whitespace-normal break-words sm:left-6 sm:top-1/2 sm:-translate-y-1/2">
          <p className="text-[11px] font-semibold text-gray-500 mb-1">{displayLabel}</p>
          <p className="leading-5">{message}</p>
        </div>
      )}
    </div>
  )
}

