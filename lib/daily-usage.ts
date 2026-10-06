'use client';

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const DAILY_FREE_QUESTIONS_LIMIT = 10;
export const TELEGRAM_UNLOCK_URL = 'https://t.me/qcm_and_q_a';
export const TELEGRAM_HANDLE = '@qcm_and_q_a';

export function getPhnomPenhDateString(): string {
  try {
    const d = new Date();
    // Format YYYY-MM-DD in Asia/Phnom_Penh timezone
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(d);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getStorageKey(userId?: string | null): string {
  const uid = userId || 'anonymous';
  const today = getPhnomPenhDateString();
  return `vignasa_daily_q_${uid}_${today}`;
}

export function getDailyQuestionsAnswered(userId?: string | null): number {
  if (typeof window === 'undefined') return 0;
  try {
    const key = getStorageKey(userId);
    const val = localStorage.getItem(key);
    if (!val) return 0;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  } catch {
    return 0;
  }
}

export function incrementDailyQuestionsAnswered(userId?: string | null, amount: number = 1): number {
  if (typeof window === 'undefined') return 0;
  try {
    const key = getStorageKey(userId);
    const current = getDailyQuestionsAnswered(userId);
    const nextVal = current + amount;
    localStorage.setItem(key, String(nextVal));

    // Async sync with Firestore if user exists
    if (userId && db) {
      const today = getPhnomPenhDateString();
      const coll = userId.startsWith('custom_') ? 'custom_users' : 'users';
      const docId = userId.startsWith('custom_') ? userId.replace(/^custom_/, '').toLowerCase() : userId;
      const userRef = doc(db, coll, docId);

      setDoc(userRef, {
        dailyUsage: {
          date: today,
          count: nextVal,
          updatedAt: serverTimestamp()
        }
      }, { merge: true }).catch(() => {});
    }

    // Trigger local storage event for reactive UI updates
    window.dispatchEvent(new Event('vignasa_daily_usage_updated'));
    return nextVal;
  } catch {
    return 0;
  }
}

export function getDailyQuestionsRemaining(userId?: string | null, isPremium?: boolean): number {
  if (isPremium) return Infinity;
  const answered = getDailyQuestionsAnswered(userId);
  return Math.max(0, DAILY_FREE_QUESTIONS_LIMIT - answered);
}

export function hasReachedDailyLimit(userId?: string | null, isPremium?: boolean): boolean {
  if (isPremium) return false;
  return getDailyQuestionsAnswered(userId) >= DAILY_FREE_QUESTIONS_LIMIT;
}
