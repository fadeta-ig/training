import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Menu01Icon,
    Notification01Icon,
    UserCircleIcon,
    Settings01Icon,
    Logout01Icon,
} from 'hugeicons-react';
import type { AuthPayload, Notification } from '@/types';

interface AdminHeaderProps {
    toggleSidebar: () => void;
    user: AuthPayload | null;
}

export function AdminHeader({ toggleSidebar, user }: AdminHeaderProps) {
    const router = useRouter();
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const notificationRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await fetch('/api/notifications');
                const data = await res.json();
                if (data.success) {
                    setNotifications(data.data);
                    setUnreadCount(data.unreadCount);
                }
            } catch (err) { }
        };
        fetchNotifications();

        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsNotificationOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications', { method: 'PUT', body: JSON.stringify({ mark_all: true }) });
            setUnreadCount(0);
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch (err) { }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/auth/login');
    };

    const formatTime = (dateStr: string) => {
        const diffMin = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
        if (diffMin < 1) return 'Baru saja';
        if (diffMin < 60) return `${diffMin} menit lalu`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour} jam lalu`;
        return `${Math.floor(diffHour / 24)} hari lalu`;
    };

    return (
        <header className="h-16 flex items-center justify-between px-6 border-b border-black/5 bg-white/95 backdrop-blur-md shrink-0 z-30 relative">
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                >
                    <Menu01Icon size={22} />
                </button>
                <h2 className="text-lg font-semibold tracking-tight hidden sm:block">Administrator Hub</h2>
            </div>

            <div className="flex items-center gap-5">
                {/* Notifications Dropdown */}
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                        className={`text-muted-foreground hover:text-foreground transition-colors relative p-1.5 rounded-lg ${isNotificationOpen ? 'bg-black/5' : ''}`}
                    >
                        <Notification01Icon size={22} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-white"></span>
                        )}
                    </button>

                    {isNotificationOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white border border-black/10 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-3 border-b border-black/10 bg-[#f8f9fa] flex justify-between items-center">
                                <h3 className="font-semibold text-sm">Notifikasi {unreadCount > 0 && <span className="text-xs font-bold text-destructive">({unreadCount})</span>}</h3>
                                {unreadCount > 0 && (
                                    <button onClick={markAllAsRead} className="text-xs text-primary font-medium hover:underline">Tandai semua dibaca</button>
                                )}
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                                        Belum ada notifikasi.
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div key={notif.id} className={`px-4 py-3 hover:bg-black/5 transition-colors cursor-pointer border-b border-black/5 last:border-0 ${!notif.is_read ? 'bg-primary/5' : ''}`}>
                                            <p className="text-sm font-semibold">{notif.title}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                                            <p className="text-[10px] text-muted-foreground/70 mt-1.5">{formatTime(notif.created_at)}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-black text-white hover:scale-105 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        <span className="text-sm font-bold">{user ? user.username.charAt(0).toUpperCase() : 'A'}</span>
                    </button>

                    {isProfileOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white border border-black/10 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-4 border-b border-black/5 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-black/5 flex flex-col items-center justify-center text-foreground">
                                    <UserCircleIcon size={24} />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold truncate text-foreground">{user?.full_name || 'Administrator'}</p>
                                    <p className="text-xs font-medium text-muted-foreground truncate">@{user?.username || 'admin'}</p>
                                </div>
                            </div>

                            <div className="p-2 flex flex-col gap-1">
                                <Link href={user ? `/admin/users/${user.id}/edit` : '#'} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 active:bg-black/10 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">
                                    <Settings01Icon size={18} />
                                    Pengaturan Profil
                                </Link>
                            </div>

                            <div className="p-2 border-t border-black/5">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 active:bg-destructive/20 transition-colors text-sm font-medium text-destructive"
                                >
                                    <Logout01Icon size={18} />
                                    Keluar Sistem
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
