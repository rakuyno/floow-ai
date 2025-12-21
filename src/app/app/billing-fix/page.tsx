'use client';

import { useState } from 'react';

export default function ManualFixPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleFix() {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/billing/manual-fix', {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Error al procesar');
            } else {
                setResult(data);
            }
        } catch (err: any) {
            setError(err.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        🛠️ Fix Manual de Suscripciones
                    </h1>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-yellow-800">
                            <strong>Nota:</strong> Esta herramienta es temporal para arreglar suscripciones que se pagaron pero no se procesaron por el webhook.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="text-sm text-gray-600">
                            <p className="mb-2"><strong>Esta herramienta hará:</strong></p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Buscar todas tus suscripciones activas en Stripe</li>
                                <li>Cancelar las viejas (mantener solo la más reciente)</li>
                                <li>Actualizar tu plan en la base de datos</li>
                                <li>Mostrar el balance de tokens (NO los añade automáticamente)</li>
                            </ul>
                        </div>

                        <button
                            onClick={handleFix}
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Procesando...' : 'Ejecutar Fix'}
                        </button>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm text-red-800">
                                    <strong>❌ Error:</strong> {error}
                                </p>
                            </div>
                        )}

                        {result && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-sm text-green-800 font-medium mb-3">
                                    ✅ {result.message}
                                </p>
                                
                                {result.details && (
                                    <div className="space-y-2 text-sm text-gray-700">
                                        <div className="grid grid-cols-2 gap-2">
                                            <span className="font-medium">Suscripción activa:</span>
                                            <span className="font-mono text-xs">{result.details.activeSubscription}</span>
                                            
                                            <span className="font-medium">Plan:</span>
                                            <span className="uppercase font-bold">{result.details.planId}</span>
                                            
                                            <span className="font-medium">Suscripciones canceladas:</span>
                                            <span>{result.details.canceledSubscriptions}</span>
                                            
                                            <span className="font-medium">Balance actual:</span>
                                            <span>{result.details.currentBalance} tokens</span>
                                            
                                            <span className="font-medium">Tokens del plan:</span>
                                            <span>{result.details.tokensAvailable} tokens</span>
                                        </div>
                                        
                                        {result.details.note && (
                                            <div className="mt-3 pt-3 border-t border-green-300">
                                                <p className="text-xs text-green-700">
                                                    <strong>Nota:</strong> {result.details.note}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-green-300">
                                    <a 
                                        href="/app/billing"
                                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        ← Volver a Billing
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <h2 className="text-sm font-medium text-gray-900 mb-3">
                            📋 Pasos siguientes:
                        </h2>
                        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                            <li>Ejecuta el fix con el botón de arriba</li>
                            <li>Ve a <a href="/app/billing" className="text-indigo-600 hover:underline">/app/billing</a> para verificar tu plan</li>
                            <li>Verifica en <a href="https://dashboard.stripe.com/subscriptions" target="_blank" rel="noopener" className="text-indigo-600 hover:underline">Stripe Dashboard</a> que solo tengas 1 suscripción activa</li>
                            <li>Si faltan tokens, contacta soporte con el subscription ID</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
}
