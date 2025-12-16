'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { createClient } from '@/lib/supabase/client'

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

export default function PricingModal({ isOpen, onClose, currentPlanId = 'free' }: PricingModalProps) {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)
    const [userPlan, setUserPlan] = useState<string>(currentPlanId)
    const supabase = createClient()

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
            // Filter out free plan if you only want to show upgrades, 
            // but user asked for "plans and offers", so maybe show all except free?
            // Or show all. Let's show all but highlight paid ones.
            // Actually, usually you don't show Free in an "Upgrade" popup unless it's for comparison.
            // Let's show all for now.
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
            const response = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId })
            })

            if (!response.ok) throw new Error('Failed to create checkout session')

            const { url } = await response.json()
            window.location.href = url
        } catch (error) {
            console.error(error)
            alert('Error al iniciar el pago')
            setProcessing(null)
        }
    }

    // Filter plans to show only upgrades
    const filteredPlans = plans.filter(plan => {
        const order = ['free', 'starter', 'growth', 'agency']
        return order.indexOf(plan.id) > order.indexOf(userPlan || currentPlanId)
    })
    
    // Calculate max width based on number of plans
    const planCount = filteredPlans.length
    const maxWidthClass = planCount === 1 ? 'sm:max-w-md' : planCount === 2 ? 'sm:max-w-2xl' : 'sm:max-w-4xl'
    const gridColsClass = planCount === 1 ? 'sm:grid-cols-1' : planCount === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'

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
                            <Dialog.Panel className={`relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full ${maxWidthClass} sm:p-6`}>
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
                                    <div className={`grid grid-cols-1 gap-6 ${gridColsClass}`}>
                                        {filteredPlans.map((plan) => (
                                            <div
                                                key={plan.id}
                                                className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${plan.id === 'growth' ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-gray-200'
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
                                                            {plan.monthly_price_cents === 0 ? 'Gratis' : `€${plan.monthly_price_cents / 100}`}
                                                        </span>
                                                        <span className="text-sm font-semibold leading-6 text-gray-600">/mes</span>
                                                    </p>
                                                </div>
                                                <ul role="list" className="mb-6 space-y-3 text-sm leading-6 text-gray-600 flex-1">
                                                    <li className="flex gap-x-3">
                                                        <span className="text-indigo-600">✓</span>
                                                        {plan.monthly_tokens} tokens/mes
                                                    </li>
                                                    <li className="flex gap-x-3">
                                                        <span className="text-indigo-600">✓</span>
                                                        {plan.id === 'free' ? 'Con Marca de Agua' : 'Sin Marca de Agua'}
                                                    </li>
                                                    {plan.id !== 'free' && (
                                                        <li className="flex gap-x-3">
                                                            <span className="text-indigo-600">✓</span>
                                                            Soporte Prioritario
                                                        </li>
                                                    )}
                                                </ul>
                                                <button
                                                    onClick={() => handleSubscribe(plan.id)}
                                                    disabled={!!processing}
                                                    className={`mt-auto block w-full rounded-md px-3 py-2 text-center text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${plan.id === 'growth'
                                                            ? 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                                                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                                        }`}
                                                >
                                                    {processing === plan.id ? 'Procesando...' : 'Elegir Plan'}
                                                </button>
                                            </div>
                                        ))}
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
