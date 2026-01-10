'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { createClient } from '@/lib/supabase/client'
import { useMarket } from '@/lib/hooks/useMarket'
import { centsToAmount } from '@/lib/i18n'

interface Plan {
    id: string
    name: string
    monthly_price_cents: number
    monthly_tokens: number
}

interface PricingModalProps {
    isOpen: boolean
    onClose: () => void
    currentPlanId?: string
}

// Token packages for slider
const TOKEN_PACKAGES = [
    { tokens: 100, price: 15, scenes: 10 },
    { tokens: 300, price: 39, scenes: 30 },
    { tokens: 600, price: 69, scenes: 60 },
    { tokens: 1200, price: 129, scenes: 120 },
    { tokens: 3000, price: 299, scenes: 300 },
    { tokens: 6000, price: 549, scenes: 600 },
]

// Helper: Calculate video seconds from tokens (10 tokens = 4 seconds)
const tokensToSeconds = (tokens: number) => Math.floor((tokens * 4) / 10)

export default function PricingModal({ isOpen, onClose, currentPlanId = 'free' }: PricingModalProps) {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)
    const [userPlan, setUserPlan] = useState<string>(currentPlanId)
    const [tokenSliderIndex, setTokenSliderIndex] = useState(2) // Default to 600 tokens
    const [buyingTokens, setBuyingTokens] = useState(false)
    const supabase = createClient()
    
    // Get current market using custom hook
    const market = useMarket()

    useEffect(() => {
        if (isOpen) {
            fetchPlans()
            fetchSubscription()
        }
    }, [isOpen])

    const fetchPlans = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('subscription_plans')
            .select('*')
            .order('monthly_price_cents')

        if (data) {
            setPlans(data)
        }
        setLoading(false)
    }

    const fetchSubscription = async () => {
        const { data } = await supabase
            .from('user_subscriptions')
            .select('plan_id')
            .maybeSingle()
        if (data?.plan_id) setUserPlan(data.plan_id)
    }

    const handleSubscribe = async (planId: string) => {
        setProcessing(planId)
        try {
            const response = await fetch('/api/billing/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetPlanId: planId, market })
            })

            if (!response.ok) throw new Error('Failed to create checkout session')

            const result = await response.json()
            if (result.needsCheckout && result.checkoutUrl) {
                window.location.href = result.checkoutUrl
            }
        } catch (error) {
            console.error(error)
            alert('Error al iniciar el pago')
            setProcessing(null)
        }
    }

    const handleBuyTokens = async () => {
        setBuyingTokens(true)
        try {
            const selectedPackage = TOKEN_PACKAGES[tokenSliderIndex]
            const response = await fetch('/api/billing/buy-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenAmount: selectedPackage.tokens, market })
            })

            if (!response.ok) throw new Error('Failed to create checkout session')

            const { checkoutUrl } = await response.json()
            window.location.href = checkoutUrl
        } catch (error) {
            console.error(error)
            alert('Error al procesar la compra')
            setBuyingTokens(false)
        }
    }

    // Filter plans to show only upgrades
    const filteredPlans = plans.filter(plan => {
        const order = ['free', 'starter', 'growth', 'agency']
        return order.indexOf(plan.id) > order.indexOf(userPlan || currentPlanId)
    })
    
    const selectedTokenPackage = TOKEN_PACKAGES[tokenSliderIndex]

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
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl sm:p-6">
                                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                        onClick={onClose}
                                    >
                                        <span className="sr-only">Cerrar</span>
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="text-center mb-8">
                                    <Dialog.Title as="h3" className="text-2xl font-bold leading-6 text-gray-900">
                                        Mejora tu Plan
                                    </Dialog.Title>
                                    <p className="mt-2 text-sm text-gray-500">
                                        Elige el plan que mejor se adapte a tus necesidades y elimina la marca de agua.
                                    </p>
                                </div>

                                {loading ? (
                                    <div className="py-12 text-center">Cargando planes...</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                                        {/* Plan Cards */}
                                        {filteredPlans.map((plan) => {
                                            const videoSeconds = tokensToSeconds(plan.monthly_tokens)
                                            return (
                                                <div
                                                    key={plan.id}
                                                    className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                                                        plan.id === 'growth' ? 'border-indigo-600 ring-2 ring-indigo-600' : 'border-gray-200'
                                                    }`}
                                                >
                                                    {plan.id === 'growth' && (
                                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-600 text-xs font-medium text-white">
                                                            Más Popular
                                                        </div>
                                                    )}
                                                    <div className="mb-4">
                                        <h3 className="text-lg font-semibold leading-8 text-gray-900">{plan.name}</h3>
                                        <p className="mt-2 flex items-baseline gap-x-1">
                                            <span className="text-3xl font-bold tracking-tight text-gray-900">
                                                {plan.monthly_price_cents === 0 ? 'Gratis' : centsToAmount(plan.monthly_price_cents, market)}
                                            </span>
                                            <span className="text-sm font-semibold leading-6 text-gray-600">/mes</span>
                                        </p>
                                                    </div>
                                                    <ul role="list" className="mb-6 space-y-3 text-sm leading-6 text-gray-600 flex-1">
                                                        <li className="flex gap-x-3">
                                                            <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                            </svg>
                                                            <span><strong>{plan.monthly_tokens} tokens</strong>/mes</span>
                                                        </li>
                                                        <li className="flex gap-x-3">
                                                            <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                            </svg>
                                                            <span>≈ {videoSeconds}s de vídeo</span>
                                                        </li>
                                                        <li className="flex gap-x-3">
                                                            <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                            </svg>
                                                            <span>{plan.id === 'free' ? 'Con Marca de Agua' : 'Sin Marca de Agua'}</span>
                                                        </li>
                                                        {plan.id !== 'free' && plan.id !== 'starter' && (
                                                            <li className="flex gap-x-3">
                                                                <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                                </svg>
                                                                <span>Soporte Prioritario</span>
                                                            </li>
                                                        )}
                                                    </ul>
                                                    <button
                                                        onClick={() => handleSubscribe(plan.id)}
                                                        disabled={!!processing}
                                                        className={`mt-auto block w-full rounded-md px-3 py-2 text-center text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                                            plan.id === 'growth'
                                                                ? 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                                                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                                        }`}
                                                    >
                                                        {processing === plan.id ? 'Procesando...' : 'Elegir Plan'}
                                                    </button>
                                                </div>
                                            )
                                        })}

                                        {/* Token Purchase Card */}
                                        <div className="relative flex flex-col rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-md">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-600 text-xs font-medium text-white">
                                                🪙 Compra Puntual
                                            </div>
                                            <div className="mb-4">
                                                <h3 className="text-lg font-semibold leading-8 text-gray-900">Tokens Extras</h3>
                                                <p className="mt-2 flex items-baseline gap-x-1">
                                                    <span className="text-3xl font-bold tracking-tight text-emerald-700">
                                                        {centsToAmount(selectedTokenPackage.price * 100, market)}
                                                    </span>
                                                </p>
                                            </div>
                                            
                                            <div className="mb-6 space-y-4 flex-1">
                                                <div className="bg-white/80 rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-emerald-700">{selectedTokenPackage.tokens}</div>
                                                    <div className="text-xs text-gray-600">tokens</div>
                                                </div>
                                                
                                                {/* Slider */}
                                                <div className="space-y-2">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max={TOKEN_PACKAGES.length - 1}
                                                        value={tokenSliderIndex}
                                                        onChange={(e) => setTokenSliderIndex(parseInt(e.target.value))}
                                                        className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                                    />
                                                    <div className="flex justify-between text-[10px] text-gray-500 px-1">
                                                        <span>100</span>
                                                        <span>6000</span>
                                                    </div>
                                                </div>

                                                <ul className="space-y-2 text-xs text-gray-600">
                                                    <li className="flex gap-x-2">
                                                        <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>≈ {selectedTokenPackage.scenes} escenas</span>
                                                    </li>
                                                    <li className="flex gap-x-2">
                                                        <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>Se suman a tu saldo</span>
                                                    </li>
                                                    <li className="flex gap-x-2">
                                                        <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>No caducan</span>
                                                    </li>
                                                </ul>
                                            </div>
                                            
                                            <button
                                                onClick={handleBuyTokens}
                                                disabled={buyingTokens}
                                                className="mt-auto block w-full rounded-md px-3 py-2 text-center text-sm font-semibold shadow-sm bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
                                            >
                                                {buyingTokens ? 'Procesando...' : 'Comprar Ahora'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    )
}
