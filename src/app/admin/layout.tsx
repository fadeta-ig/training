'use client';

import { ReactNode, useState, useEffect } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useResponsiveSidebar } from '@/hooks/useResponsiveSidebar';
import type { AuthPayload } from '@/types';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { isSidebarOpen, closeSidebar, toggleSidebar } = useResponsiveSidebar();
    const [user, setUser] = useState<AuthPayload | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                const data = await res.json();
                if (data.success) {
                    setUser(data.data);
                }
            } catch { }
        };
        fetchUser();
    }, []);

    return (
        <div className="flex h-dvh bg-background text-foreground font-sans overflow-hidden">
            <AdminSidebar 
                isOpen={isSidebarOpen} 
                onClose={closeSidebar}
                user={user} 
            />

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
                <AdminHeader 
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
