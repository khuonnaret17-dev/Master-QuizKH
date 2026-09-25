import { NextRequest, NextResponse } from 'next/server';
import { startStreamSession } from '@/lib/stream-manager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      rtmpUrl = 'rtmps://dc4-1.rtmp.t.me/s/',
      streamKey = '',
      isTestMode = false,
      width = 1280,
      height = 720,
      fps = 30,
      videoBitrate = '2500k',
      audioBitrate = '128k',
    } = body;

    let normalizedRtmpUrl = (typeof rtmpUrl === 'string' ? rtmpUrl : '').trim();
    if (!normalizedRtmpUrl) {
      normalizedRtmpUrl = 'rtmps://dc4-1.rtmp.t.me/s/';
    } else if (!/^rtmps?:\/\//i.test(normalizedRtmpUrl)) {
      normalizedRtmpUrl = `rtmps://${normalizedRtmpUrl}`;
    }

    const cleanStreamKey = (typeof streamKey === 'string' ? streamKey : '').trim().replace(/^["']|["']$/g, '');

    if (!isTestMode) {
      if (!cleanStreamKey || cleanStreamKey.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'សូមបញ្ចូល Stream Key ពី Telegram Channel របស់អ្នក! (ឬបើក "របៀបសាកល្បង / Test Mode" ដើម្បីតេស្តសាកល្បង)' 
          },
          { status: 400 }
        );
      }
    }

    const { session, error } = startStreamSession({
      rtmpUrl: normalizedRtmpUrl,
      streamKey: cleanStreamKey,
      isTestMode,
      width,
      height,
      fps,
      videoBitrate,
      audioBitrate,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      status: session.status,
      isTestMode: session.isTestMode,
      width: session.width,
      height: session.height,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'បរាជ័យក្នុងការចាប់ផ្ដើមការផ្សាយ';
    console.error('Error starting live stream:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
