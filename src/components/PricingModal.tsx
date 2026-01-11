'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { useMarket } from '@/lib/hooks/useMarket'
import { formatCurrency } from '@/lib/i18n'
import { Market } from '@/lib/market'

interface PricingModalProps {
    isOpen: boolean
    onClose: () => void
}

// Real pricing data by market
const PRICING_DATA: Record<Market, {
    starter: { monthly: number; annual: number };
    growth: { monthly: number; annual: number };
    agency: { monthly: number; annual: number };
}> = {
    us: {
        starter: { monthly: 45, annual: 450 },
        growth: { monthly: 99, annual: 990 },
        agency: { monthly: 249, annual: 2490 }
    },
    es: {
        starter: { monthly: 39, annual: 390 },
        growth: { monthly: 99, annual: 990 },
        agency: { monthly: 229, annual: 2229 }
    },
    mx: {
        starter: { monthly: 795, annual: 7950 },
        growth: { monthly: 1995, annual: 19950 },
        agency: { monthly: 4495, annual: 44950 }
    },
}

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
    const [isAnnual, setIsAnnual] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null)
    const market = useMarket()

    const prices = PRICING_DATA[market]

    const handleSubscribe = async (planId: string) => {
        setProcessing(planId)
        try {
            const response = await fetch('/api/billing/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    targetPlanId: planId, 
                    market,
                    interval: isAnnual ? 'annual' : 'monthly'
                })
            })

            if (!response.ok) throw new Error('Failed to create checkout session')

            const result = await response.json()
            if (result.needsCheckout && result.checkoutUrl) {
                window.location.href = result.checkoutUrl
            }
        } catch (error) {
            console.error(error)
            alert(market === 'us' ? 'Error initiating payment' : 'Error al iniciar el pago')
            setProcessing(null)
        }
    }

    const plans = [
        {
            id: 'starter',
            name: 'Starter',
            tokens: 550,
            videos: 27,
            price: isAnnual ? prices.starter.annual : prices.starter.monthly,
            isAnnual,
        },
        {
            id: 'growth',
            name: 'Growth',
            tokens: 1200,
            videos: 60,
            price: isAnnual ? prices.growth.annual : prices.growth.monthly,
            isAnnual,
            popular: true,
        },
        {
            id: 'agency',
            name: 'Agency',
            tokens: 2500,
            videos: 125,
            price: isAnnual ? prices.agency.annual : prices.agency.monthly,
            isAnnual,
        },
    ]

    const t = market === 'us' ? {
        title: 'Upgrade Your Plan',
        subtitle: 'Choose the plan that best fits your needs',
        monthly: 'Monthly',
        annual: 'Annual',
        save: 'Save',
        perMonth: '/month',
        billedAnnually: 'billed annually',
        tokens: 'tokens',
        videos: 'videos',
        noWatermark: 'No Watermark',
        prioritySupport: 'Priority Support',
        choosePlan: 'Choose Plan',
        mostPopular: 'Most Popular',
    } : {
        title: 'Mejora tu Plan',
        subtitle: 'Elige el plan que mejor se adapte a tus necesidades',
        monthly: 'Mensual',
        annual: 'Anual',
        save: 'Ahorra',
        perMonth: '/mes',
        billedAnnually: 'facturado anualmente',
        tokens: 'tokens',
        videos: 'videos',
        noWatermark: 'Sin Marca de Agua',
        prioritySupport: 'Soporte Prioritario',
        choosePlan: 'Elegir Plan',
        mostPopular: 'Más Popular',
    }

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl sm:p-6">
                                {/* Close button */}
                                <div className="absolute right-0 top-0 pr-4 pt-4">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                                        onClick={onClose}
                                    >
                                        <span className="sr-only">Close</span>
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Header */}
                                <div className="text-center mb-8">
                                    <Dialog.Title as="h3" className="text-2xl font-bold text-gray-900">
                                        {t.title}
                                    </Dialog.Title>
                                    <p className="mt-2 text-sm text-gray-500">
                                        {t.subtitle}
                                    </p>
                                </div>

                                {/* Annual/Monthly Toggle */}
                                <div className="flex justify-center mb-8">
                                    <div className="inline-flex items-center bg-gray-100 p-1 rounded-full">
                                        <button
                                            onClick={() => setIsAnnual(false)}
                                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${!isAnnual ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                                        >
                                            {t.monthly}
                                        </button>
                                        <button
                                            onClick={() => setIsAnnual(true)}
                                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isAnnual ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                                        >
                                            {t.annual}
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                {t.save}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Pricing Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {plans.map((plan) => (
                                        <div
                                            key={plan.id}
                                            className={`relative flex flex-col rounded-2xl border p-6 ${
                                                plan.popular ? 'border-indigo-600 ring-2 ring-indigo-600' : 'border-gray-200'
                                            }`}
                                        >
                                            {plan.popular && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-600 text-xs font-medium text-white">
                                                    {t.mostPopular}
                                                </div>
                                            )}
                                            
                                            <div className="mb-4">
                                                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                                                <div className="mt-2">
                                                    <div className="flex items-baseline gap-x-1">
                                                        <span className="text-3xl font-bold text-gray-900">
                                                            {formatCurrency(isAnnual ? plan.price / 12 : plan.price, market, { showDecimals: false })}
                                                        </span>
                                                        <span className="text-sm text-gray-600">{t.perMonth}</span>
                                                    </div>
                                                    {isAnnual && (
                                                        <p className="text-xs text-green-600 mt-1">
                                                            {formatCurrency(plan.price, market, { showDecimals: false })} {t.billedAnnually}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <ul className="mb-6 space-y-3 text-sm text-gray-600 flex-1">
                                                <li className="flex gap-x-2 items-center">
                                                    <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                    </svg>
                                                    <span><strong>{plan.tokens} {t.tokens}</strong></span>
                                                </li>
                                                <li className="flex gap-x-2 items-center">
                                                    <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>≈ {plan.videos} {t.videos}</span>
                                                </li>
                                                <li className="flex gap-x-2 items-center">
                                                    <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>{t.noWatermark}</span>
                                                </li>
                                                {plan.id !== 'starter' && (
                                                    <li className="flex gap-x-2 items-center">
                                                        <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>{t.prioritySupport}</span>
                                                    </li>
                                                )}
                                            </ul>

                                            <button
                                                onClick={() => handleSubscribe(plan.id)}
                                                disabled={!!processing}
                                                className={`w-full rounded-md px-3 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                                                    plan.popular
                                                        ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                                                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                                }`}
                                            >
                                                {processing === plan.id ? (market === 'us' ? 'Processing...' : 'Procesando...') : t.choosePlan}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    )
}
