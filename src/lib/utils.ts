import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export const trackEvent = (eventName: string, params?: any) => {
  window.gtag?.("event", eventName, params);
};
