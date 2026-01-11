'use client';

import { Suspense } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PLANS } from '@/lib/stripe';
import { useRouter, useSearchParams } from 'next/navigation';
import { niceAlert } from '@/lib/niceAlert';
import { useTranslations } from '@/lib/hooks/useMarket';

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

// Token packages for slider
const TOKEN_PACKAGES = [
    { tokens: 100, price: 15, scenes: 10 },
    { tokens: 300, price: 39, scenes: 30 },
    { tokens: 600, price: 69, scenes: 60 },
    { tokens: 1200, price: 129, scenes: 120 },
    { tokens: 3000, price: 299, scenes: 300 },
    { tokens: 6000, price: 549, scenes: 600 },
];

// Helper: Calculate video seconds from tokens (10 tokens = 4 seconds)
const tokensToSeconds = (tokens: number) => Math.floor((tokens * 4) / 10);

function BillingContent() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [balance, setBalance] = useState<number>(0);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [tokenSliderIndex, setTokenSliderIndex] = useState(2); // Default to 600 tokens
    const [buyingTokens, setBuyingTokens] = useState(false);

    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations();

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
                throw new Error(t.billing.errorChangingPlan);
            }

            if (!response.ok) {
                throw new Error(result?.error || t.billing.errorChangingPlan);
            }

            // If cancel to free
            if (result.action === 'canceled') {
                niceAlert('Suscripción cancelada');
                await fetchData(); // ← Refresh data immediately
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
            niceAlert(error.message || t.billing.errorChangingPlan);
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
            niceAlert(t.billing.errorOpeningPortal);
            setProcessing(false);
        }
    }

    // Handle buy tokens
    async function handleBuyTokens() {
        setBuyingTokens(true);
        try {
            const selectedPackage = TOKEN_PACKAGES[tokenSliderIndex];
            const response = await fetch('/api/billing/buy-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenAmount: selectedPackage.tokens })
            });

            if (!response.ok) throw new Error('Failed to create checkout session');

            const { checkoutUrl } = await response.json();
            window.location.href = checkoutUrl;
        } catch (error) {
            console.error(error);
            niceAlert('Error al procesar la compra');
            setBuyingTokens(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">{t.billing.loadingInfo}</p>
                </div>
            </div>
        );
    }

    const currentPlanId = subscription?.plan_id || 'free';
    const planOrder = ['free', 'starter', 'growth', 'agency'];
    const currentPlanIndex = planOrder.indexOf(currentPlanId);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">{t.billing.title}</h1>

            {/* Success Message (post-checkout) */}
            {searchParams.get('success') && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600 mr-3"></div>
                        <p className="text-sm text-green-800">
                            {t.billing.paymentProcessed}
                        </p>
                    </div>
                </div>
            )}

            {/* Current Status */}
            <div className="bg-white rounded-xl shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase">{t.billing.currentPlan}</h3>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">
                        {plans.find(p => p.id === currentPlanId)?.name || 'Free'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        {t.billing.status}:{' '}
                        <span className={`capitalize font-medium ${
                            subscription?.status === 'active' ? 'text-green-600' : 'text-gray-500'
                        }`}>
                            {subscription?.status === 'active' ? t.billing.active : t.billing.inactive}
                        </span>
                    </p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase">{t.billing.tokenBalance}</h3>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{balance}</p>
                    <p className="text-sm text-gray-500 mt-1">{t.billing.available}</p>
                </div>
                <div className="flex flex-col gap-2 justify-center items-end">
                    {/* Botón principal: Cambiar plan */}
                    <button
                        onClick={() => setShowPlanModal(true)}
                        disabled={processing}
                        className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                        {t.billing.changePlan}
                    </button>
                    {/* Botón secundario: Portal (pago/facturas) */}
                    {currentPlanId !== 'free' && (
                        <button
                            onClick={handleManagePaymentMethod}
                            disabled={processing}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 underline underline-offset-4 disabled:opacity-50"
                        >
                            {t.billing.managePayment}
                        </button>
                    )}
                </div>
            </div>

            {/* Modal de cambio de plan (diseño actualizado) */}
            {showPlanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-2xl font-semibold text-gray-900">{t.billing.changePlan}</h2>
                                <p className="text-sm text-gray-600">{t.billing.selectPlan}</p>
                            </div>
                            <button
                                onClick={() => setShowPlanModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                                aria-label={t.common.close}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Banner de cambio programado */}
                        {subscription?.pending_plan_id && subscription.pending_plan_id !== 'free' && (
                            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                                {t.billing.scheduledChange}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {/* Plan Cards */}
                            {plans.map(plan => {
                                const isCurrent = plan.id === currentPlanId;
                                const videoSeconds = tokensToSeconds(plan.monthly_tokens);
                                let ctaLabel = t.billing.changePlan;
                                if (isCurrent) ctaLabel = t.billing.currentPlanLabel;

                                return (
                                    <div
                                        key={plan.id}
                                        className="relative flex flex-col rounded-2xl border p-6 shadow-sm border-gray-200"
                                    >
                                        <div className="mb-4">
                                            <h3 className="text-lg font-semibold leading-8 text-gray-900">{plan.name}</h3>
                                            <p className="mt-2 flex items-baseline gap-x-1">
                                                <span className="text-3xl font-bold tracking-tight text-gray-900">
                                                    {plan.monthly_price_cents === 0 ? '€0' : `€${plan.monthly_price_cents / 100}`}
                                                </span>
                                                <span className="text-sm font-semibold leading-6 text-gray-600">{t.billing.perMonth}</span>
                                            </p>
                                        </div>
                                        <ul role="list" className="mb-6 space-y-3 text-sm leading-6 text-gray-600 flex-1">
                                            <li className="flex gap-x-3">
                                                <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                                <span><strong>{plan.monthly_tokens} {t.billing.tokensPerMonth}</strong></span>
                                            </li>
                                            <li className="flex gap-x-3">
                                                <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                                <span>≈ {videoSeconds}s {t.billing.videoSeconds}</span>
                                            </li>
                                            <li className="flex gap-x-3">
                                                <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                                <span>{plan.id === 'free' ? t.billing.withWatermark : t.billing.noWatermark}</span>
                                            </li>
                                            {plan.id !== 'free' && plan.id !== 'starter' && (
                                                <li className="flex gap-x-3">
                                                    <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>{t.billing.prioritySupport}</span>
                                                </li>
                                            )}
                                        </ul>
                                        <button
                                            onClick={() => handleChangePlan(plan.id)}
                                            disabled={processing || isCurrent}
                                            className={`mt-auto block w-full rounded-md px-3 py-2 text-center text-sm font-semibold shadow-sm ${
                                                isCurrent
                                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                                            }`}
                                        >
                                            {processing && !isCurrent ? t.billing.processing : ctaLabel}
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Token Purchase Card */}
                            <div className="relative flex flex-col rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-md">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-600 text-xs font-medium text-white">
                                    {t.billing.oneTimePurchase}
                                </div>
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold leading-8 text-gray-900">{t.billing.extraTokens}</h3>
                                    <p className="mt-2 flex items-baseline gap-x-1">
                                        <span className="text-3xl font-bold tracking-tight text-emerald-700">
                                            €{TOKEN_PACKAGES[tokenSliderIndex].price}
                                        </span>
                                    </p>
                                </div>
                                
                                <div className="mb-6 space-y-4 flex-1">
                                    <div className="bg-white/80 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-emerald-700">{TOKEN_PACKAGES[tokenSliderIndex].tokens}</div>
                                        <div className="text-xs text-gray-600">{t.common.tokens}</div>
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
                                            <span>≈ {TOKEN_PACKAGES[tokenSliderIndex].scenes} {t.billing.scenes}</span>
                                        </li>
                                        <li className="flex gap-x-2">
                                            <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                            <span>{t.billing.addToBalance}</span>
                                        </li>
                                        <li className="flex gap-x-2">
                                            <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                            <span>{t.billing.noExpire}</span>
                                        </li>
                                    </ul>
                                </div>
                                
                                <button
                                    onClick={handleBuyTokens}
                                    disabled={buyingTokens}
                                    className="mt-auto block w-full rounded-md px-3 py-2 text-center text-sm font-semibold shadow-sm bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
                                >
                                    {buyingTokens ? t.billing.processing : t.billing.buyNow}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Token History */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">{t.billing.tokenHistory}</h3>
                </div>
                {ledger.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.billing.date}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.billing.reason}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.billing.change}</th>
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
                        {t.billing.noActivity}
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
