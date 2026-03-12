'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Notification01Icon,
    TickDouble01Icon,
    Tick01Icon,
    ArrowRight01Icon,
} from 'hugeicons-react';

type Notification = {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    link_url: string | null;
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = () => {
        fetch('/api/participant/notifications')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setNotifications(data.data);
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await fetch('/api/participant/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: id })
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch { }
    };

    const markAllAsRead = async () => {
        try {
            await fetch('/api/participant/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mark_all: true })
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch { }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Notifikasi</h1>
                    <p className="text-muted-foreground text-sm mt-1">Pembaruan dan informasi terkait sesi pelatihan Anda.</p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 text-sm font-semibold rounded-xl transition-colors shrink-0"
                    >
                        <TickDouble01Icon size={16} />
                        Tandai Semua Dibaca
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {notifications.length === 0 ? (
                    <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
                        <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center mb-4 text-muted-foreground/40">
                            <Notification01Icon size={28} />
                        </div>
                        <p className="font-semibold text-muted-foreground">Tidak Ada Notifikasi</p>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">Anda telah membaca seluruh pemberitahuan yang ada.</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <div key={n.id} className={`glass-card p-5 flex items-start gap-4 transition-all ${n.is_read ? 'opacity-70 bg-white/40' : 'bg-white/80 border-black/20 shadow-sm'
                            }`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.is_read ? 'bg-black/5 text-muted-foreground' : 'bg-blue-50 text-blue-600'
                                }`}>
                                <Notification01Icon size={20} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <h3 className={`text-sm ${n.is_read ? 'font-semibold' : 'font-bold'}`}>{n.title}</h3>
                                    <span className="text-[10px] text-muted-foreground shrink-0 border border-black/10 px-2 py-0.5 rounded-full">
                                        {new Date(n.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{n.message}</p>

                                <div className="flex items-center gap-3">
                                    {n.link_url && (
                                        <Link href={n.link_url} className="text-[11px] font-bold text-foreground bg-black/5 hover:bg-black/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 w-fit">
                                            Lihat Detail
                                            <ArrowRight01Icon size={12} />
                                        </Link>
                                    )}
                                    {!n.is_read && (
                                        <button onClick={() => markAsRead(n.id)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 w-fit">
                                            <Tick01Icon size={12} />
                                            Tandai Dibaca
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
