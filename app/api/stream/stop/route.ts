import { NextRequest, NextResponse } from 'next/server';
import { stopStreamSession } from '@/lib/stream-manager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const sessionId = body.sessionId || searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 });
    }

    const { success, session } = stopStreamSession(sessionId, 'User stopped stream');

    return NextResponse.json({
      success,
      sessionId,
      status: 'stopped',
      totalBytes: session?.totalBytes || 0,
      uptimeSeconds: session ? Math.floor((Date.now() - session.createdAt) / 1000) : 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error stopping stream';
    console.error('Error stopping live stream:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
