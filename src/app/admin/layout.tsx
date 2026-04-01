'use client';

import { ReactNode, useState, useEffect } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import type { AuthPayload } from '@/types';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [user, setUser] = useState<AuthPayload | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                const data = await res.json();
                if (data.success) {
                    setUser(data.data);
                }
            } catch (err) { }
        };
        fetchUser();
    }, []);

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
            <AdminSidebar 
                isOpen={isSidebarOpen} 
                onClose={() => setIsSidebarOpen(false)} 
                user={user} 
            />

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
                <AdminHeader 
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
