'use client';

import { ReactNode, useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { useResponsiveSidebar } from '@/hooks/useResponsiveSidebar';
import type { AuthPayload } from '@/types';

export default function UserLayout({ children }: { children: ReactNode }) {
    const { isSidebarOpen, closeSidebar, toggleSidebar } = useResponsiveSidebar();
    const [user, setUser] = useState<AuthPayload | null>(null);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setUser(data.data);
            })
            .catch(() => { });
    }, []);

    return (
        <div className="flex h-dvh bg-background text-foreground font-sans overflow-hidden">
            <DashboardSidebar 
                isOpen={isSidebarOpen} 
                onClose={closeSidebar}
                user={user} 
            />

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background relative">
                <DashboardHeader 
                    toggleSidebar={toggleSidebar}
                    user={user} 
                />

                <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-10 page-transition bg-transparent relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
