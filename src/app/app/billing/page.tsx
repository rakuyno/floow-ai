'use client';

import { Suspense } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PLANS } from '@/lib/stripe';
import { useRouter, useSearchParams } from 'next/navigation';
import { niceAlert } from '@/lib/niceAlert';

interface Plan {
    id: string;
    name: string;
    monthly_price_cents: number;
    monthly_tokens: number;
}

interface Subscription {
    plan_id: string;
    status: string;
    current_period_end: string;
    pending_plan_id?: string | null;
    pending_effective_date?: string | null;
}

interface LedgerEntry {
    id: string;
    change: number;
    reason: string;
    created_at: string;
}

function BillingContent() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [balance, setBalance] = useState<number>(0);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [showPlanSelector, setShowPlanSelector] = useState(false);

    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('[Billing] Fetching data for user:', user.id);

        // 1. Fetch Plans
        const { data: plansData } = await supabase
            .from('subscription_plans')
            .select('*')
            .order('monthly_price_cents');
        if (plansData) setPlans(plansData);

        // 2. Fetch Subscription (including pending fields)
        const { data: subData } = await supabase
            .from('user_subscriptions')
            .select('plan_id, status, current_period_end, pending_plan_id, pending_effective_date')
            .eq('user_id', user.id)
            .maybeSingle();

        if (subData) {
            console.log('[Billing] ✅ Subscription:', subData);
            setSubscription(subData);
        }

        // 3. Fetch Balance
        const { data: balData } = await supabase
            .from('user_token_balances')
            .select('balance')
            .eq('user_id', user.id)
            .single();
        if (balData) setBalance(balData.balance);

        // 4. Fetch Ledger
        const { data: ledgerData } = await supabase
            .from('user_token_ledger')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);
        if (ledgerData) setLedger(ledgerData);

        setLoading(false);
    }, [supabase]);

    // ✅ Polling post-checkout
    useEffect(() => {
        fetchData();
        
        const success = searchParams.get('success');
        if (success) {
            console.log('[Billing] Success flag detected, starting polling...');
            let attempts = 0;
            const maxAttempts = 10; // 10 attempts * 2s = 20s max

            const interval = setInterval(async () => {
                attempts++;
                console.log('[Billing] Polling attempt:', attempts);
                await fetchData();

                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.log('[Billing] Polling completed');
                    // Clean URL
                    router.replace('/app/billing');
                }
            }, 2000);

            return () => clearInterval(interval);
        }
    }, [searchParams, fetchData, router]);

    // ✅ Handle change plan with /api/billing/change-plan
    async function handleChangePlan(targetPlanId: string) {
        setProcessing(true);

        try {
            const response = await fetch('/api/billing/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetPlanId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to change plan');
            }

            if (result.needsCheckout) {
                // User is on free, need checkout
                const checkoutResponse = await fetch('/api/billing/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planId: targetPlanId })
                });

                if (!checkoutResponse.ok) throw new Error('Failed to create checkout session');

                const { url } = await checkoutResponse.json();
                window.location.href = url;
                return;
            }

            // Success - show message based on action
            if (result.action === 'upgraded') {
                niceAlert('✅ Plan actualizado inmediatamente');
            } else if (result.action === 'scheduled') {
                const date = new Date(result.effectiveDate).toLocaleDateString();
                niceAlert(`📅 Cambio programado para el ${date}`);
            } else if (result.action === 'canceling') {
                const date = new Date(result.effectiveDate).toLocaleDateString();
                niceAlert(`🗓️ Se cancelará el ${date}`);
            }

            // Refresh data
            await fetchData();
            setShowPlanSelector(false);

        } catch (error: any) {
            console.error('[Billing] Error changing plan:', error);
            niceAlert(error.message || 'Error al cambiar el plan');
        } finally {
            setProcessing(false);
        }
    }

    // ✅ Handle manage payment method (portal for payment only)
    async function handleManagePaymentMethod() {
        setProcessing(true);
        try {
            const response = await fetch('/api/billing/portal', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to create portal session');
            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error(error);
            niceAlert('No se pudo abrir el portal de facturación.');
            setProcessing(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando información de facturación...</p>
                </div>
            </div>
        );
    }

    const currentPlanId = subscription?.plan_id || 'free';
    const planOrder = ['free', 'starter', 'growth', 'agency'];
    const currentPlanIndex = planOrder.indexOf(currentPlanId);

    // Determine available actions
    const canUpgrade = currentPlanIndex < 3; // Not on agency
    const canDowngrade = currentPlanIndex > 0 && currentPlanIndex < 3; // Between starter and growth
    const canCancelToFree = currentPlanId !== 'free';

    // Get available upgrade/downgrade options
    const upgradeOptions = plans.filter(plan => {
        const planIndex = planOrder.indexOf(plan.id);
        return planIndex > currentPlanIndex;
    });

    const downgradeOptions = plans.filter(plan => {
        const planIndex = planOrder.indexOf(plan.id);
        return planIndex < currentPlanIndex && plan.id !== 'free';
    });

    // Check if subscription is canceling
    const isCanceling = subscription?.status === 'canceling' || subscription?.pending_plan_id === 'free';

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">Billing & Plans</h1>

            {/* Success Message (post-checkout) */}
            {searchParams.get('success') && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600 mr-3"></div>
                        <p className="text-sm text-green-800">
                            ✅ Pago procesado. Actualizando tu plan...
                        </p>
                    </div>
                </div>
            )}

            {/* Pending Change Alert */}
            {subscription?.pending_plan_id && subscription.pending_plan_id !== 'free' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                        📅 Cambio programado a{' '}
                        <strong className="font-semibold">
                            {plans.find(p => p.id === subscription.pending_plan_id)?.name}
                        </strong>
                        {' '}para el{' '}
                        <strong className="font-semibold">
                            {new Date(subscription.pending_effective_date!).toLocaleDateString()}
                        </strong>
                    </p>
                </div>
            )}

            {/* Canceling Alert */}
            {isCanceling && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                        🗓️ Tu suscripción se cancelará el{' '}
                        <strong className="font-semibold">
                            {new Date(subscription!.current_period_end).toLocaleDateString()}
                        </strong>
                        . Seguirás teniendo acceso hasta entonces.
                    </p>
                </div>
            )}

            {/* Current Status */}
            <div className="bg-white rounded-xl shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Plan Actual</h3>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">
                        {plans.find(p => p.id === currentPlanId)?.name || 'Free'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Estado:{' '}
                        <span className={`capitalize font-medium ${
                            subscription?.status === 'active' ? 'text-green-600' : 
                            isCanceling ? 'text-yellow-600' :
                            'text-gray-500'
                        }`}>
                            {isCanceling ? 'Cancelando' : subscription?.status || 'Inactivo'}
                        </span>
                    </p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Saldo de Tokens</h3>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{balance}</p>
                    <p className="text-sm text-gray-500 mt-1">Disponibles para generar</p>
                </div>
                <div className="flex flex-col gap-2 justify-center items-end">
                    {/* ✅ New: Smart buttons based on plan */}
                    {currentPlanId !== 'free' && !isCanceling && (
                        <>
                            {(canUpgrade || canDowngrade) && (
                                <button
                                    onClick={() => setShowPlanSelector(!showPlanSelector)}
                                    disabled={processing}
                                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
                                >
                                    Cambiar Plan
                                </button>
                            )}
                            
                            <button
                                onClick={() => handleChangePlan('free')}
                                disabled={processing}
                                className="w-full sm:w-auto px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                                Pasar a Free
                            </button>

                            <button
                                onClick={handleManagePaymentMethod}
                                disabled={processing}
                                className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                                Gestionar Método de Pago
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Plan Selector (visible when "Cambiar Plan" is clicked) */}
            {showPlanSelector && !isCanceling && (
                <div className="bg-white rounded-xl shadow p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Selecciona tu nuevo plan</h2>
                    
                    {upgradeOptions.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">✨ Upgrades</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {upgradeOptions.map(plan => (
                                    <button
                                        key={plan.id}
                                        onClick={() => handleChangePlan(plan.id)}
                                        disabled={processing}
                                        className="border-2 border-green-200 rounded-lg p-4 hover:border-green-400 hover:bg-green-50 disabled:opacity-50 text-left transition-colors"
                                    >
                                        <p className="font-semibold text-gray-900">{plan.name}</p>
                                        <p className="text-2xl font-bold text-green-600 my-2">
                                            €{plan.monthly_price_cents / 100}/mo
                                        </p>
                                        <p className="text-sm text-gray-600">{plan.monthly_tokens} tokens/mes</p>
                                        <p className="text-xs text-green-600 mt-2">Cambio inmediato + prorrateo</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {downgradeOptions.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">📉 Downgrades</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {downgradeOptions.map(plan => (
                                    <button
                                        key={plan.id}
                                        onClick={() => handleChangePlan(plan.id)}
                                        disabled={processing}
                                        className="border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 text-left transition-colors"
                                    >
                                        <p className="font-semibold text-gray-900">{plan.name}</p>
                                        <p className="text-2xl font-bold text-blue-600 my-2">
                                            €{plan.monthly_price_cents / 100}/mo
                                        </p>
                                        <p className="text-sm text-gray-600">{plan.monthly_tokens} tokens/mes</p>
                                        <p className="text-xs text-blue-600 mt-2">
                                            Aplicará en próxima renovación
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Plans Grid for Free users */}
            {currentPlanId === 'free' && (
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Planes Disponibles</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {plans.filter(p => p.id !== 'free').map((plan) => (
                            <div key={plan.id} className="border rounded-xl p-6 flex flex-col border-gray-200">
                                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                                <div className="mt-4 mb-6">
                                    <span className="text-3xl font-bold text-gray-900">€{plan.monthly_price_cents / 100}</span>
                                    <span className="text-gray-500">/mo</span>
                                </div>
                                <ul className="space-y-3 mb-6 flex-1">
                                    <li className="flex items-center text-sm text-gray-600">
                                        <span className="mr-2">🪙</span> {plan.monthly_tokens} tokens/mo
                                    </li>
                                    <li className="flex items-center text-sm text-gray-600">
                                        <span className="mr-2">✨</span> Sin Marca de Agua
                                    </li>
                                </ul>
                                <button
                                    onClick={() => handleChangePlan(plan.id)}
                                    disabled={processing}
                                    className="w-full py-2 rounded-lg font-medium transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {processing ? 'Procesando...' : 'Suscribirse'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Token History */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Actividad de Tokens</h3>
                </div>
                {ledger.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Razón</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cambio</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {ledger.map((entry) => (
                                <tr key={entry.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(entry.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                                        {entry.reason.replace(/_/g, ' ')}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${entry.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {entry.change > 0 ? '+' : ''}{entry.change}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="px-6 py-8 text-center text-gray-500">
                        No hay actividad de tokens todavía
                    </div>
                )}
            </div>
        </div>
    );
}

export default function BillingPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        }>
            <BillingContent />
        </Suspense>
    );
}
