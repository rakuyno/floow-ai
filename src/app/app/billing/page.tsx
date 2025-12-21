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
    const [showPlanModal, setShowPlanModal] = useState(false);

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

    // Handle change plan - always redirect to checkout
    async function handleChangePlan(targetPlanId: string) {
        setProcessing(true);

        try {
            const response = await fetch('/api/billing/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetPlanId })
            });

            const contentType = response.headers.get('content-type');
            let result: any = null;

            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const text = await response.text();
                console.error('[Billing] Non-JSON response:', text);
                throw new Error('Error al cambiar plan. Revisa logs.');
            }

            if (!response.ok) {
                throw new Error(result?.error || 'Error al cambiar plan.');
            }

            // If cancel to free
            if (result.action === 'canceled') {
                niceAlert('Suscripción cancelada');
                await fetchData();
                setShowPlanModal(false);
                return;
            }

            // Always redirect to checkout for paid plans
            if (result.needsCheckout && result.checkoutUrl) {
                window.location.href = result.checkoutUrl;
                return;
            }

        } catch (error: any) {
            console.error('[Billing] Error changing plan:', error);
            niceAlert(error.message || 'Error al cambiar plan.');
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
                            subscription?.status === 'active' ? 'text-green-600' : 'text-gray-500'
                        }`}>
                            {subscription?.status || 'Inactivo'}
                        </span>
                    </p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Saldo de Tokens</h3>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{balance}</p>
                    <p className="text-sm text-gray-500 mt-1">Disponibles para generar</p>
                </div>
                <div className="flex flex-col gap-2 justify-center items-end">
                    {/* Botón principal: Cambiar plan */}
                    <button
                        onClick={() => setShowPlanModal(true)}
                        disabled={processing}
                        className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                        Cambiar plan
                    </button>
                    {/* Botón secundario: Portal (pago/facturas) */}
                    {currentPlanId !== 'free' && (
                        <button
                            onClick={handleManagePaymentMethod}
                            disabled={processing}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 underline underline-offset-4 disabled:opacity-50"
                        >
                            Gestionar método de pago / facturas
                        </button>
                    )}
                </div>
            </div>

            {/* Modal de cambio de plan (cards simples) */}
            {showPlanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full p-6 relative">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-2xl font-semibold text-gray-900">Cambiar plan</h2>
                                <p className="text-sm text-gray-600">Selecciona el plan que mejor se adapte.</p>
                            </div>
                            <button
                                onClick={() => setShowPlanModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Banner de cambio programado */}
                        {subscription?.pending_plan_id && subscription.pending_plan_id !== 'free' && (
                            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                                Cambio programado para la próxima renovación
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            {plans.map(plan => {
                                const planIndex = planOrder.indexOf(plan.id);
                                const currentIndex = planOrder.indexOf(currentPlanId);
                                const isCurrent = plan.id === currentPlanId;

                                // Simple CTA label
                                let ctaLabel = 'Cambiar';
                                if (isCurrent) ctaLabel = 'Plan actual';

                                return (
                                    <div key={plan.id} className="border rounded-xl p-4 flex flex-col">
                                        <div className="mb-2">
                                            <p className="text-sm text-gray-500 uppercase">{plan.id === 'free' ? 'Gratis' : 'Plan'}</p>
                                            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-3xl font-bold text-gray-900">
                                                {plan.monthly_price_cents === 0 ? '€0' : `€${plan.monthly_price_cents / 100}`}
                                            </p>
                                            <p className="text-sm text-gray-500">/mes · {plan.monthly_tokens} tokens</p>
                                        </div>
                                        <div className="flex-1 mb-4 text-sm text-gray-600 space-y-1">
                                            <p>• Tokens mensuales: {plan.monthly_tokens}</p>
                                            <p>• Sin marca de agua {plan.id === 'free' ? '(no aplica)' : ''}</p>
                                        </div>
                                        <button
                                            onClick={() => handleChangePlan(plan.id)}
                                            disabled={processing || isCurrent}
                                            className={`mt-auto w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                                                isCurrent
                                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                                            }`}
                                        >
                                            {processing && !isCurrent ? 'Procesando...' : ctaLabel}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
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
