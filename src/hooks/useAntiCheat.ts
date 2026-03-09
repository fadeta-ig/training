'use client';

import { useEffect } from 'react';

/**
 * Anti-Cheat DOM Protection Hook
 *
 * Disables: text selection, right-click, copy, paste, cut, and
 * common keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+A, PrintScreen)
 * on the page where this hook is called.
 *
 * Should ONLY be used on exam pages.
 */
export function useAntiCheat(isEnabled: boolean = true): void {
    useEffect(() => {
        if (!isEnabled) return;

        const preventDefault = (e: Event) => e.preventDefault();

        /** Block keyboard shortcuts */
        const handleKeyDown = (e: KeyboardEvent) => {
            const blocked =
                // Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+A / Ctrl+S / Ctrl+P
                (e.ctrlKey && ['c', 'v', 'x', 'a', 's', 'p'].includes(e.key.toLowerCase())) ||
                // F12 (DevTools)
                e.key === 'F12' ||
                // Ctrl+Shift+I (DevTools)
                (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') ||
                // Ctrl+Shift+J (Console)
                (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'j') ||
                // Ctrl+U (View Source)
                (e.ctrlKey && e.key.toLowerCase() === 'u') ||
                // PrintScreen
                e.key === 'PrintScreen';

            if (blocked) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Disable text selection via CSS
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';

        // Attach event listeners
        document.addEventListener('contextmenu', preventDefault);
        document.addEventListener('copy', preventDefault);
        document.addEventListener('paste', preventDefault);
        document.addEventListener('cut', preventDefault);
        document.addEventListener('selectstart', preventDefault);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            // Restore defaults on cleanup
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';

            document.removeEventListener('contextmenu', preventDefault);
            document.removeEventListener('copy', preventDefault);
            document.removeEventListener('paste', preventDefault);
            document.removeEventListener('cut', preventDefault);
            document.removeEventListener('selectstart', preventDefault);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isEnabled]);
}
