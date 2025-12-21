import { NextResponse } from 'next/server';

/**
 * ⚠️ DEPRECATED - This endpoint is no longer used
 * Use /api/webhooks/stripe instead
 */
export async function POST() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Use /api/webhooks/stripe instead.' },
        { status: 410 }
    );
}
