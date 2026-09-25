import { NextRequest, NextResponse } from 'next/server';
import { writeStreamChunk } from '@/lib/stream-manager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || req.headers.get('x-session-id');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    const arrayBuffer = await req.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ success: true, bytes: 0 });
    }

    const chunk = Buffer.from(arrayBuffer);
    const result = writeStreamChunk(sessionId, chunk);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to write chunk to stream' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      bytes: chunk.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error writing chunk';
    console.error('Error writing stream chunk:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
