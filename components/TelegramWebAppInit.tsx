'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        backgroundColor?: string;
        safeAreaInset?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
        contentSafeAreaInset?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
        onEvent?: (eventType: string, eventHandler: () => void) => void;
        offEvent?: (eventType: string, eventHandler: () => void) => void;
      };
    };
  }
}

export function TelegramWebAppInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initTG = () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch {
          // ignore
        }

        const updateInsets = () => {
          try {
            const root = document.documentElement;
            const safeTop = tg.safeAreaInset?.top || tg.contentSafeAreaInset?.top || 0;
            const safeBottom = tg.safeAreaInset?.bottom || tg.contentSafeAreaInset?.bottom || 0;

            if (safeTop > 0) {
              root.style.setProperty('--tg-safe-area-inset-top', `${safeTop}px`);
            }
            if (safeBottom > 0) {
              root.style.setProperty('--tg-safe-area-inset-bottom', `${safeBottom}px`);
            }
          } catch {
            // ignore
          }
        };

        updateInsets();

        if (tg.onEvent) {
          tg.onEvent('viewportChanged', updateInsets);
        }

        return () => {
          if (tg.offEvent) {
            tg.offEvent('viewportChanged', updateInsets);
          }
        };
      }
    };

    // If script is already loaded
    if (window.Telegram?.WebApp) {
      return initTG();
    }

    // Otherwise load script dynamically if inside telegram user agent or iframe
    const isTg = typeof navigator !== 'undefined' && /Telegram/i.test(navigator.userAgent || '');
    if (isTg || window.self !== window.top) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true;
      script.onload = () => initTG();
      document.head.appendChild(script);
    }
  }, []);

  return null;
}
