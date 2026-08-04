'use client';

import { useCallback, useLayoutEffect, useState } from 'react';

const DESKTOP_SIDEBAR_QUERY = '(min-width: 768px)';

export function useResponsiveSidebar() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useLayoutEffect(() => {
        const mediaQuery = window.matchMedia(DESKTOP_SIDEBAR_QUERY);
        const syncSidebar = () => setIsSidebarOpen(mediaQuery.matches);

        syncSidebar();
        mediaQuery.addEventListener('change', syncSidebar);

        return () => mediaQuery.removeEventListener('change', syncSidebar);
    }, []);

    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
    const toggleSidebar = useCallback(() => setIsSidebarOpen((current) => !current), []);

    return { isSidebarOpen, closeSidebar, toggleSidebar };
}
