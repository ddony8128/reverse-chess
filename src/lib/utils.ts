import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EventName, EventParams } from '@/types/analyticsEvent';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export const trackEvent = (eventName: EventName, params?: EventParams) => {
  window.gtag?.("event", eventName, params);
};
