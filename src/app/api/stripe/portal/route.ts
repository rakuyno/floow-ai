import { NextResponse } from 'next/server';

/**
 * ⚠️ DEPRECATED - This endpoint is no longer used
 * Use /api/billing/portal instead
 */
export async function POST() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Use /api/billing/portal instead.' },
        { status: 410 }
    );
}
