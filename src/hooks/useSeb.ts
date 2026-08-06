import { useSyncExternalStore } from 'react';

/**
 * Checks if the current browser environment is Safe Exam Browser (SEB).
 * Utilizes `useSyncExternalStore` to avoid SSR hydration mismatches
 * and cascading re-renders caused by synchronous `setState` in `useEffect`.
 */
function checkIsSeb(): boolean {
    if (typeof window === 'undefined') return false;
    
    const ua = (navigator.userAgent || '').toLowerCase();
    return (
        ua.includes('safeexambrowser') ||
        ua.includes('seb/') ||
        'SafeExamBrowser' in window ||
        (window as unknown as { SafeExamBrowser?: unknown }).SafeExamBrowser !== undefined
    );
}

const subscribeNoop = () => () => {};

export function useIsSeb(): boolean {
    return useSyncExternalStore(
        subscribeNoop,
        checkIsSeb,
        () => false
    );
}
