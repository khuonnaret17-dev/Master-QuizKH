import { QuizSession, QuizType } from './types';

const SESSION_PREFIX = 'vignasa_quiz_session_';
const LAST_ACTIVE_KEY = 'vignasa_last_active_quiz';

export function getSessionStorageKey(ministryId: string, quizType: string, category: string): string {
  const safeCat = encodeURIComponent(category.trim());
  return `${SESSION_PREFIX}${ministryId}_${quizType}_${safeCat}`;
}

export function getSavedSession(ministryId: string, quizType: string, category: string): QuizSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getSessionStorageKey(ministryId, quizType, category);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const session = JSON.parse(raw) as QuizSession;
    if (!session || !Array.isArray(session.quizzes) || session.quizzes.length === 0) {
      return null;
    }
    // Only return unfinished sessions
    if (session.isFinished) return null;
    return session;
  } catch (e) {
    console.warn('Error reading saved quiz session:', e);
    return null;
  }
}

export function saveSession(session: QuizSession): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getSessionStorageKey(session.ministryId, session.quizType, session.category);
    const data: QuizSession = {
      ...session,
      updatedAt: Date.now()
    };
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
    if (!session.isFinished) {
      localStorage.setItem(LAST_ACTIVE_KEY, json);
    } else {
      clearLastActiveSessionIfMatches(session.ministryId, session.quizType, session.category);
    }
  } catch (e) {
    console.warn('Error saving quiz session:', e);
  }
}

export function clearSession(ministryId: string, quizType: string, category: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getSessionStorageKey(ministryId, quizType, category);
    localStorage.removeItem(key);
    clearLastActiveSessionIfMatches(ministryId, quizType, category);
  } catch (e) {
    console.warn('Error clearing quiz session:', e);
  }
}

export function getLastActiveSession(): QuizSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as QuizSession;
    if (!session || session.isFinished || !Array.isArray(session.quizzes) || session.quizzes.length === 0) {
      return null;
    }
    return session;
  } catch (e) {
    console.warn('Error reading last active quiz session:', e);
    return null;
  }
}

export function clearLastActiveSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch (e) {
    console.warn('Error removing last active session:', e);
  }
}

function clearLastActiveSessionIfMatches(ministryId: string, quizType: string, category: string): void {
  if (typeof window === 'undefined') return;
  try {
    const last = getLastActiveSession();
    if (last && last.ministryId === ministryId && last.quizType === quizType && last.category === category) {
      localStorage.removeItem(LAST_ACTIVE_KEY);
    }
  } catch {
    // ignore
  }
}

export function findMinistryUnfinishedSession(ministryId: string, quizType?: QuizType): QuizSession | null {
  if (typeof window === 'undefined') return null;
  try {
    // First check last active
    const last = getLastActiveSession();
    if (last && last.ministryId === ministryId && (!quizType || last.quizType === quizType)) {
      return last;
    }

    // Scan localStorage for matching keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_PREFIX)) {
        if (key.includes(`_${ministryId}_`)) {
          if (!quizType || key.includes(`_${quizType}_`)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const session = JSON.parse(raw) as QuizSession;
              if (session && !session.isFinished && session.quizzes && session.quizzes.length > 0) {
                return session;
              }
            }
          }
        }
      }
    }
    return null;
  } catch (e) {
    console.warn('Error scanning ministry sessions:', e);
    return null;
  }
}

export function hasCategoryUnfinishedSession(ministryId: string, quizType: string, category: string): boolean {
  const session = getSavedSession(ministryId, quizType, category);
  return !!session && !session.isFinished && (session.currentIdx > 0 || Object.keys(session.answers || {}).length > 0);
}
