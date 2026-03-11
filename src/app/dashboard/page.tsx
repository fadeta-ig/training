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
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'active';
        return 'ended';
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const activeSessions = sessions.filter((s) => getStatus(s) === 'active');
    const upcomingSessions = sessions.filter((s) => getStatus(s) === 'upcoming');
    const endedSessions = sessions.filter((s) => getStatus(s) === 'ended');

    return (
        <div className="space-y-10 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">Sesi Saya</h1>
                <p className="text-muted-foreground mt-2 text-sm lg:text-base">
                    Daftar sesi pelatihan dan ujian yang Anda ikuti.
                </p>
            </div>

            {sessions.length === 0 ? (
                <div className="glass-card p-10 flex flex-col items-center justify-center min-h-[400px]">
                    <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center mb-5">
                        <BookOpen01Icon size={40} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-semibold text-muted-foreground">Belum Ada Sesi Terdaftar</p>
                    <p className="text-sm text-muted-foreground/70 mt-2 text-center max-w-sm">
                        Anda belum didaftarkan ke sesi pelatihan atau ujian. Hubungi administrator untuk mendaftarkan Anda ke sesi yang tersedia.
                    </p>
                </div>
            ) : (
                <>
                    {/* Active Sessions */}
                    {activeSessions.length > 0 && (
                        <SectionBlock title="Sedang Berlangsung" count={activeSessions.length}>
                            {activeSessions.map((s) => (
                                <SessionCard key={s.id} session={s} status="active" formatDate={formatDate} />
                            ))}
                        </SectionBlock>
                    )}

                    {/* Upcoming Sessions */}
                    {upcomingSessions.length > 0 && (
                        <SectionBlock title="Akan Datang" count={upcomingSessions.length}>
                            {upcomingSessions.map((s) => (
                                <SessionCard key={s.id} session={s} status="upcoming" formatDate={formatDate} />
                            ))}
                        </SectionBlock>
                    )}

                    {/* Ended Sessions */}
                    {endedSessions.length > 0 && (
                        <SectionBlock title="Selesai" count={endedSessions.length}>
                            {endedSessions.map((s) => (
                                <SessionCard key={s.id} session={s} status="ended" formatDate={formatDate} />
                            ))}
                        </SectionBlock>
                    )}
                </>
            )}
        </div>
    );
}

function SectionBlock({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                <span className="bg-black/5 text-muted-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {count}
                </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{children}</div>
        </div>
    );
}

function SessionCard({
    session,
    status,
    formatDate,
}: {
    session: Session;
    status: 'active' | 'upcoming' | 'ended';
    formatDate: (d: string) => string;
}) {
    const progress = session.total_items > 0
        ? Math.round((session.completed_items / session.total_items) * 100)
        : 0;

    const statusConfig = {
        active: { label: 'Sedang Berlangsung', color: 'bg-emerald-100 text-emerald-700', icon: <RocketIcon size={28} /> },
        upcoming: { label: 'Akan Datang', color: 'bg-blue-100 text-blue-700', icon: <Calendar01Icon size={28} /> },
        ended: { label: 'Selesai', color: 'bg-black/5 text-muted-foreground', icon: <Tick01Icon size={28} /> },
    };

    const cfg = statusConfig[status];
    const isAccessible = status === 'active';

    return (
        <div className={`glass-card p-6 flex flex-col ${isAccessible ? 'glass-card-hover' : ''} group`}>
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${cfg.color}`}>
                        {cfg.label}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight leading-tight">{session.title}</h2>
                    {session.module_title && (
                        <p className="text-xs text-muted-foreground font-medium">{session.module_title}</p>
                    )}
                </div>
                <div className={`p-3 rounded-2xl transition-colors duration-300 ${isAccessible
                    ? 'bg-black/5 group-hover:bg-foreground group-hover:text-background'
                    : 'bg-black/5 text-muted-foreground/50'
                    }`}>
                    {cfg.icon}
                </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
                <Clock01Icon size={12} />
                <span>{formatDate(session.start_time)} — {formatDate(session.end_time)}</span>
            </div>

            <div className="mt-auto space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-semibold">
                        <span>Progress</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${status === 'ended' ? 'bg-muted-foreground' : 'bg-foreground'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {session.completed_items} / {session.total_items} item selesai
                    </p>
                </div>

                {/* Action Button */}
                {isAccessible ? (
                    <Link
                        href={`/dashboard/sesi/${session.id}`}
                        className="w-full px-5 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center justify-center gap-2 active:scale-95"
                    >
                        <PlayIcon size={16} />
                        Mulai Belajar
                    </Link>
                ) : status === 'upcoming' ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium bg-black/5 px-4 py-2.5 rounded-xl">
                        <LockIcon size={16} />
                        Sesi belum dimulai
                    </div>
                ) : (
                    <Link
                        href={`/dashboard/sesi/${session.id}`}
                        className="w-full px-5 py-2.5 text-sm font-semibold rounded-xl border border-black/10 text-foreground hover:bg-black/5 transition-colors flex items-center justify-center gap-2 active:scale-95"
                    >
                        Lihat Hasil
                    </Link>
                )}
            </div>
        </div>
    );
}
