'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    PlayIcon,
    Clock01Icon,
    Tick01Icon,
    LockIcon,
    Book01Icon,
    Edit01Icon,
    AlertCircleIcon,
} from 'hugeicons-react';

type ModuleItem = {
    module_item_id: string;
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
    item_title: string;
    duration_minutes: number | null;
    progress_status: 'locked' | 'open' | 'completed';
    score: number | null;
};

type SessionDetail = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    module_title: string;
    module_id: string;
    items: ModuleItem[];
};

export default function ParticipantSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/participant/sessions/${id}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setSession(data.data);
                } else {
                    setError(data.error || 'Gagal memuat sesi');
                }
            })
            .catch(() => setError('Kesalahan jaringan'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={16} /> Kembali
                </Link>
                <div className="glass-card p-10 text-center">
                    <AlertCircleIcon size={48} className="mx-auto text-destructive mb-4" />
                    <p className="text-destructive font-semibold">{error || 'Sesi tidak ditemukan'}</p>
                </div>
            </div>
        );
    }

    const now = new Date();
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    const isActive = now >= start && now <= end;

    const completedCount = session.items.filter((i) => i.progress_status === 'completed').length;
    const progress = session.items.length > 0 ? Math.round((completedCount / session.items.length) * 100) : 0;

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-12">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                <ArrowLeft01Icon size={16} /> Kembali ke Sesi Saya
            </Link>

            {/* Header Card */}
            <div className="glass-card p-6 md:p-8 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${isActive ? 'bg-emerald-100 text-emerald-700' : now < start ? 'bg-blue-100 text-blue-700' : 'bg-black/5 text-muted-foreground'
                            }`}>
                            {isActive ? 'Sedang Berlangsung' : now < start ? 'Akan Datang' : 'Selesai'}
                        </span>
                        <h1 className="text-2xl font-bold tracking-tight mt-2">{session.title}</h1>
                        {session.module_title && (
                            <p className="text-sm text-muted-foreground mt-1">Modul: {session.module_title}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                    <Clock01Icon size={12} />
                    <span>
                        {new Date(session.start_time).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {new Date(session.end_time).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                {/* Progress */}
                <div className="pt-4 border-t border-black/5 space-y-2">
                    <div className="flex justify-between text-sm font-semibold">
                        <span>Progress Keseluruhan</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden">
                        <div className="h-full bg-foreground rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{completedCount} / {session.items.length} item selesai</p>
                </div>
            </div>

            {/* Module Items List */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight">Daftar Materi & Ujian</h2>

                {session.items.length === 0 ? (
                    <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                        Modul ini belum memiliki item materi atau ujian.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {session.items.map((item, idx) => (
                            <ModuleItemCard
                                key={item.module_item_id}
                                item={item}
                                index={idx + 1}
                                sessionId={session.id}
                                isSessionActive={isActive}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ModuleItemCard({
    item,
    index,
    sessionId,
    isSessionActive,
}: {
    item: ModuleItem;
    index: number;
    sessionId: string;
    isSessionActive: boolean;
}) {
    const isCompleted = item.progress_status === 'completed';
    const isLocked = item.progress_status === 'locked';
    const isExam = item.item_type === 'exam';
    const canAccess = isSessionActive && !isLocked;

    return (
        <div className={`glass-card p-5 flex items-center gap-4 ${canAccess ? 'glass-card-hover cursor-pointer' : ''} ${isLocked ? 'opacity-60' : ''} group transition-all`}>
            {/* Index / Status Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold transition-colors ${isCompleted
                ? 'bg-emerald-100 text-emerald-700'
                : isLocked ? 'bg-black/5 text-muted-foreground'
                    : 'bg-foreground text-background'
                }`}>
                {isCompleted ? <Tick01Icon size={18} /> : isLocked ? <LockIcon size={14} /> : index}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {isExam ? (
                        <Edit01Icon size={14} className="text-muted-foreground shrink-0" />
                    ) : (
                        <Book01Icon size={14} className="text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {isExam ? 'Ujian' : 'Materi'}
                    </span>
                </div>
                <h3 className="text-sm font-bold mt-0.5 truncate">{item.item_title || 'Untitled'}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {isExam && item.duration_minutes && (
                        <span className="flex items-center gap-1">
                            <Clock01Icon size={10} /> {item.duration_minutes} menit
                        </span>
                    )}
                    {isCompleted && item.score !== null && (
                        <span className="font-semibold text-emerald-600">
                            Nilai: {item.score}
                        </span>
                    )}
                </div>
            </div>

            {/* Action */}
            {canAccess && isExam && !isCompleted && (
                <Link
                    href={`/dashboard/sesi/${sessionId}/ujian/${item.item_id}`}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                    <PlayIcon size={12} />
                    Mulai Ujian
                </Link>
            )}
            {canAccess && !isExam && !isCompleted && (
                <Link
                    href={`/dashboard/sesi/${sessionId}/materi/${item.item_id}`}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                    <Book01Icon size={12} />
                    Buka Materi
                </Link>
            )}
            {isCompleted && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full shrink-0">
                    Selesai
                </span>
            )}
            {isLocked && (
                <span className="text-xs text-muted-foreground shrink-0">Terkunci</span>
            )}
        </div>
    );
}
