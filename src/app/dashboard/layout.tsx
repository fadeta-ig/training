'use client';

import { ReactNode, useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import type { AuthPayload } from '@/types';

export default function UserLayout({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
            <DashboardSidebar 
                isOpen={isSidebarOpen} 
                onClose={() => setIsSidebarOpen(false)} 
                user={user} 
            />

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background relative">
                <DashboardHeader 
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
                    user={user} 
                />

                <div className="flex-1 overflow-auto p-6 md:p-10 page-transition bg-transparent relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
