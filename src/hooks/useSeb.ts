import { useSyncExternalStore } from 'react';

/**
 * Checks if the current browser environment is Safe Exam Browser (SEB).
 * Utilizes `useSyncExternalStore` to avoid SSR hydration mismatches
 * and cascading re-renders caused by synchronous `setState` in `useEffect`.
 */
function checkIsSeb(): boolean {
    if (typeof window === 'undefined') return false;
    
    const ua = (navigator.userAgent || '').toLowerCase();
    
    // Check User-Agent strings across Windows, macOS, iOS
    const isSebUA = 
        ua.includes('safeexambrowser') ||
        ua.includes('seb/') ||
        /\bseb\b/.test(ua);

    // Check JavaScript window objects injected by SEB iOS / macOS / Windows
    const sebObj = (window as unknown as Record<string, any>).SafeExamBrowser;
    const hasSebWindow = sebObj !== undefined && sebObj !== null;

    return isSebUA || hasSebWindow;
}

export interface SafeExamBrowserSecurity {
    browserExamKey?: string;
    configKey?: string;
    updateKeys?: (callback: () => void) => void;
    logout?: () => void;
}

export interface SafeExamBrowserObject {
    security?: SafeExamBrowserSecurity;
    terminateBrowser?: () => void;
    [key: string]: unknown;
}

declare global {
    interface Window {
        SafeExamBrowser?: SafeExamBrowserObject;
    }
}

const subscribeNoop = () => () => {};

export function useIsSeb(): boolean {
    return useSyncExternalStore(
        subscribeNoop,
        checkIsSeb,
        () => false
    );
}

/**
 * Safely extracts SEB security headers from the Modern WebView JS API or global context.
 */
export function getSebHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const seb = window.SafeExamBrowser;
    if (!seb?.security) return {};

    const headers: Record<string, string> = {};
    if (typeof seb.security.configKey === 'string' && seb.security.configKey.trim()) {
        headers['x-safeexambrowser-configkeyhash'] = seb.security.configKey.trim();
    }
    if (typeof seb.security.browserExamKey === 'string' && seb.security.browserExamKey.trim()) {
        headers['x-safeexambrowser-requesthash'] = seb.security.browserExamKey.trim();
    }
    return headers;
}

/**
 * Asynchronously query the SEB JavaScript API to update security keys
 * in Modern WebView (WKWebView) environments before making network calls.
 */
export async function updateSebSecurityKeys(): Promise<Record<string, string>> {
    if (typeof window === 'undefined') return {};
    const seb = window.SafeExamBrowser;
    if (!seb?.security) return {};

    if (typeof seb.security.updateKeys === 'function') {
        await new Promise<void>((resolve) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    resolve();
                }
            }, 600);

            try {
                seb.security?.updateKeys?.(() => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            } catch {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeout);
                    resolve();
                }
            }
        });
    }

    return getSebHeaders();
}
