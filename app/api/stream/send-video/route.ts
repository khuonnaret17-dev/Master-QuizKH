import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_BOT_TOKEN = "8301052612:AAE4QDXA2GMi2nMBxfLe2_v-wQSpd-JrML0";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const videoFile = formData.get('video') as Blob | null;
    const chatId = formData.get('chatId') as string | null;
    const caption = formData.get('caption') as string | null;
    const customBotToken = formData.get('botToken') as string | null;

    if (!videoFile) {
      return NextResponse.json({ success: false, error: 'មិនមានវីដេអូត្រូវបានបញ្ចូលទេ' }, { status: 400 });
    }

    if (!chatId || !chatId.trim()) {
      return NextResponse.json({ success: false, error: 'សូមផ្ដល់ Telegram Chat ID ឬ Channel' }, { status: 400 });
    }

    const botToken = (customBotToken && customBotToken.trim()) || DEFAULT_BOT_TOKEN;

    const tgFormData = new FormData();
    tgFormData.append('chat_id', chatId.trim());
    tgFormData.append('video', videoFile, 'live_lecture.mp4');
    if (caption) {
      tgFormData.append('caption', caption);
      tgFormData.append('parse_mode', 'HTML');
    }
    tgFormData.append('supports_streaming', 'true');

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
      method: 'POST',
      body: tgFormData,
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      throw new Error(tgData.description || 'បរាជ័យក្នុងការផ្ញើវីដេអូទៅកាន់ Telegram');
    }

    return NextResponse.json({ success: true, result: tgData.result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error sending video to Telegram';
    console.error('Send video to Telegram error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
