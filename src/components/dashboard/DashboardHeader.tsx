'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Menu01Icon,
    Notification01Icon,
    UserCircleIcon,
    Logout01Icon,
    ArrowRight01Icon,
} from 'hugeicons-react';
import type { AuthPayload } from '@/types';

interface DashboardHeaderProps {
    toggleSidebar: () => void;
    user: AuthPayload | null;
}

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    link_url?: string;
}

export function DashboardHeader({ toggleSidebar, user }: DashboardHeaderProps) {
    const router = useRouter();
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/participant/notifications');
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setNotifications(data.data);
            }
        } catch {}
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);


    // Outside click handlers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const handleMarkAllRead = async () => {
        try {
            await fetch('/api/participant/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mark_all: true }),
            });
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch {}
    };

    const handleMarkRead = async (id: string) => {
        try {
            await fetch('/api/participant/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: id }),
            });
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
        } catch {}
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.replace('/auth/login');
        } catch {
            router.replace('/auth/login');
        }
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-black/5 bg-white/80 backdrop-blur-md shrink-0 z-30 relative">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                <button
                    type="button"
                    aria-label="Buka atau tutup menu navigasi"
                    onClick={toggleSidebar}
                    className="flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-black/5 transition-colors"
                >
                    <Menu01Icon size={20} />
                </button>
                <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate hidden sm:block">
                    Selamat datang, {user?.full_name?.split(' ')[0] || 'Peserta'}!
                </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {/* Notifications Dropdown Container */}
                <div className="relative" ref={notifRef}>
                    <button
                        type="button"
                        aria-label="Buka notifikasi"
                        onClick={() => {
                            setIsNotifOpen(!isNotifOpen);
                            if (!isNotifOpen) fetchNotifications();
                        }}
                        className={`p-2 rounded-xl transition-colors relative ${
                            isNotifOpen
                                ? 'bg-black/10 text-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                        }`}
                    >
                        <Notification01Icon size={21} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-white" />
                        )}
                    </button>

                    {/* Dropdown Menu Panel */}
                    {isNotifOpen && (
                        <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-96 bg-white border border-black/10 shadow-xl rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                            {/* Header */}
                            <div className="p-3.5 border-b border-black/5 bg-slate-50/80 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-xs text-foreground">Notifikasi</h3>
                                    {unreadCount > 0 && (
                                        <span className="bg-destructive/10 text-destructive text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                            {unreadCount} baru
                                        </span>
                                    )}
                                </div>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
                                    >
                                        Tandai dibaca
                                    </button>
                                )}
                            </div>

                            {/* Notifications List */}
                            <div className="max-h-80 overflow-y-auto divide-y divide-black/5">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-muted-foreground">
                                        Belum ada notifikasi.
                                    </div>
                                ) : (
                                    notifications.slice(0, 5).map((notif) => (
                                        <div
                                            key={notif.id}
                                            onClick={() => {
                                                if (!notif.is_read) handleMarkRead(notif.id);
                                                if (notif.link_url) {
                                                    setIsNotifOpen(false);
                                                    router.push(notif.link_url);
                                                }
                                            }}
                                            className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer text-left ${
                                                !notif.is_read ? 'bg-slate-50/50' : ''
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p
                                                    className={`text-xs font-semibold ${
                                                        !notif.is_read ? 'text-foreground' : 'text-slate-600'
                                                    }`}
                                                >
                                                    {notif.title}
                                                </p>
                                                {!notif.is_read && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                                {notif.message}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1.5 font-mono">
                                                {formatTime(notif.created_at)}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer Link */}
                            <div className="p-2.5 border-t border-black/5 bg-slate-50/50 text-center">
                                <Link
                                    href="/dashboard/notifikasi"
                                    onClick={() => setIsNotifOpen(false)}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-800 hover:text-slate-900 transition-colors"
                                >
                                    Lihat Semua Notifikasi <ArrowRight01Icon size={12} />
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Profile Avatar & Dropdown Container */}
                <div className="relative" ref={profileRef}>
                    <button
                        type="button"
                        aria-label="Buka menu profil"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-semibold hover:bg-slate-800 transition-all border border-black/10 focus:outline-none"
                    >
                        {user?.full_name?.charAt(0)?.toUpperCase() || 'P'}
                    </button>

                    {isProfileOpen && (
                        <div className="absolute right-0 top-full mt-2.5 w-48 bg-white border border-black/10 shadow-xl rounded-xl overflow-hidden z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="px-4 py-2.5 border-b border-black/5 bg-slate-50/50">
                                <p className="text-xs font-semibold text-foreground truncate">
                                    {user?.full_name || 'Peserta'}
                                </p>
                                {user?.nip ? (
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                                            {user.nip}
                                        </span>
                                        {user.batch && (
                                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                B{user.batch}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {user?.username || '@peserta'}
                                    </p>
                                )}
                            </div>

                            <Link
                                href="/dashboard/profil"
                                onClick={() => setIsProfileOpen(false)}
                                className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-foreground transition-colors"
                            >
                                <UserCircleIcon size={15} />
                                Profil Saya
                            </Link>

                            <div className="h-px bg-black/5 my-1" />

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                            >
                                <Logout01Icon size={15} />
                                Keluar Aplikasi
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
