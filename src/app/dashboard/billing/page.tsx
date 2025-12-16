'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
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

    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        fetchData();
        if (searchParams.get('success')) {
            router.replace('/dashboard/billing');
        }
    }, []);

    async function fetchData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('[Billing] Fetching data for user:', user.id);

        // 1. Fetch Plans
        const { data: plansData, error: plansError } = await supabase.from('subscription_plans').select('*').order('monthly_price_cents');
        if (plansError) {
            console.error('[Billing] Error fetching plans:', plansError);
        }
        if (plansData) {
            console.log('[Billing] Plans fetched:', plansData);
            setPlans(plansData);
        }

        // 2. Fetch Subscription
        const { data: subData, error: subError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(); // Use maybeSingle instead of single to avoid error if no rows

        console.log('[Billing] Raw subscription response:', { subData, subError });

        if (subError) {
            console.error('[Billing] Error fetching subscription:', subError);
            console.error('[Billing] Error code:', subError.code);
            console.error('[Billing] Error message:', subError.message);
            console.error('[Billing] Error details:', subError.details);
            niceAlert('No se pudo obtener la suscripción. Revisa la consola para más detalles.');
        }

        if (subData) {
            console.log('[Billing] ✅ Subscription fetched:', subData);
            console.log('[Billing] ✅ Plan ID:', subData.plan_id);
            setSubscription(subData);
        } else {
            console.warn('[Billing] ⚠️ No subscription found for user, defaulting to free');
            console.warn('[Billing] ⚠️ This means there is NO row in user_subscriptions for this user');
            niceAlert('No se encontró una suscripción. Revisa la configuración en base de datos.');
        }

        // 3. Fetch Balance
        const { data: balData, error: balError } = await supabase.from('user_token_balances').select('balance').eq('user_id', user.id).single();
        if (balError) {
            console.error('[Billing] Error fetching balance:', balError);
        }
        if (balData) {
            console.log('[Billing] Balance fetched:', balData.balance);
            setBalance(balData.balance);
        }

        // 4. Fetch Ledger
        const { data: ledgerData, error: ledgerError } = await supabase.from('user_token_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
        if (ledgerError) {
            console.error('[Billing] Error fetching ledger:', ledgerError);
        }
        if (ledgerData) {
            console.log('[Billing] Ledger fetched:', ledgerData.length, 'entries');
            setLedger(ledgerData);
        }

        setLoading(false);
    }

    async function handleSubscribe(planId: string) {
        setProcessing(true);
        try {
            const response = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId })
            });

            if (!response.ok) throw new Error('Failed to create checkout session');

            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error(error);
            niceAlert('No se pudo iniciar el pago. Intenta de nuevo.');
            setProcessing(false);
        }
    }

    async function handleManageSubscription() {
        setProcessing(true);
        try {
            const response = await fetch('/api/billing/portal', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to create portal session');
            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error(error);
            niceAlert('No se pudo abrir el portal de facturación. Intenta de nuevo.');
            setProcessing(false);
        }
    }

    if (loading) return <div className="p-8 text-center">Loading billing info...</div>;

    // Determine current plan ID (default to 'free' if no subscription)
    const currentPlanId = subscription?.plan_id || 'free';
    console.log('[Billing] Current plan ID:', currentPlanId);

    // Define plan order for filtering
    const planOrder = ['free', 'starter', 'growth', 'agency'];
    const currentPlanIndex = planOrder.indexOf(currentPlanId);

    // Filter plans to show only those higher than current plan
    const upgradePlans = plans.filter(plan => {
        const planIndex = planOrder.indexOf(plan.id);
        return planIndex > currentPlanIndex;
    });

    console.log('[Billing] Upgrade plans to show:', upgradePlans.map(p => p.id));

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">Billing & Plans</h1>

            {/* Current Status */}
            <div className="bg-white rounded-xl shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Plan Actual</h3>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">
                        {plans.find(p => p.id === subscription?.plan_id)?.name || 'Free'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Estado: <span className={`capitalize font-medium ${subscription?.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                            {subscription?.status === 'active' ? 'Activo' : subscription?.status || 'Inactivo'}
                        </span>
                    </p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Saldo de Tokens</h3>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{balance}</p>
                    <p className="text-sm text-gray-500 mt-1">Disponibles para generar</p>
                </div>
                <div className="flex flex-col gap-2 justify-center items-end">
                    {subscription?.plan_id !== 'free' && (
                        <>
                            <button
                                onClick={handleManageSubscription}
                                disabled={processing}
                                className="w-full sm:w-auto px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                                Cambiar Plan / Método de Pago
                            </button>
                            <button
                                onClick={handleManageSubscription}
                                disabled={processing}
                                className="w-full sm:w-auto px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                                Cancelar Suscripción
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Plans Grid - Only show upgrade options */}
            {upgradePlans.length > 0 ? (
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Planes Disponibles</h2>
                    <div className={`grid grid-cols-1 gap-6 ${upgradePlans.length === 1 ? 'md:grid-cols-1 max-w-md' : upgradePlans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                        {upgradePlans.map((plan) => (
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
                                    onClick={() => handleSubscribe(plan.id)}
                                    disabled={processing}
                                    className="w-full py-2 rounded-lg font-medium transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {processing ? 'Processing...' : 'Upgrade'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow p-8 text-center">
                    <p className="text-lg text-gray-600">🎉 Ya tienes el plan más alto disponible</p>
                    <p className="text-sm text-gray-500 mt-2">Gracias por tu apoyo</p>
                </div>
            )}

            {/* Token History */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Actividad de Tokens</h3>
                </div>
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
            </div>
        </div>
    );
}

export default function BillingPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <BillingContent />
        </Suspense>
    );
}
