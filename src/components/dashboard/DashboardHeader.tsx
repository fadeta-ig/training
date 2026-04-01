import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Menu01Icon,
    Notification01Icon,
    UserCircleIcon,
    Logout01Icon,
} from 'hugeicons-react';
import type { AuthPayload } from '@/types';

interface DashboardHeaderProps {
    toggleSidebar: () => void;
    user: AuthPayload | null;
}

export function DashboardHeader({ toggleSidebar, user }: DashboardHeaderProps) {
    const router = useRouter();
    const [unreadNotifs, setUnreadNotifs] = useState(0);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    useEffect(() => {
        fetch('/api/participant/notifications')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setUnreadNotifs(data.data.filter((n: any) => !n.is_read).length);
                }
            })
            .catch(() => { });
    }, []);

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.replace('/auth/login');
        } catch {
            router.replace('/auth/login');
        }
    };

    return (
        <header className="h-16 flex items-center justify-between px-6 border-b border-black/5 bg-white/60 backdrop-blur-md shrink-0 z-30">
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                >
                    <Menu01Icon size={22} />
                </button>
                <h2 className="text-lg font-semibold tracking-tight hidden sm:block">
                    Selamat datang, {user?.full_name?.split(' ')[0] || 'Peserta'}!
                </h2>
            </div>
            <div className="flex items-center gap-5 relative">
                {/* Notifications Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className={`p-2 rounded-xl transition-colors relative ${isNotifOpen ? 'bg-black/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}
                    >
                        <Notification01Icon size={22} />
                        {unreadNotifs > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></span>
                        )}
                    </button>

                    {isNotifOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)}></div>
                            <div className="absolute right-0 mt-2 w-72 bg-background border border-black/10 shadow-xl rounded-2xl overflow-hidden z-50 glass-card">
                                <div className="p-4 border-b border-black/5 flex items-center justify-between">
                                    <h3 className="font-bold text-sm">Notifikasi</h3>
                                    {unreadNotifs > 0 && (
                                        <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadNotifs} baru</span>
                                    )}
                                </div>
                                <div className="p-4 text-center">
                                    <Link
                                        href="/dashboard/notifikasi"
                                        onClick={() => setIsNotifOpen(false)}
                                        className="text-xs font-semibold text-foreground hover:underline transition-all"
                                    >
                                        Lihat Semua Notifikasi &rarr;
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Profile Avatar & Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center text-background text-xs font-bold hover:ring-2 hover:ring-foreground/20 transition-all border-2 border-transparent focus:border-white"
                    >
                        {user?.full_name?.charAt(0)?.toUpperCase() || 'P'}
                    </button>

                    {isProfileOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                            <div className="absolute right-0 mt-2 w-48 bg-background border border-black/10 shadow-xl rounded-2xl overflow-hidden z-50 py-1">
                                <Link
                                    href="/dashboard/profil"
                                    onClick={() => setIsProfileOpen(false)}
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-black/5 transition-colors"
                                >
                                    <UserCircleIcon size={16} />
                                    Profil Saya
                                </Link>
                                <div className="h-px bg-black/5 my-1"></div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors text-left"
                                >
                                    <Logout01Icon size={16} />
                                    Log Keluar
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
