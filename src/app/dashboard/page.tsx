'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    RocketIcon,
    LockIcon,
    Tick01Icon,
    PlayIcon,
    Clock01Icon,
    Calendar01Icon,
    BookOpen01Icon,
    ArrowRight01Icon,
} from 'hugeicons-react';

type Session = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    module_title: string;
    total_items: number;
    completed_items: number;
};

export default function UserDashboardPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/participant/sessions')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setSessions(data.data);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const now = new Date();

    function getStatus(s: Session) {
        // If 100% completed, always "completed" regardless of time
        if (s.total_items > 0 && s.completed_items >= s.total_items) return 'completed';
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'active';
        return 'ended';
    }

    function formatDateShort(dateStr: string) {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short',
        });
    }

    function formatTime(dateStr: string) {
        return new Date(dateStr).toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit',
        });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    const activeSessions = sessions.filter((s) => getStatus(s) === 'active');
    const completedSessions = sessions.filter((s) => getStatus(s) === 'completed');
    const upcomingSessions = sessions.filter((s) => getStatus(s) === 'upcoming');
    const endedSessions = sessions.filter((s) => getStatus(s) === 'ended');

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Sesi Saya</h1>
                <p className="text-muted-foreground text-sm mt-1">Pelatihan dan ujian yang Anda ikuti.</p>
            </div>

            {sessions.length === 0 ? (
                <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center mb-4">
                        <BookOpen01Icon size={28} className="text-muted-foreground/40" />
                    </div>
                    <p className="font-semibold text-muted-foreground">Belum ada sesi</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">Hubungi administrator untuk didaftarkan ke sesi pelatihan.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {activeSessions.length > 0 && (
                        <SessionGroup title="Sedang Berlangsung" sessions={activeSessions} status="active" formatDateShort={formatDateShort} formatTime={formatTime} />
                    )}
                    {upcomingSessions.length > 0 && (
                        <SessionGroup title="Akan Datang" sessions={upcomingSessions} status="upcoming" formatDateShort={formatDateShort} formatTime={formatTime} />
                    )}
                    {completedSessions.length > 0 && (
                        <SessionGroup title="Selesai (100%)" sessions={completedSessions} status="completed" formatDateShort={formatDateShort} formatTime={formatTime} />
                    )}
                    {endedSessions.length > 0 && (
                        <SessionGroup title="Berakhir" sessions={endedSessions} status="ended" formatDateShort={formatDateShort} formatTime={formatTime} />
                    )}
                </div>
            )}
        </div>
    );
}

function SessionGroup({ title, sessions, status, formatDateShort, formatTime }: {
    title: string; sessions: Session[]; status: string;
    formatDateShort: (d: string) => string; formatTime: (d: string) => string;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</h2>
                <span className="text-[10px] font-bold bg-black/5 text-muted-foreground px-2 py-0.5 rounded-full">{sessions.length}</span>
            </div>
            <div className="space-y-2">
                {sessions.map((s) => (
                    <SessionRow key={s.id} session={s} status={status} formatDateShort={formatDateShort} formatTime={formatTime} />
                ))}
            </div>
        </div>
    );
}

function SessionRow({ session, status, formatDateShort, formatTime }: {
    session: Session; status: string;
    formatDateShort: (d: string) => string; formatTime: (d: string) => string;
}) {
    const progress = session.total_items > 0
        ? Math.round((session.completed_items / session.total_items) * 100)
        : 0;

    const statusStyles: Record<string, { dot: string; bg: string }> = {
        active: { dot: 'bg-emerald-500 animate-pulse', bg: 'border-emerald-200/50' },
        upcoming: { dot: 'bg-blue-400', bg: 'border-blue-100/50' },
        completed: { dot: 'bg-emerald-500', bg: 'border-emerald-100/50' },
        ended: { dot: 'bg-gray-300', bg: '' },
    };

    const style = statusStyles[status] || statusStyles.ended;
    const isClickable = status === 'active' || status === 'completed' || status === 'ended';

    const content = (
        <div className={`glass-card p-4 flex items-center gap-4 ${isClickable ? 'glass-card-hover group cursor-pointer' : ''} ${style.bg} transition-all`}>
            {/* Status Dot */}
            <div className="flex items-center justify-center w-8">
                <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold truncate">{session.title}</h3>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span>{session.module_title}</span>
                    <span className="opacity-30">·</span>
                    <span className="flex items-center gap-1">
                        <Calendar01Icon size={10} />
                        {formatDateShort(session.start_time)} {formatTime(session.start_time)}
                    </span>
                </div>
            </div>

            {/* Progress */}
            <div className="hidden sm:flex items-center gap-3 shrink-0">
                <div className="w-24">
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span className="text-muted-foreground">{session.completed_items}/{session.total_items}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${progress === 100 ? 'bg-emerald-500' : 'bg-foreground'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Action Chevron */}
            {isClickable && (
                <ArrowRight01Icon size={16} className="text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
            )}
            {status === 'upcoming' && (
                <LockIcon size={14} className="text-muted-foreground/30 shrink-0" />
            )}
        </div>
    );

    if (isClickable) {
        return <Link href={`/dashboard/sesi/${session.id}`}>{content}</Link>;
    }

    return content;
}
