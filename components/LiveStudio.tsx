'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, Radio, Settings, 
  HelpCircle, Send, CheckCircle2, AlertCircle, 
  Volume2, Eye, EyeOff, Layers, Sparkles, BookOpen, RefreshCw,
  Play, Pause, Clock
} from 'lucide-react';
import { Ministry } from '@/lib/types';
import { firestoreService } from '@/lib/firestore-service';

export interface LiveQuizItem {
  id?: string;
  type: 'MCQ' | 'QA';
  category?: string;
  question: string;
  options?: string[];
  correctIndex?: number;
  answer?: string;
  explanation?: string;
}

// Module-level Canvas Compositor Helpers (Pure Functions)
function drawStandbySlate(
  ctx: CanvasRenderingContext2D, 
  w: number, 
  h: number, 
  title: string, 
  subtitle = "Vignasa Hub • វិញ្ញាសាត្រៀមប្រឡងក្របខណ្ឌរដ្ឋផ្លូវការ"
) {
  ctx.save();
  const grad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w / 1.4);
  grad.addColorStop(0, '#0a3a57');
  grad.addColorStop(0.7, '#052233');
  grad.addColorStop(1, '#02121c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Decorative ring
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2 - 40, 48, 0, Math.PI * 2);
  ctx.stroke();

  // Emblem
  ctx.fillStyle = '#D4AF37';
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("🎙️", w / 2, h / 2 - 28);

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 24px "Kantumruy Pro", sans-serif';
  ctx.fillText(subtitle, w / 2, h / 2 + 40);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '16px "Kantumruy Pro", sans-serif';
  ctx.fillText(title, w / 2, h / 2 + 75);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawLiveBadge(ctx: CanvasRenderingContext2D, isStreaming: boolean, uptimeSeconds: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(24, 24, 180, 42, 21);
  ctx.fill();
  ctx.strokeStyle = isStreaming ? 'rgba(239, 68, 68, 0.8)' : 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = isStreaming ? '#EF4444' : '#94A3B8';
  ctx.beginPath();
  ctx.arc(44, 45, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 13px sans-serif';
  const mins = Math.floor(uptimeSeconds / 60).toString().padStart(2, '0');
  const secs = (uptimeSeconds % 60).toString().padStart(2, '0');
  const timeStr = `${mins}:${secs}`;
  ctx.fillText(isStreaming ? `LIVE ${timeStr}` : 'PREVIEW', 58, 50);

  ctx.fillStyle = 'rgba(14, 165, 233, 0.9)';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText("TELEGRAM", 128, 50);
  ctx.restore();
}

function drawStudioLowerThird(ctx: CanvasRenderingContext2D, w: number, h: number, streamTitle: string, speakerName: string) {
  ctx.save();
  const bannerH = 74;
  const bannerY = h - bannerH;

  const barGrad = ctx.createLinearGradient(0, bannerY, w, bannerY);
  barGrad.addColorStop(0, 'rgba(9, 76, 114, 0.95)');
  barGrad.addColorStop(0.7, 'rgba(5, 44, 66, 0.92)');
  barGrad.addColorStop(1, 'rgba(3, 25, 38, 0.95)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, bannerY, w, bannerH);

  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(0, bannerY, w, 3);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 19px "Kantumruy Pro", sans-serif';
  ctx.fillText(streamTitle, 28, bannerY + 34);

  ctx.fillStyle = '#D4AF37';
  ctx.font = '13px "Kantumruy Pro", sans-serif';
  const sub = speakerName ? `👨‍🏫 ${speakerName} | 🇰🇭 វិញ្ញាសាត្រៀមប្រឡងក្របខណ្ឌរដ្ឋ` : '🇰🇭 វិញ្ញាសាត្រៀមប្រឡងក្របខណ្ឌរដ្ឋផ្លូវការ';
  ctx.fillText(sub, 28, bannerY + 58);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px "Moul", serif';
  ctx.textAlign = 'right';
  ctx.fillText("វិញ្ញាសា HUB", w - 28, bannerY + 34);

  ctx.fillStyle = '#93C5FD';
  ctx.font = '11px sans-serif';
  ctx.fillText("TELEGRAM CHANNEL BROADCAST", w - 28, bannerY + 56);
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D, 
  text: string, 
  x: number, 
  y: number, 
  maxWidth: number, 
  lineHeight: number,
  maxLines = 8
): number {
  if (!text) return y;
  const words = text.includes(' ') ? text.split(' ') : (text.match(/.{1,25}/g) || [text]);
  let line = '';
  let currentY = y;
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const token = text.includes(' ') ? words[n] + ' ' : words[n];
    const testLine = line + token;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = token;
      currentY += lineHeight;
      lineCount++;
      if (lineCount >= maxLines - 1 && n < words.length - 1) {
        ctx.fillText(line.trim() + '...', x, currentY);
        return currentY;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  return currentY;
}

function drawQuizPresentation(
  ctx: CanvasRenderingContext2D, 
  w: number, 
  h: number, 
  quiz: LiveQuizItem | undefined, 
  currentQuizIndex: number, 
  totalQuizzes: number, 
  revealAnswer: boolean,
  hasCamera = false,
  autoRunInfo?: {
    isActive: boolean;
    phase: 'question' | 'answer';
    remainingSeconds: number;
    totalSeconds: number;
  }
) {
  ctx.save();
  if (!quiz) {
    drawStandbySlate(ctx, w, h, "មិនទាន់មានសំណួរត្រូវបានជ្រើសរើស (No Quiz Selected)");
    ctx.restore();
    return;
  }

  const cardX = 40;
  const cardY = 28;
  const cardW = hasCamera ? w - 340 : w - 80;
  const cardH = h - 120;

  // Background Card with shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 1. Question Index Pill
  ctx.fillStyle = '#094C72';
  ctx.beginPath();
  ctx.roundRect(cardX + 24, cardY + 16, 150, 32, 16);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 13px "Kantumruy Pro", sans-serif';
  ctx.fillText(`សំណួរទី ${currentQuizIndex + 1} / ${totalQuizzes}`, cardX + 38, cardY + 37);

  // 2. Question Type Badge
  const isQA = quiz.type === 'QA' || (!quiz.options || quiz.options.length === 0);
  ctx.fillStyle = isQA ? 'rgba(126, 34, 206, 0.12)' : 'rgba(14, 165, 233, 0.12)';
  ctx.strokeStyle = isQA ? '#9333EA' : '#0284C7';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(cardX + 184, cardY + 16, 126, 32, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isQA ? '#7E22CE' : '#0369A1';
  ctx.font = 'bold 12px "Kantumruy Pro", sans-serif';
  ctx.fillText(isQA ? 'Q&A សំណួរ-ចម្លើយ' : 'MCQ ពហុជ្រើសរើស', cardX + 196, cardY + 37);

  // 3. Category (if available)
  if (quiz.category) {
    ctx.fillStyle = '#64748B';
    ctx.font = '12px "Kantumruy Pro", sans-serif';
    const catShort = quiz.category.length > 25 ? quiz.category.substring(0, 24) + '...' : quiz.category;
    ctx.fillText(`• ${catShort}`, cardX + 320, cardY + 37);
  }

  // 4. Auto-Run Live Timer Badge & Progress Bar
  if (autoRunInfo && autoRunInfo.isActive) {
    const isQuestionPhase = autoRunInfo.phase === 'question';
    const badgeW = 210;
    const badgeX = cardX + cardW - badgeW - 24;
    const badgeY = cardY + 16;

    ctx.fillStyle = isQuestionPhase ? 'rgba(245, 158, 11, 0.14)' : 'rgba(16, 185, 129, 0.16)';
    ctx.strokeStyle = isQuestionPhase ? '#F59E0B' : '#10B981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, 32, 16);
    ctx.fill();
    ctx.stroke();

    // Indicator Dot
    ctx.fillStyle = isQuestionPhase ? '#D97706' : '#059669';
    ctx.beginPath();
    ctx.arc(badgeX + 16, badgeY + 16, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isQuestionPhase ? '#B45309' : '#047857';
    ctx.font = 'bold 12px "Kantumruy Pro", sans-serif';
    const timerText = isQuestionPhase 
      ? `⏳ រង់ចាំចម្លើយ: ${autoRunInfo.remainingSeconds}s`
      : `✅ បង្ហាញចម្លើយ (${autoRunInfo.remainingSeconds}s → បន្ទាប់)`;
    ctx.fillText(timerText, badgeX + 28, badgeY + 22);

    // Progress bar across the card width below header
    const barY = cardY + 58;
    const barW = cardW - 48;
    const barH = 4;
    ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.beginPath();
    ctx.roundRect(cardX + 24, barY, barW, barH, 2);
    ctx.fill();

    const progressRatio = Math.max(0, Math.min(1, autoRunInfo.remainingSeconds / (autoRunInfo.totalSeconds || 1)));
    const fillW = Math.max(8, barW * progressRatio);
    ctx.fillStyle = isQuestionPhase ? '#D4AF37' : '#10B981';
    ctx.beginPath();
    ctx.roundRect(cardX + 24, barY, fillW, barH, 2);
    ctx.fill();
  }

  // 5. Question Header & Body
  const questionStartY = cardY + 84;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px "Kantumruy Pro", sans-serif';
  const endQuestionY = wrapText(ctx, `❓ ${quiz.question}`, cardX + 24, questionStartY, cardW - 48, 28, 4);

  // 6. Content Section (Q&A vs MCQ)
  if (isQA) {
    // ---- Q&A MODE ----
    const qaBoxY = Math.max(endQuestionY + 22, cardY + 175);
    const qaBoxW = cardW - 48;
    const qaBoxH = Math.min(220, cardH - (qaBoxY - cardY) - 20);

    if (!revealAnswer) {
      // Waiting Phase: Prompt to think and comment
      const grad = ctx.createLinearGradient(cardX + 24, qaBoxY, cardX + 24 + qaBoxW, qaBoxY + qaBoxH);
      grad.addColorStop(0, 'rgba(248, 250, 252, 0.95)');
      grad.addColorStop(1, 'rgba(241, 245, 249, 0.95)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cardX + 24, qaBoxY, qaBoxW, qaBoxH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0284C7';
      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💬', cardX + 24 + qaBoxW / 2, qaBoxY + 54);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 18px "Kantumruy Pro", sans-serif';
      ctx.fillText('សូមបញ្ចេញមតិ ឬ Comment ចម្លើយរបស់អ្នក...', cardX + 24 + qaBoxW / 2, qaBoxY + 95);

      ctx.fillStyle = '#64748B';
      ctx.font = '13px "Kantumruy Pro", sans-serif';
      const promptSub = autoRunInfo?.isActive
        ? `ចម្លើយផ្លូវការ នឹងបង្ហាញដោយស្វ័យប្រវត្តិក្នងពេល ${autoRunInfo.remainingSeconds} វិនាទីទៀត`
        : 'ចុច "បង្ហាញចម្លើយ" ឬបើក "Auto-Run" ដើម្បីបង្ហាញចម្លើយផ្លូវការ';
      ctx.fillText(promptSub, cardX + 24 + qaBoxW / 2, qaBoxY + 125);
      ctx.textAlign = 'left';
    } else {
      // Answer Revealed Phase
      ctx.fillStyle = 'rgba(236, 253, 245, 0.96)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX + 24, qaBoxY, qaBoxW, qaBoxH, 16);
      ctx.fill();
      ctx.stroke();

      // Answer Header Badge
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect(cardX + 44, qaBoxY + 14, 180, 30, 15);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Kantumruy Pro", sans-serif';
      ctx.fillText('✅ ចម្លើយត្រឹមត្រូវ (Answer)', cardX + 56, qaBoxY + 34);

      // Answer Text
      ctx.fillStyle = '#064E3B';
      ctx.font = 'bold 17px "Kantumruy Pro", sans-serif';
      const ansText = quiz.answer || 'គ្មានចម្លើយជាក់លាក់';
      const endAnsY = wrapText(ctx, ansText, cardX + 48, qaBoxY + 74, qaBoxW - 48, 26, 4);

      // Explanation (if any)
      if (quiz.explanation) {
        ctx.fillStyle = '#047857';
        ctx.font = '13px "Kantumruy Pro", sans-serif';
        wrapText(ctx, `💡 ការពន្យល់៖ ${quiz.explanation}`, cardX + 48, endAnsY + 22, qaBoxW - 48, 20, 2);
      }
    }
  } else {
    // ---- MCQ MODE ----
    const options = quiz.options || [];
    const optStartY = Math.max(endQuestionY + 18, cardY + 165);
    const maxOptW = cardW - 48;

    options.forEach((opt, idx) => {
      const isCorrect = revealAnswer && idx === quiz.correctIndex;
      const optY = optStartY + idx * 52;
      const label = ['A', 'B', 'C', 'D'][idx] || String.fromCharCode(65 + idx);

      ctx.fillStyle = isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(241, 245, 249, 0.9)';
      ctx.strokeStyle = isCorrect ? '#10B981' : 'rgba(203, 213, 225, 0.8)';
      ctx.lineWidth = isCorrect ? 2.5 : 1;
      ctx.beginPath();
      ctx.roundRect(cardX + 24, optY, maxOptW, 44, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isCorrect ? '#10B981' : '#094C72';
      ctx.beginPath();
      ctx.arc(cardX + 50, optY + 22, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, cardX + 50, optY + 27);
      ctx.textAlign = 'left';

      ctx.fillStyle = isCorrect ? '#065F46' : '#1E293B';
      ctx.font = isCorrect ? 'bold 15px "Kantumruy Pro", sans-serif' : '15px "Kantumruy Pro", sans-serif';
      ctx.fillText(opt, cardX + 74, optY + 27);
    });

    if (revealAnswer && quiz.explanation) {
      const expY = optStartY + options.length * 52 + 10;
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 13px "Kantumruy Pro", sans-serif';
      const correctLetter = ['A', 'B', 'C', 'D'][quiz.correctIndex ?? 0] || 'A';
      ctx.fillText(`💡 ចម្លើយត្រឹមត្រូវ៖ ${correctLetter} | ${quiz.explanation.substring(0, 110)}`, cardX + 24, expY);
    }
  }

  ctx.restore();
}

export function sanitizeRtmpUrl(rawUrl?: string): string {
  let clean = (rawUrl || '').trim();
  if (!clean) return 'rtmps://dc4-1.rtmp.t.me/s/';
  if (!/^rtmps?:\/\//i.test(clean)) {
    clean = `rtmps://${clean}`;
  }
  if (clean.includes('rtmp.t.me') && !clean.endsWith('/')) {
    clean += '/';
  }
  return clean;
}

export function LiveStudio() {
  // Stream Settings State
  const [rtmpUrl, setRtmpUrl] = useState('rtmps://dc4-1.rtmp.t.me/s/');
  const [streamKey, setStreamKey] = useState('');
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [streamTitle, setStreamTitle] = useState('វិញ្ញាសាត្រៀមប្រឡងក្របខណ្ឌរដ្ឋ (Civil Service Exam Live)');
  const [speakerName, setSpeakerName] = useState('សាស្ត្រាចារ្យ / គ្រូឧទ្ទេស');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '480p'>('720p');
  const [isTestMode, setIsTestMode] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Live Stream Runtime State
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [bytesSent, setBytesSent] = useState(0);
  const [currentKbps, setCurrentKbps] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Media Devices & Layout
  const [layoutMode, setLayoutMode] = useState<'CAMERA' | 'SCREEN' | 'STUDIO' | 'QUIZ'>('STUDIO');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');

  // Quiz presentation overlay state
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>('');
  const [quizList, setQuizList] = useState<LiveQuizItem[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [revealAnswer, setRevealAnswer] = useState(false);

  // Auto-run Q&A / Quiz state
  const [autoRunActive, setAutoRunActive] = useState(false);
  const [autoRunPhase, setAutoRunPhase] = useState<'question' | 'answer'>('question');
  const [questionDuration, setQuestionDuration] = useState(10); // Seconds to display question before showing answer
  const [answerDuration, setAnswerDuration] = useState(5); // Seconds to display answer before next question
  const [autoRunSecondsLeft, setAutoRunSecondsLeft] = useState(10);
  const [autoRunLoop, setAutoRunLoop] = useState(true);
  const [quizFilterType, setQuizFilterType] = useState<'ALL' | 'MCQ' | 'QA'>('ALL');

  // References
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const statusPollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunkQueueRef = useRef<ArrayBuffer[]>([]);
  const isSendingChunkRef = useRef<boolean>(false);

  // Audio chime for auto-revealing answer
  const playAnswerChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio unavailable
    }
  }, []);

  const extractQuizzes = useCallback((ministry: Ministry, filter: 'ALL' | 'MCQ' | 'QA' = 'ALL') => {
    const list: LiveQuizItem[] = [];

    // 1. From ministry.mcqs
    if (filter !== 'QA' && ministry.mcqs && ministry.mcqs.length > 0) {
      ministry.mcqs.forEach(cat => {
        if (cat.items && cat.items.length > 0) {
          cat.items.forEach(item => {
            list.push({
              type: 'MCQ',
              category: cat.category,
              question: item.question,
              options: item.options,
              correctIndex: item.correctIndex,
              explanation: item.explanation
            });
          });
        }
      });
    }

    // 2. From ministry.shortAnswers (Q&A)
    if (filter !== 'MCQ' && ministry.shortAnswers && ministry.shortAnswers.length > 0) {
      ministry.shortAnswers.forEach(cat => {
        if (cat.items && cat.items.length > 0) {
          cat.items.forEach(item => {
            list.push({
              type: 'QA',
              category: cat.category,
              question: item.question,
              answer: item.answer,
              explanation: item.explanation
            });
          });
        }
      });
    }

    // 3. From ministry.quizzes (if any)
    if (ministry.quizzes && ministry.quizzes.length > 0) {
      ministry.quizzes.forEach(q => {
        if (q.type === 'Q_AND_A' || q.answer) {
          if (filter !== 'MCQ') {
            list.push({
              id: q.id,
              type: 'QA',
              category: q.category,
              question: q.question,
              answer: q.answer,
              explanation: q.explanation
            });
          }
        } else if (q.options) {
          if (filter !== 'QA') {
            const opts = Object.values(q.options);
            const keys = Object.keys(q.options);
            const correctIdx = q.correctAnswer ? keys.indexOf(q.correctAnswer) : 0;
            list.push({
              id: q.id,
              type: 'MCQ',
              category: q.category,
              question: q.question,
              options: opts,
              correctIndex: correctIdx >= 0 ? correctIdx : 0,
              explanation: q.explanation
            });
          }
        }
      });
    }

    setQuizList(list);
    setCurrentQuizIndex(0);
    setRevealAnswer(false);
    setAutoRunPhase('question');
    setAutoRunSecondsLeft(questionDuration);
  }, [questionDuration]);

  // Load saved credentials & ministries on mount
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('vignasa_telegram_stream_key') || '';
      const savedUrl = localStorage.getItem('vignasa_telegram_rtmp_url') || 'rtmps://dc4-1.rtmp.t.me/s/';
      const savedChatId = localStorage.getItem('vignasa_telegram_chat_id') || localStorage.getItem('telegramChatId') || '';
      const savedSpeaker = localStorage.getItem('vignasa_live_speaker') || '';
      if (savedKey) setStreamKey(savedKey);
      if (savedUrl) setRtmpUrl(sanitizeRtmpUrl(savedUrl));
      if (savedChatId) setTelegramChatId(savedChatId);
      if (savedSpeaker) setSpeakerName(savedSpeaker);
    } catch {
      // LocalStorage unavailable
    }

    firestoreService.getMinistries().then(data => {
      setMinistries(data);
      if (data.length > 0) {
        setSelectedMinistryId(data[0].id);
        extractQuizzes(data[0], 'ALL');
      }
    }).catch(err => console.warn('Failed to load ministries for live studio:', err));
  }, [extractQuizzes]);

  const handleMinistryChange = (id: string, filter?: 'ALL' | 'MCQ' | 'QA') => {
    setSelectedMinistryId(id);
    const activeFilter = filter !== undefined ? filter : quizFilterType;
    const m = ministries.find(item => item.id === id);
    if (m) extractQuizzes(m, activeFilter);
  };

  const handleFilterChange = (filter: 'ALL' | 'MCQ' | 'QA') => {
    setQuizFilterType(filter);
    const m = ministries.find(item => item.id === selectedMinistryId);
    if (m) extractQuizzes(m, filter);
  };

  // Master Auto-Run Timer Interval
  useEffect(() => {
    if (!autoRunActive || quizList.length === 0) return;

    const timer = setInterval(() => {
      setAutoRunSecondsLeft(prev => {
        if (prev > 1) {
          return prev - 1;
        }

        // Timer reached 0: transition phases
        if (autoRunPhase === 'question') {
          // Switch to answer phase: reveal answer
          setRevealAnswer(true);
          setAutoRunPhase('answer');
          playAnswerChime();
          return answerDuration;
        } else {
          // Current was answer phase: proceed to next question
          setRevealAnswer(false);
          setAutoRunPhase('question');
          
          setCurrentQuizIndex(currentIndex => {
            if (currentIndex < quizList.length - 1) {
              return currentIndex + 1;
            } else if (autoRunLoop) {
              return 0; // Loop back
            } else {
              setAutoRunActive(false);
              return currentIndex;
            }
          });
          return questionDuration;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRunActive, autoRunPhase, questionDuration, answerDuration, autoRunLoop, quizList.length, playAnswerChime]);

  const toggleAutoRun = () => {
    if (!autoRunActive) {
      if (quizList.length === 0) {
        setStatusMessage("ពុំមានសំណួរសម្រាប់ដំណើរការ Auto-Run ទេ");
        return;
      }
      setLayoutMode('QUIZ');
      setAutoRunActive(true);
      setAutoRunPhase('question');
      setRevealAnswer(false);
      setAutoRunSecondsLeft(questionDuration);
      setStatusMessage("⚡ បានបើកដំណើរការរត់សំណួរ-ចម្លើយ (Q&A Auto-Run) ដោយស្វ័យប្រវត្តិ");
    } else {
      setAutoRunActive(false);
      setStatusMessage("⏸️ បានផ្អាកដំណើរការរត់ស្វ័យប្រវត្តិ");
    }
  };

  // Audio level analyzer
  const setupAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        if (cameraStreamRef.current) {
          requestAnimationFrame(checkVolume);
        }
      };
      checkVolume();
    } catch (err) {
      console.warn("Audio meter init error:", err);
    }
  }, []);

  // Initialize camera and audio gracefully (without blocking or throwing fatal UI errors)
  const startCamera = useCallback(async (isUserAction = false) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('unsupported');
      setCameraEnabled(false);
      return;
    }

    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
        setCameraStatus('granted');
        setCameraEnabled(true);
        setMicEnabled(true);
      } catch (camErr: unknown) {
        console.warn('Camera video access not available, attempting audio-only:', camErr);
        setCameraStatus('denied');
        setCameraEnabled(false);

        // Try audio only so host can speak even if camera is disabled or denied
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicEnabled(true);
        } catch {
          setMicEnabled(false);
          if (isUserAction) {
            setStatusMessage("កាមេរ៉ា និងមីក្រូហ្វូនត្រូវបានបិទ — អ្នកអាចបន្តផ្សាយសំណួរ Quiz ឬចែករំលែកអេក្រង់បានធម្មតា");
          }
          return;
        }
      }

      cameraStreamRef.current = stream;

      if (cameraVideoRef.current && stream.getVideoTracks().length > 0) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play().catch(() => {});
      }

      setupAudioAnalyzer(stream);
      if (isUserAction && stream.getVideoTracks().length > 0) {
        setStatusMessage("កាមេរ៉ា និងមីក្រូហ្វូនត្រូវបានបើកដំណើរការ");
      }
    } catch (err: unknown) {
      console.warn('Media devices not available:', err);
      setCameraStatus('denied');
      setCameraEnabled(false);
    }
  }, [setupAudioAnalyzer]);

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      if (layoutMode === 'SCREEN') setLayoutMode('STUDIO');
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true
        });

        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
          screenVideoRef.current.play().catch(() => {});
        }

        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };

        setIsScreenSharing(true);
        setStatusMessage("បានចែករំលែកអេក្រង់ (Screen Shared)");
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
      }
    }
  };

  // Toggle Camera Video Track
  const toggleCamera = () => {
    if (cameraStreamRef.current && cameraStreamRef.current.getVideoTracks().length > 0) {
      const track = cameraStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCameraEnabled(track.enabled);
      }
    } else {
      // Attempt to start camera if not started yet
      startCamera(true);
    }
  };

  // Toggle Mic Track
  const toggleMic = () => {
    if (cameraStreamRef.current && cameraStreamRef.current.getAudioTracks().length > 0) {
      const track = cameraStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setMicEnabled(track.enabled);
      }
    }
  };

  // Initialize camera gracefully on mount
  useEffect(() => {
    startCamera(false);
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (statusPollTimerRef.current) {
        clearInterval(statusPollTimerRef.current);
      }
    };
  }, [startCamera]);

  // Canvas Compositor: Combines screen, camera, quiz, and lower-third graphics
  const renderCompositor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1280;
    const height = 720;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // 1. Draw Background
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#094C72');
    bgGradient.addColorStop(0.5, '#052C42');
    bgGradient.addColorStop(1, '#031926');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid pattern
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const camVideo = cameraVideoRef.current;
    const scrVideo = screenVideoRef.current;
    const isCamReady = camVideo && camVideo.readyState >= 2 && cameraEnabled && cameraStatus === 'granted';

    // 2. Render Main Layer based on Layout Mode
    if (layoutMode === 'CAMERA') {
      if (isCamReady) {
        ctx.drawImage(camVideo, 0, 0, width, height);
      } else {
        drawStandbySlate(
          ctx, 
          width, 
          height, 
          "កាមេរ៉ាត្រូវបានបិទ ឬពុំទាន់បានអនុញ្ញាត",
          "សូមចុច 'បើកកាមេរ៉ា' ឬប្ដូរទៅទម្រង់ 'បង្ហាញវិញ្ញាសា (Quiz)'"
        );
      }
    } else if (layoutMode === 'SCREEN') {
      if (scrVideo && scrVideo.readyState >= 2) {
        ctx.drawImage(scrVideo, 0, 0, width, height);
      } else {
        drawStandbySlate(
          ctx, 
          width, 
          height, 
          "សូមបើកការចែករំលែកអេក្រង់ (Please Share Screen)",
          "ចុចប៊ូតុង Monitor ដើម្បីបង្ហាញស្លាយបង្រៀន ឬឯកសារវិញ្ញាសា"
        );
      }
    } else if (layoutMode === 'STUDIO') {
      if (scrVideo && scrVideo.readyState >= 2) {
        ctx.drawImage(scrVideo, 0, 0, width, height);
      } else if (isCamReady) {
        ctx.drawImage(camVideo, 0, 0, width, height);
      } else {
        drawStandbySlate(
          ctx, 
          width, 
          height, 
          "ស្ទូឌីយោផ្សាយផ្ទាល់ Vignasa Hub រួចរាល់",
          "អ្នកអាចចែករំលែកអេក្រង់ ឬប្ដូរទៅទម្រង់ 'បង្ហាញវិញ្ញាសា (Quiz)'"
        );
      }

      // PiP Camera in Bottom Right if both screen & camera exist
      if (scrVideo && scrVideo.readyState >= 2 && isCamReady) {
        const pipW = 280;
        const pipH = 158;
        const pipX = width - pipW - 24;
        const pipY = height - pipH - 100;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;

        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 3;
        ctx.strokeRect(pipX, pipY, pipW, pipH);
        ctx.drawImage(camVideo, pipX, pipY, pipW, pipH);

        ctx.fillStyle = 'rgba(5, 44, 66, 0.85)';
        ctx.fillRect(pipX, pipY + pipH - 26, pipW, 26);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px "Kantumruy Pro", sans-serif';
        ctx.fillText(speakerName || 'វាគ្មិន', pipX + 10, pipY + pipH - 8);
        ctx.restore();
      }
    } else if (layoutMode === 'QUIZ') {
      drawQuizPresentation(
        ctx, 
        width, 
        height, 
        quizList[currentQuizIndex], 
        currentQuizIndex, 
        quizList.length, 
        revealAnswer,
        Boolean(isCamReady),
        {
          isActive: autoRunActive,
          phase: autoRunPhase,
          remainingSeconds: autoRunSecondsLeft,
          totalSeconds: autoRunPhase === 'question' ? questionDuration : answerDuration,
        }
      );

      // PiP Camera in top right
      if (isCamReady) {
        const pipW = 260;
        const pipH = 146;
        const pipX = width - pipW - 32;
        const pipY = 32;

        ctx.save();
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 3;
        ctx.strokeRect(pipX, pipY, pipW, pipH);
        ctx.drawImage(camVideo, pipX, pipY, pipW, pipH);

        ctx.fillStyle = 'rgba(9, 76, 114, 0.9)';
        ctx.fillRect(pipX, pipY + pipH - 24, pipW, 24);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(speakerName || 'គ្រូឧទ្ទេស', pipX + 8, pipY + pipH - 7);
        ctx.restore();
      }
    }

    // 3. Lower Third Studio Banner
    drawStudioLowerThird(ctx, width, height, streamTitle, speakerName);

    // 4. Top-Left Live Indicator
    drawLiveBadge(ctx, isStreaming, uptimeSeconds);

    animationFrameRef.current = requestAnimationFrame(renderCompositor);
  }, [layoutMode, cameraEnabled, cameraStatus, speakerName, streamTitle, currentQuizIndex, quizList, revealAnswer, isStreaming, uptimeSeconds, autoRunActive, autoRunPhase, autoRunSecondsLeft, questionDuration, answerDuration]);

  // Animation loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(renderCompositor);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [renderCompositor]);

  // Connect canvas stream to preview video
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && previewVideoRef.current) {
      try {
        const stream = canvas.captureStream(30);
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play().catch(() => {});
      } catch (err) {
        console.warn('Canvas stream capture error:', err);
      }
    }
  }, []);

  // START LIVE STREAM
  const handleStartStream = async () => {
    setErrorMessage(null);
    setStatusMessage("កំពុងតភ្ជាប់ទៅកាន់ Telegram RTMP Server...");
    setStreamStatus('connecting');

    const cleanRtmp = sanitizeRtmpUrl(rtmpUrl);
    setRtmpUrl(cleanRtmp);
    const cleanKey = (streamKey || '').trim().replace(/^["']|["']$/g, '');

    if (!isTestMode && !cleanKey) {
      setErrorMessage("សូមបញ្ចូល Stream Key ពី Telegram Channel របស់អ្នក! (ឬបើក 'របៀបសាកល្បង / Test Mode' ដើម្បីតេស្តដោយមិនបាច់ប្រើ Key)");
      setStreamStatus('idle');
      setShowSettingsModal(true);
      return;
    }

    try {
      localStorage.setItem('vignasa_telegram_stream_key', cleanKey);
      localStorage.setItem('vignasa_telegram_rtmp_url', cleanRtmp);
      if (telegramChatId) localStorage.setItem('vignasa_telegram_chat_id', telegramChatId.trim());
      if (speakerName) localStorage.setItem('vignasa_live_speaker', speakerName.trim());

      const startRes = await fetch('/api/stream/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtmpUrl: cleanRtmp,
          streamKey: cleanKey,
          isTestMode,
          width: resolution === '1080p' ? 1920 : resolution === '480p' ? 854 : 1280,
          height: resolution === '1080p' ? 1080 : resolution === '480p' ? 480 : 720,
          fps: 30,
          videoBitrate: resolution === '1080p' ? '3000k' : resolution === '480p' ? '800k' : '1800k',
          audioBitrate: '128k',
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok || !startData.success) {
        throw new Error(startData.error || 'បរាជ័យក្នុងការចាប់ផ្ដើម Session');
      }

      const activeSessionId = startData.sessionId;
      setSessionId(activeSessionId);

      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas rendering context unavailable");

      const canvasStream = canvas.captureStream(30);

      // Ensure audio track is always provided so ffmpeg and MediaRecorder never fail
      let audioTrack = cameraStreamRef.current?.getAudioTracks().find(t => t.enabled);
      if (!audioTrack) {
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.00001; // Silent carrier
          osc.connect(gain);
          const dest = ctx.createMediaStreamDestination();
          gain.connect(dest);
          osc.start();
          audioTrack = dest.stream.getAudioTracks()[0];
        } catch (audioErr) {
          console.warn("Could not generate silent audio fallback:", audioErr);
        }
      }

      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }

      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=h264,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: resolution === '1080p' ? 3000000 : resolution === '480p' ? 800000 : 1800000,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = recorder;

      // Clear chunk queue of any previous session leftovers
      chunkQueueRef.current = [];
      isSendingChunkRef.current = false;

      recorder.ondataavailable = async (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          try {
            const buffer = await e.data.arrayBuffer();
            
            // Queue-based sequential sending to prevent chunk interleaving and corruption
            chunkQueueRef.current.push(buffer);
            
            const processQueue = async () => {
              if (isSendingChunkRef.current) return;
              isSendingChunkRef.current = true;
              
              while (chunkQueueRef.current.length > 0) {
                const nextBuffer = chunkQueueRef.current[0];
                try {
                  const res = await fetch(`/api/stream/chunk?sessionId=${activeSessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: nextBuffer,
                  });
                  if (!res.ok) {
                    console.warn("Chunk upload failed with status:", res.status);
                  } else {
                    setBytesSent(prev => prev + nextBuffer.byteLength);
                  }
                } catch (chunkErr) {
                  console.warn("Chunk upload error in queue:", chunkErr);
                }
                // Always shift the processed chunk to prevent a block
                chunkQueueRef.current.shift();
              }
              isSendingChunkRef.current = false;
            };
            
            processQueue();
          } catch (err) {
            console.warn("Error parsing or queueing chunk:", err);
          }
        }
      };

      recorder.onerror = (recErr) => {
        console.warn("MediaRecorder error:", recErr);
        setErrorMessage("កំហុសក្នុងការថតវីដេអូផ្សាយផ្ទាល់");
      };

      // Start recording with 400ms chunk intervals for smooth low-latency streaming
      recorder.start(400);

      setIsStreaming(true);
      setStreamStatus('live');
      setUptimeSeconds(0);
      setStatusMessage("🔴 កំពុងផ្សាយផ្ទាល់ទៅកាន់ Telegram Channel!");

      pollStreamStatus(activeSessionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Failed to start stream:', err);
      setErrorMessage(msg);
      setStreamStatus('error');
    }
  };

  // STOP LIVE STREAM
  const handleStopStream = async () => {
    setStatusMessage("កំពុងបញ្ឈប់ការផ្សាយ...");

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }

    if (sessionId) {
      try {
        await fetch('/api/stream/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) {
        console.warn("Error calling stop API:", err);
      }
    }

    if (statusPollTimerRef.current) {
      clearInterval(statusPollTimerRef.current);
      statusPollTimerRef.current = null;
    }

    setIsStreaming(false);
    setStreamStatus('idle');
    setSessionId(null);
    setStatusMessage("ការផ្សាយបន្តផ្ទាល់ត្រូវបានបញ្ចប់ដោយជោគជ័យ 🎉");
  };

  // Status Polling
  const pollStreamStatus = (activeSessionId: string) => {
    if (statusPollTimerRef.current) clearInterval(statusPollTimerRef.current);

    statusPollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/stream/status?sessionId=${activeSessionId}`);
        const data = await res.json();
        if (data.success) {
          setUptimeSeconds(data.uptimeSeconds || 0);
          setCurrentKbps(data.currentKbps || 0);
          if (data.recentLogs) setServerLogs(data.recentLogs);
          if (data.status === 'stopped' || data.status === 'error') {
            if (data.errorMsg) setErrorMessage(data.errorMsg);
          }
        }
      } catch {
        // Ignore poll network errors
      }
    }, 2000);
  };

  // Send Telegram Channel Announcement
  const handleNotifyTelegram = async () => {
    if (!telegramChatId || !telegramChatId.trim()) {
      setErrorMessage("សូមកំណត់ Telegram Chat ID ឬ @channel_username ក្នុង Settings!");
      setShowSettingsModal(true);
      return;
    }

    setStatusMessage("កំពុងផ្ញើសេចក្តីជូនដំណឹងទៅ Telegram Channel...");
    try {
      const res = await fetch('/api/stream/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: telegramChatId.trim(),
          title: streamTitle,
          speaker: speakerName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'បរាជ័យក្នុងការផ្ញើសារ');
      }
      setStatusMessage("បានផ្ញើសេចក្តីជូនដំណឹងផ្សាយផ្ទាល់ទៅ Telegram Channel រួចរាល់! 📢");
    } catch (err: unknown) {
      setErrorMessage("កំហុសក្នុងការផ្ញើសារ Telegram: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Hidden Source Video Elements for Canvas Drawing */}
      <video ref={cameraVideoRef} autoPlay playsInline muted className="hidden" />
      <video ref={screenVideoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={1280} height={720} className="hidden" />

      {/* Top Studio Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 ring-2 ring-sky-400/30">
            <Radio className={`w-6 h-6 ${isStreaming ? 'animate-pulse text-red-400' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-black text-white font-khmer">
                បន្ទប់ផ្សាយផ្ទាល់ទៅកាន់ Telegram
              </h1>
              {isStreaming ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  LIVE {Math.floor(uptimeSeconds / 60)}:{(uptimeSeconds % 60).toString().padStart(2, '0')}
                </span>
              ) : (
                <span className="px-3 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold">
                  {isTestMode ? 'TEST MODE' : 'STANDBY'}
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-400 font-khmer mt-0.5">
              ផ្សាយផ្ទាល់រូបភាព សំឡេង និងវិញ្ញាសាទៅកាន់ Telegram Channel & Group តាមរយៈ RTMP
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-khmer font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <span>របៀបយក Stream Key</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-khmer font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-[#D4AF37]" />
            <span>ការកំណត់ RTMP</span>
          </button>

          {isStreaming ? (
            <button
              onClick={handleStopStream}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-sm font-khmer transition-all shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-spin" />
              <span>បញ្ចប់ការផ្សាយ</span>
            </button>
          ) : (
            <button
              onClick={handleStartStream}
              disabled={streamStatus === 'connecting'}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm font-khmer transition-all shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Radio className="w-4 h-4" />
              <span>{streamStatus === 'connecting' ? 'កំពុងតភ្ជាប់...' : 'ចាប់ផ្ដើមការផ្សាយ (Go Live)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Non-intrusive Camera Notice if Camera is Denied or Off */}
      {cameraStatus === 'denied' && (
        <div className="flex items-center justify-between p-3.5 bg-slate-900/90 border border-slate-800 text-slate-300 rounded-2xl text-xs font-khmer shadow-lg">
          <div className="flex items-center gap-2.5">
            <VideoOff className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>
              កាមេរ៉ាពុំទាន់បានបើក ឬត្រូវបានបិទ — អ្នកនៅតែអាចផ្សាយសំណួរវិញ្ញាសា (Quiz Mode) ឬចែករំលែកអេក្រង់ (Screen Share) បានយ៉ាងរលូន!
            </span>
          </div>
          <button
            onClick={() => startCamera(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 hover:text-white border border-sky-500/30 text-xs font-bold shrink-0 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>បើកកាមេរ៉ាឡើងវិញ</span>
          </button>
        </div>
      )}

      {/* Feedback Alerts */}
      {errorMessage && (
        <div className="flex items-center justify-between p-4 bg-red-950/80 border border-red-800 text-red-200 rounded-2xl text-xs md:text-sm font-khmer shadow-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white p-1 text-lg">×</button>
        </div>
      )}

      {statusMessage && !errorMessage && (
        <div className="flex items-center justify-between p-3.5 bg-sky-950/80 border border-sky-800 text-sky-200 rounded-2xl text-xs md:text-sm font-khmer shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-sky-400 hover:text-white p-1 text-lg">×</button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Video Canvas Display */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group">
            {/* The Live Composited Preview Video */}
            <video 
              ref={previewVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-contain"
            />

            {/* Over-the-video floating studio bar */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
              <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300 text-xs font-mono">
                {resolution.toUpperCase()} • 30FPS • {currentKbps} kbps
              </span>
            </div>

            {/* Bottom floating control bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-4 py-2 rounded-2xl shadow-2xl z-20">
              {/* Mic toggle */}
              <button
                onClick={toggleMic}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  micEnabled ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-red-600 text-white hover:bg-red-700'
                }`}
                title={micEnabled ? 'បិទមីក្រូហ្វូន' : 'បើកមីក្រូហ្វូន'}
              >
                {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>

              {/* Audio Volume Bar */}
              <div className="flex items-center gap-1.5 px-2 bg-slate-800/80 rounded-xl h-9">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 transition-all duration-75"
                    style={{ width: `${micEnabled ? audioLevel : 0}%` }}
                  />
                </div>
              </div>

              {/* Camera toggle */}
              <button
                onClick={toggleCamera}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  cameraEnabled && cameraStatus === 'granted' ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-amber-600/80 text-white hover:bg-amber-600'
                }`}
                title={cameraEnabled && cameraStatus === 'granted' ? 'បិទកាមេរ៉ា' : 'បើកកាមេរ៉ា'}
              >
                {cameraEnabled && cameraStatus === 'granted' ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>

              {/* Screen share toggle */}
              <button
                onClick={toggleScreenShare}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  isScreenSharing ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title="ចែករំលែកអេក្រង់ (Share Screen)"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Layout Mode Selector Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-khmer text-slate-400 font-bold px-2">
              ទម្រង់ប្លង់ផ្សាយ (Layout):
            </span>
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setLayoutMode('QUIZ')}
                className={`px-3 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all cursor-pointer ${
                  layoutMode === 'QUIZ' ? 'bg-[#D4AF37] text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> បង្ហាញវិញ្ញាសា</span>
              </button>
              <button
                onClick={() => setLayoutMode('STUDIO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all cursor-pointer ${
                  layoutMode === 'STUDIO' ? 'bg-[#094C72] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Studio (PiP)</span>
              </button>
              <button
                onClick={() => setLayoutMode('SCREEN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all cursor-pointer ${
                  layoutMode === 'SCREEN' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> អេក្រង់ពេញ</span>
              </button>
              <button
                onClick={() => setLayoutMode('CAMERA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all cursor-pointer ${
                  layoutMode === 'CAMERA' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> កាមេរ៉ាពេញ</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Broadcast Controls & Interactive Overlays */}
        <div className="space-y-5">
          {/* Quick Stream Settings Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white font-khmer flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                <span>ព័ត៌មានការផ្សាយផ្ទាល់</span>
              </h3>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="text-xs text-sky-400 hover:text-sky-300 font-khmer underline cursor-pointer"
              >
                ប្ដូរ Server
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-khmer block mb-1">
                  ចំណងជើងការផ្សាយ (Stream Title):
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-khmer focus:outline-none focus:border-sky-500"
                  placeholder="ចំណងជើង..."
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-khmer block mb-1">
                  ឈ្មោះវាគ្មិន / គ្រូឧទ្ទេស (Speaker):
                </label>
                <input
                  type="text"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-khmer focus:outline-none focus:border-sky-500"
                  placeholder="ឧ. សាស្ត្រាចារ្យ សុខ វិសាល"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-khmer block mb-1">
                  Stream Key (Telegram):
                </label>
                <div className="relative">
                  <input
                    type={showStreamKey ? 'text' : 'password'}
                    value={streamKey}
                    onChange={(e) => setStreamKey(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                    placeholder="123456789:AAG_xxxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStreamKey(!showStreamKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showStreamKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Telegram Channel Actions */}
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <button
                onClick={handleNotifyTelegram}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 hover:text-white border border-sky-600/40 text-xs font-khmer font-bold transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ផ្ញើសេចក្តីជូនដំណឹងទៅ Telegram Channel</span>
              </button>
            </div>
          </div>

          {/* Interactive Q&A & Quiz Switcher Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white font-khmer flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>វិញ្ញាសាផ្សាយបន្តផ្ទាល់ (Live Q&A)</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {quizList.length} សំណួរ
              </span>
            </div>

            {/* Ministry Selector */}
            <div>
              <label className="text-xs text-slate-400 font-khmer block mb-1">
                ជ្រើសរើសស្ថាប័ន / មុខវិជ្ជា៖
              </label>
              <select
                value={selectedMinistryId}
                onChange={(e) => handleMinistryChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-khmer focus:outline-none focus:border-sky-500"
              >
                {ministries.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.khmerName || m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tabs: ALL, Q&A, MCQ */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleFilterChange('ALL')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all cursor-pointer ${
                  quizFilterType === 'ALL' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ទាំងអស់
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('QA')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all cursor-pointer ${
                  quizFilterType === 'QA' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Q&A (សំណួរ-ចម្លើយ)
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('MCQ')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-khmer font-bold transition-all cursor-pointer ${
                  quizFilterType === 'MCQ' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                MCQ (ពហុជ្រើសរើស)
              </button>
            </div>

            {/* Master Auto-Run Switch & Live Timer Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-khmer text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>រត់ស្វ័យប្រវត្តិ (Auto-Play Q&A)</span>
                </span>
                {autoRunActive && (
                  <span className="flex items-center gap-1 text-[11px] font-bold font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    ACTIVE
                  </span>
                )}
              </div>

              {/* Master Play/Pause Button */}
              <button
                type="button"
                onClick={toggleAutoRun}
                className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-khmer font-black transition-all shadow-md cursor-pointer ${
                  autoRunActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/30'
                }`}
              >
                {autoRunActive ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>ផ្អាកការរត់ស្វ័យប្រវត្តិ (Pause Auto Q&A)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>ចាប់ផ្ដើមរត់ស្វ័យប្រវត្តិ (Start Auto-Play Q&A)</span>
                  </>
                )}
              </button>

              {/* Live Status when running */}
              {autoRunActive && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-khmer">
                    <span className={`font-bold ${autoRunPhase === 'question' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {autoRunPhase === 'question' 
                        ? `⏳ កំពុងរង់ចាំចម្លើយ: ${autoRunSecondsLeft}s` 
                        : `✅ កំពុងបង្ហាញចម្លើយ: ${autoRunSecondsLeft}s → បន្ទាប់`}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {autoRunPhase === 'question' ? `សរុប ${questionDuration}s` : `សរុប ${answerDuration}s`}
                    </span>
                  </div>
                  {/* Real-time filling progress bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${autoRunPhase === 'question' ? 'bg-[#D4AF37]' : 'bg-emerald-500'}`}
                      style={{ 
                        width: `${Math.max(5, (autoRunSecondsLeft / (autoRunPhase === 'question' ? questionDuration : answerDuration)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Duration Customization Controls */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                <div>
                  <label className="text-[10px] text-slate-400 font-khmer block mb-1">
                    រង់ចាំចម្លើយ (សំណួរ):
                  </label>
                  <div className="flex items-center gap-1">
                    {[5, 10, 15, 20].map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setQuestionDuration(sec);
                          if (autoRunPhase === 'question') setAutoRunSecondsLeft(sec);
                        }}
                        className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          questionDuration === sec ? 'bg-[#D4AF37] text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-khmer block mb-1">
                    បង្ហាញចម្លើយ (Answer):
                  </label>
                  <div className="flex items-center gap-1">
                    {[3, 5, 8, 10].map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setAnswerDuration(sec);
                          if (autoRunPhase === 'answer') setAutoRunSecondsLeft(sec);
                        }}
                        className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          answerDuration === sec ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Loop Switch */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 font-khmer">
                  វិលជុំឡើងវិញ (Loop Questions):
                </span>
                <button
                  type="button"
                  onClick={() => setAutoRunLoop(!autoRunLoop)}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                    autoRunLoop ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {autoRunLoop ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Current Question Inspector & Manual Stepper */}
            {quizList.length > 0 ? (
              <div className="space-y-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#D4AF37] font-khmer font-bold">
                      សំណួរទី {currentQuizIndex + 1} នៃ {quizList.length}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      quizList[currentQuizIndex]?.type === 'QA' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-sky-950 text-sky-300 border border-sky-800'
                    }`}>
                      {quizList[currentQuizIndex]?.type === 'QA' ? 'Q&A' : 'MCQ'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextReveal = !revealAnswer;
                      setRevealAnswer(nextReveal);
                      if (autoRunActive) {
                        setAutoRunPhase(nextReveal ? 'answer' : 'question');
                        setAutoRunSecondsLeft(nextReveal ? answerDuration : questionDuration);
                      }
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg font-khmer font-bold transition-all cursor-pointer ${
                      revealAnswer ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {revealAnswer ? 'លាក់ចម្លើយ' : 'បង្ហាញចម្លើយ (Reveal)'}
                  </button>
                </div>

                <p className="text-xs text-white font-khmer line-clamp-3 leading-relaxed">
                  {quizList[currentQuizIndex]?.question}
                </p>

                {/* Answer Preview Box */}
                {revealAnswer && (
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-1">
                    <span className="text-[10px] text-emerald-400 font-khmer font-bold block">
                      {quizList[currentQuizIndex]?.type === 'QA' ? 'ចម្លើយផ្លូវការ (Official Answer):' : 'ចម្លើយត្រឹមត្រូវ (Correct Option):'}
                    </span>
                    <p className="text-xs text-emerald-200 font-khmer leading-relaxed">
                      {quizList[currentQuizIndex]?.type === 'QA' 
                        ? (quizList[currentQuizIndex]?.answer || 'គ្មានចម្លើយ')
                        : (quizList[currentQuizIndex]?.options?.[quizList[currentQuizIndex]?.correctIndex ?? 0] || 'គ្មាន')}
                    </p>
                    {quizList[currentQuizIndex]?.explanation && (
                      <p className="text-[10px] text-emerald-300/80 font-khmer pt-1 border-t border-emerald-900/60">
                        💡 {quizList[currentQuizIndex]?.explanation}
                      </p>
                    )}
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentQuizIndex > 0) {
                        setCurrentQuizIndex(currentQuizIndex - 1);
                        setRevealAnswer(false);
                        setAutoRunPhase('question');
                        setAutoRunSecondsLeft(questionDuration);
                      }
                    }}
                    disabled={currentQuizIndex === 0}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white text-xs font-khmer transition-all cursor-pointer"
                  >
                    ថយក្រោយ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentQuizIndex < quizList.length - 1) {
                        setCurrentQuizIndex(currentQuizIndex + 1);
                        setRevealAnswer(false);
                        setAutoRunPhase('question');
                        setAutoRunSecondsLeft(questionDuration);
                      } else if (autoRunLoop) {
                        setCurrentQuizIndex(0);
                        setRevealAnswer(false);
                        setAutoRunPhase('question');
                        setAutoRunSecondsLeft(questionDuration);
                      }
                    }}
                    disabled={currentQuizIndex >= quizList.length - 1 && !autoRunLoop}
                    className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-xs font-khmer font-bold transition-all cursor-pointer"
                  >
                    សំណួរបន្ទាប់
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-khmer text-center py-4">
                ពុំមានសំណួរក្នុងស្ថាប័ននេះតាមប្រភេទដែលបានជ្រើសរើសទេ
              </p>
            )}
          </div>

          {/* Diagnostics and Server Logs Drawer */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-xs text-slate-300 font-khmer">
                  ទិន្នន័យបានបញ្ជូន: {(bytesSent / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-[11px] text-slate-400 hover:text-white font-mono cursor-pointer"
              >
                {showLogs ? 'លាក់ Logs' : 'មើល Logs'}
              </button>
            </div>

            {showLogs && (
              <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 max-h-40 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1">
                {serverLogs.length === 0 ? (
                  <p className="text-slate-600">មិនទាន់មាន logs ថ្មីទេ...</p>
                ) : (
                  serverLogs.map((log, i) => (
                    <div key={i} className="truncate">{log}</div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white font-khmer flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#D4AF37]" />
                <span>ការកំណត់ Live Stream RTMP</span>
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white text-xl cursor-pointer">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 font-khmer block mb-1">
                  Telegram RTMP Server URL:
                </label>
                <input
                  type="text"
                  value={rtmpUrl}
                  onChange={(e) => setRtmpUrl(e.target.value)}
                  onBlur={() => setRtmpUrl(prev => sanitizeRtmpUrl(prev))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                  placeholder="rtmps://dc4-1.rtmp.t.me/s/"
                />
                
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-khmer">ជ្រើសរើសរហ័ស (Presets):</span>
                  <button
                    type="button"
                    onClick={() => setRtmpUrl('rtmps://dc4-1.rtmp.t.me/s/')}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-sky-950 text-sky-300 border border-sky-800 hover:bg-sky-900 cursor-pointer font-mono"
                  >
                    Telegram
                  </button>
                  <button
                    type="button"
                    onClick={() => setRtmpUrl('rtmp://a.rtmp.youtube.com/live2')}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-red-950 text-red-300 border border-red-800 hover:bg-red-900 cursor-pointer font-mono"
                  >
                    YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => setRtmpUrl('rtmps://live-api-s.facebook.com:443/rtmp/')}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-950 text-blue-300 border border-blue-800 hover:bg-blue-900 cursor-pointer font-mono"
                  >
                    Facebook
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 font-khmer block mb-1">
                  Stream Key:
                </label>
                <div className="relative">
                  <input
                    type={showStreamKey ? 'text' : 'password'}
                    value={streamKey}
                    onChange={(e) => setStreamKey(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                    placeholder="123456789:AAG_xxxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStreamKey(!showStreamKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showStreamKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 font-khmer block mb-1">
                  Telegram Channel Chat ID / @channel (សម្រាប់ផ្ញើសារជូនដំណឹង):
                </label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                  placeholder="@your_channel ឬ -100xxxxxxxxxx"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 font-khmer block mb-1">
                    កម្រិតច្បាស់ (Resolution):
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as '720p' | '1080p' | '480p')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-khmer focus:outline-none focus:border-sky-500"
                  >
                    <option value="720p">720p HD (លឿន និងច្បាស់ល្អ)</option>
                    <option value="1080p">1080p Full HD (ច្បាស់កម្រិតខ្ពស់)</option>
                    <option value="480p">480p SD (សន្សំសំចៃអ៊ីនធឺណិត)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 font-khmer block mb-1">
                    របៀបសាកល្បង (Test Mode):
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTestMode(!isTestMode)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-khmer font-bold transition-all cursor-pointer ${
                      isTestMode ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {isTestMode ? 'បើក Test Mode (មិនបាច់ប្រើ Key)' : 'បិទ Test Mode (ផ្សាយផ្ទាល់ពិត)'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-khmer font-bold text-xs cursor-pointer"
              >
                យល់ព្រម & រក្សាទុក
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: How to Get Stream Key Guide */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white font-khmer flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-400" />
                <span>របៀបផ្សាយផ្ទាល់ទៅកាន់ Telegram Channel</span>
              </h3>
              <button onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white text-xl cursor-pointer">×</button>
            </div>

            <div className="space-y-4 font-khmer text-xs md:text-sm text-slate-300 leading-relaxed">
              <div className="flex items-start gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  <p className="font-bold text-white mb-1">បើក Telegram Channel ឬ Group របស់អ្នក</p>
                  <p className="text-slate-400 text-xs">
                    ត្រូវប្រាកដថាអ្នកជា Administrator ឬ Owner នៃ Channel នោះ។
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  <p className="font-bold text-white mb-1">ចុចលើ Live Stream -&gt; Stream with...</p>
                  <p className="text-slate-400 text-xs">
                    ចុចលើឈ្មោះ Channel -&gt; ម៉ឺនុយ 3 ចុច (...) -&gt; ចុច <b>&quot;Live Stream&quot;</b> ឬ <b>&quot;Start Live Stream&quot;</b> រួចជ្រើសរើស <b>&quot;Stream with...&quot;</b> (ផ្សាយជាមួយ OBS ឬឧបករណ៍ខាងក្រៅ)។
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  <p className="font-bold text-white mb-1">ចម្លង (Copy) Server URL &amp; Stream Key</p>
                  <p className="text-slate-400 text-xs">
                    ចម្លង <b>Server URL</b> (ជាទូទៅ <code className="text-sky-400 font-mono">rtmps://dc4-1.rtmp.t.me/s/</code>) និង <b>Stream Key</b> រួចយកមកបិទភ្ជាប់ (Paste) ក្នុង Vignasa Hub Live Studio នេះ។
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  4
                </div>
                <div>
                  <p className="font-bold text-white mb-1">ចុច &quot;ចាប់ផ្ដើមការផ្សាយ (Go Live)&quot;</p>
                  <p className="text-slate-400 text-xs">
                    ចុចប៊ូតុង &quot;Go Live&quot; ក្នុង Vignasa Hub រួចត្រឡប់ទៅកម្មវិធី Telegram ចុច &quot;Start Streaming&quot; ដើម្បីផ្សាយទៅកាន់សមាជិកទាំងអស់ក្នុង Channel!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-khmer font-bold text-xs cursor-pointer"
              >
                យល់ហើយ (Got it)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
