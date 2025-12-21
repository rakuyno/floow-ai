import { NextResponse } from 'next/server';

/**
 * ⚠️ DEPRECATED - This endpoint is no longer used
 * Use /api/billing/checkout instead
 */
export async function POST() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Use /api/billing/checkout instead.' },
        { status: 410 }
    );
}
