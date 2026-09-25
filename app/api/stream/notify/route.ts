import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_BOT_TOKEN = "8301052612:AAE4QDXA2GMi2nMBxfLe2_v-wQSpd-JrML0";

export async function POST(req: NextRequest) {
  try {
    const { chatId, title, speaker, customBotToken, streamUrl } = await req.json();

    if (!chatId || !chatId.trim()) {
      return NextResponse.json({ success: false, error: 'សូមផ្ដល់ Chat ID ឬ @channel_username' }, { status: 400 });
    }

    const botToken = (customBotToken && customBotToken.trim()) || DEFAULT_BOT_TOKEN;

    const streamTitle = title || 'វិញ្ញាសាត្រៀមប្រឡងក្របខណ្ឌរដ្ឋ (Civil Service Exam Preparation)';
    const instructor = speaker ? `\n👨‍🏫 <b>វាគ្មិន / គ្រូឧទ្ទេស៖</b> ${speaker}` : '';
    const nowKh = new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' });

    let messageText = `🔴 <b>ការផ្សាយបន្តផ្ទាល់បានចាប់ផ្ដើមហើយ! (LIVE STREAM)</b>\n\n`;
    messageText += `📚 <b>ប្រធានបទ៖</b> ${streamTitle}\n`;
    messageText += `⏰ <b>ម៉ោងផ្សាយ៖</b> ${nowKh}${instructor}\n\n`;
    messageText += `👉 សូមចូលទស្សនាការផ្សាយផ្ទាល់នៅក្នុង Channel នេះឥឡូវនេះ ដើម្បីរៀន និងដោះស្រាយវិញ្ញាសាទាំងអស់គ្នា! 🎉`;

    const inlineKeyboard = streamUrl ? [
      [{ text: "▶️ ចូលទស្សនាការផ្សាយផ្ទាល់ (Watch Live)", url: streamUrl }]
    ] : undefined;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: messageText,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.description || 'បរាជ័យក្នុងការផ្ញើសារទៅកាន់ Telegram Channel');
    }

    return NextResponse.json({ success: true, messageId: data.result?.message_id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error sending Telegram notification';
    console.error('Telegram notification error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
