'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ClientPortalProps {
    children: ReactNode;
    targetSelector?: string;
}

const emptySubscribe = () => () => {};

export function ClientPortal({ children, targetSelector }: ClientPortalProps) {
    const isMounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );

    if (!isMounted || typeof document === 'undefined') {
        return null;
    }

    const container = targetSelector
        ? document.querySelector(targetSelector) || document.body
        : document.body;

    return createPortal(children, container);
}

