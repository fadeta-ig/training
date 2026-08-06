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

const subscribeNoop = () => () => {};

export function useIsSeb(): boolean {
    return useSyncExternalStore(
        subscribeNoop,
        checkIsSeb,
        () => false
    );
}
