import { NextResponse, type NextRequest } from 'next/server';

const DVLA_BASE = 'https://driver-vehicle-licensing.api.gov.uk';

// Simple allowlist: only proxy the Vehicle Enquiry endpoint we need.
const ALLOWED_PATH = 'vehicle-enquiry/v1/vehicles';

export async function POST(req: NextRequest, { params }: { params: { path?: string[] } }) {
    const path = (params?.path ?? []).join('/');
    if (path !== ALLOWED_PATH) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const apiKey = process.env.DVLA_API_KEY || process.env.NEXT_PUBLIC_DVLA_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'DVLA API key not configured' }, { status: 500 });
    }

    let payload: { registrationNumber?: string } = {};
    try {
        const json = await req.json();
        payload = typeof json === 'object' && json ? json : {};
    } catch {
        // Fall back to empty payload; validation below will catch.
    }

    const registrationNumber = payload.registrationNumber?.toString().trim().toUpperCase();
    if (!registrationNumber) {
        return NextResponse.json({ error: 'registrationNumber is required' }, { status: 400 });
    }

    const body = JSON.stringify({ registrationNumber });

    try {
        const upstream = await fetch(`${DVLA_BASE}/${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'x-api-key': apiKey,
            },
            body,
            cache: 'no-store',
        });

        const text = await upstream.text();
        let json: any = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = { message: text || 'Unknown response from DVLA' };
        }

        if (!upstream.ok) {
            const errorPayload = json ?? { error: 'DVLA request failed' };
            return NextResponse.json(errorPayload, { status: upstream.status });
        }

        return NextResponse.json(json ?? {}, { status: upstream.status });
    } catch (err) {
        console.error('DVLA proxy error', err);
        return NextResponse.json({ error: 'DVLA proxy error' }, { status: 502 });
    }
}
