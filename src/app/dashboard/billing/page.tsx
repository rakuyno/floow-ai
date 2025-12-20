'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Legacy billing page - redirects to /app/billing
 * Kept for backward compatibility with existing links
 */
function BillingRedirectContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Preserve query parameters (e.g., ?success=true)
        const queryString = searchParams.toString();
        const targetUrl = queryString 
            ? `/app/billing?${queryString}` 
            : '/app/billing';
        
        console.log('[DASHBOARD BILLING] Redirecting to:', targetUrl);
        router.replace(targetUrl);
    }, [router, searchParams]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Redirecting to billing...</p>
            </div>
        </div>
    );
}

export default function DashboardBillingRedirect() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        }>
            <BillingRedirectContent />
        </Suspense>
    );
}
