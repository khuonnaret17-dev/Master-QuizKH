import { NextRequest, NextResponse } from 'next/server';
import { getStreamSession } from '@/lib/stream-manager';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 });
  }

  const session = getStreamSession(sessionId);
  if (!session) {
    return NextResponse.json({
      success: false,
      status: 'stopped',
      error: 'Session not found or expired',
    });
  }

  const uptimeSeconds = Math.floor((Date.now() - session.createdAt) / 1000);
  const kbps = uptimeSeconds > 0 ? Math.round((session.totalBytes * 8) / uptimeSeconds / 1000) : 0;

  return NextResponse.json({
    success: true,
    id: session.id,
    status: session.status,
    uptimeSeconds,
    totalBytes: session.totalBytes,
    chunksCount: session.chunksCount,
    currentKbps: kbps,
    isTestMode: session.isTestMode,
    errorMsg: session.errorMsg,
    recentLogs: session.logs.slice(-15),
  });
}
