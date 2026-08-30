'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ClientPortalProps {
    children: ReactNode;
    targetSelector?: string;
}

export function ClientPortal({ children, targetSelector }: ClientPortalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted || typeof document === 'undefined') {
        return null;
    }

    const container = targetSelector
        ? document.querySelector(targetSelector) || document.body
        : document.body;

    return createPortal(children, container);
}
