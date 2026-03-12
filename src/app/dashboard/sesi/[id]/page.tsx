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
    Award01Icon,
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
    const [isSEB, setIsSEB] = useState(false);

    useEffect(() => {
        setIsSEB(navigator.userAgent.includes('SafeExamBrowser'));
        fetch(`/api/participant/sessions/${id}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setSession(data.data);
                else setError(data.error || 'Gagal memuat sesi');
            })
            .catch(() => setError('Kesalahan jaringan'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={14} /> Kembali
                </Link>
                <div className="glass-card p-8 text-center">
                    <AlertCircleIcon size={36} className="mx-auto text-destructive mb-3" />
                    <p className="text-sm text-destructive font-semibold">{error || 'Sesi tidak ditemukan'}</p>
                </div>
            </div>
        );
    }

    const now = new Date();
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    const completedCount = session.items.filter((i) => i.progress_status === 'completed').length;
    const totalItems = session.items.length;
    const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

    // Auto-complete: 100% = Selesai regardless of time
    const isFullyCompleted = progress === 100 && totalItems > 0;
    const isActive = !isFullyCompleted && now >= start && now <= end;

    const statusLabel = isFullyCompleted ? 'Selesai' : isActive ? 'Berlangsung' : now < start ? 'Akan Datang' : 'Berakhir';
    const statusColor = isFullyCompleted ? 'bg-emerald-500' : isActive ? 'bg-emerald-500 animate-pulse' : now < start ? 'bg-blue-400' : 'bg-gray-300';

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-12">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                <ArrowLeft01Icon size={14} /> Kembali
            </Link>

            {/* Compact Header */}
            <div className="glass-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{statusLabel}</span>
                        </div>
                        <h1 className="text-lg font-bold tracking-tight truncate">{session.title}</h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                            {session.module_title && <span>{session.module_title}</span>}
                            <span className="flex items-center gap-1">
                                <Clock01Icon size={10} />
                                {start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                {' — '}
                                {end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    {/* Progress Circle */}
                    <div className="shrink-0 w-14 h-14 relative">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="3" className="text-black/5" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" strokeWidth="3" strokeDasharray={`${progress}, 100`} strokeLinecap="round"
                                className={progress === 100 ? 'text-emerald-500' : 'text-foreground'}
                                style={{ transition: 'stroke-dasharray 1s ease' }} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{progress}%</span>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-black/5">
                    <span>{completedCount}/{totalItems} item selesai</span>
                    {isFullyCompleted && (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold">
                            <Award01Icon size={12} /> Semua selesai!
                        </span>
                    )}
                </div>
            </div>

            {/* 100% Completed Banner */}
            {isFullyCompleted && (
                <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Award01Icon size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-emerald-800">Sesi Selesai!</p>
                        <p className="text-xs text-emerald-600">Anda telah menyelesaikan semua materi dan ujian dalam sesi ini.</p>
                    </div>
                </div>
            )}

            {/* Module Items */}
            <div>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Daftar Materi & Ujian</h2>

                {session.items.length === 0 ? (
                    <div className="glass-card p-6 text-center text-xs text-muted-foreground">
                        Modul ini belum memiliki item.
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {session.items.map((item, idx) => (
                            <ItemRow
                                key={item.module_item_id}
                                item={item}
                                index={idx + 1}
                                sessionId={session.id}
                                isSessionActive={isActive}
                                requireSeb={session.require_seb}
                                isSeb={isSEB}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ItemRow({ item, index, sessionId, isSessionActive, requireSeb, isSeb }: {
    item: ModuleItem; index: number; sessionId: string; isSessionActive: boolean; requireSeb: boolean; isSeb: boolean;
}) {
    const isCompleted = item.progress_status === 'completed';
    const isLocked = item.progress_status === 'locked';
    const isExam = item.item_type === 'exam';
    const requireSebForThisItem = isExam && requireSeb;
    const sebLocked = requireSebForThisItem && !isSeb;

    const canAccess = isSessionActive && !isLocked && !sebLocked;

    const href = isExam
        ? `/dashboard/sesi/${sessionId}/ujian/${item.item_id}`
        : `/dashboard/sesi/${sessionId}/materi/${item.item_id}`;

    const inner = (
        <div className={`glass-card px-4 py-3 flex flex-col gap-2 transition-all ${canAccess ? 'glass-card-hover group cursor-pointer' : ''} ${(isLocked || sebLocked) ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-3">
                {/* Step indicator */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold ${isCompleted
                    ? 'bg-emerald-100 text-emerald-600'
                    : canAccess ? 'bg-foreground text-background'
                        : 'bg-black/5 text-muted-foreground'
                    }`}>
                    {isCompleted ? <Tick01Icon size={14} /> : (isLocked || sebLocked) ? <LockIcon size={10} /> : index}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        {isExam ? <Edit01Icon size={11} className="text-muted-foreground shrink-0" />
                            : <Book01Icon size={11} className="text-muted-foreground shrink-0" />}
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            {isExam ? 'Ujian' : 'Materi'}
                        </span>
                    </div>
                    <h3 className="text-sm font-semibold truncate leading-tight">{item.item_title || 'Untitled'}</h3>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 shrink-0">
                    {isExam && item.duration_minutes && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock01Icon size={9} /> {item.duration_minutes}m
                        </span>
                    )}
                    {isCompleted && item.score !== null && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {item.score}
                        </span>
                    )}
                    {isCompleted && (
                        <Tick01Icon size={14} className="text-emerald-500" />
                    )}
                    {canAccess && (
                        <div className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center">
                            <PlayIcon size={10} />
                        </div>
                    )}
                </div>
            </div>

            {/* SEB Warning */}
            {sebLocked && !isCompleted && (
                <div className="flex items-center gap-1.5 text-[10px] text-destructive bg-destructive/10 px-2.5 py-1.5 rounded-md mt-1 w-fit">
                    <AlertCircleIcon size={12} />
                    <span>Ujian ini hanya dapat diakses melalui Safe Exam Browser (SEB).</span>
                </div>
            )}
        </div>
    );

    if (canAccess) {
        return <Link href={href}>{inner}</Link>;
    }

    return inner;
}
