import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EventName, EventParams } from '@/types/analyticsEvent';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SESSION_ID_KEY = 'session_id';

export const getOrCreateSessionId = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const existing = window.localStorage.getItem(SESSION_ID_KEY);
    if (existing) {
      return existing;
    }

    const newId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(SESSION_ID_KEY, newId);
    return newId;
  } catch {
    return '';
  }
};

export const trackEvent = (eventName: EventName, params?: EventParams) => {
  const sessionId = getOrCreateSessionId();

  window.gtag?.('event', eventName, {
    ...(params ?? {}),
    ...(sessionId && !params?.session_id ? { session_id: sessionId } : {}),
  });
};
