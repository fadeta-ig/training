'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    UserCircleIcon,
    Tick01Icon,
    Cancel01Icon,
    Book01Icon,
    Edit01Icon,
    AlertCircleIcon,
    Award01Icon,
    Clock01Icon
} from 'hugeicons-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';

type DetailData = {
    session: { id: string; title: string };
    participant: { id: string; username: string; full_name: string };
    progress: {
        total_items: number;
        completed_items: number;
        percentage: number;
        items: Array<{
            module_item_id: string;
            item_type: 'training' | 'exam';
            item_title: string;
            sequence_order: number;
            status: 'locked' | 'open' | 'completed';
            score: number | null;
            updated_at: string | null;
        }>;
    };
};

export default function ParticipantSessionDetailAdminPage({ params }: { params: Promise<{ id: string; participantId: string }> }) {
    const { id: sessionId, participantId } = use(params);
    const [data, setData] = useState<DetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/sessions/${sessionId}/participants/${participantId}`)
            .then((res) => res.json())
            .then((result) => {
                if (result.success) setData(result.data);
                else setError(result.error || 'Gagal memuat detail peserta');
            })
            .catch(() => setError('Kesalahan jaringan'))
            .finally(() => setLoading(false));
    }, [sessionId, participantId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                <Link href={`/admin/sessions/${sessionId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={14} /> Kembali ke Detail Sesi
                </Link>
                <div className="glass-card p-8 text-center">
                    <AlertCircleIcon size={36} className="mx-auto text-destructive mb-3" />
                    <p className="text-sm text-destructive font-semibold">{error || 'Detail tidak ditemukan'}</p>
                </div>
            </div>
        );
    }

    const { session, participant, progress } = data;
    const isCompleted = progress.percentage === 100;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <Link href={`/admin/sessions/${sessionId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                <ArrowLeft01Icon size={14} /> Kembali ke Sesi
            </Link>

            <PageHeader
                title="Detail Hasil Peserta"
                description={`Monitoring proges dan hasil dari peserta dalam sesi ${session.title}.`}
                icon={<UserCircleIcon size={28} />}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="p-6 md:col-span-2 flex items-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                        <UserCircleIcon size={32} className="text-muted-foreground" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">{participant.full_name}</h2>
                        <p className="text-sm text-muted-foreground">{participant.username}</p>
                    </div>
                </GlassCard>

                <GlassCard className={`p-6 flex flex-col items-center justify-center text-center ${isCompleted ? 'bg-emerald-50/50 border-emerald-100' : ''}`}>
                    <div className="w-12 h-12 relative flex items-center justify-center mb-2">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90 absolute inset-0">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="4" className={isCompleted ? 'text-emerald-100' : 'text-black/5'} />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" strokeWidth="4" strokeDasharray={`${progress.percentage}, 100`} strokeLinecap="round"
                                className={isCompleted ? 'text-emerald-500' : 'text-primary'}
                                style={{ transition: 'stroke-dasharray 1s ease' }} />
                        </svg>
                        <span className={`text-base font-bold ${isCompleted ? 'text-emerald-700' : 'text-foreground'}`}>
                            {progress.percentage}%
                        </span>
                    </div>
                    <p className={`text-xs font-semibold ${isCompleted ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {progress.completed_items} / {progress.total_items} Diselesaikan
                    </p>
                </GlassCard>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Daftar Materi & Ujian</h3>
                <div className="glass-card overflow-hidden">
                    <div className="divide-y divide-black/5">
                        {progress.items.map((item, idx) => {
                            const done = item.status === 'completed';
                            const isExam = item.item_type === 'exam';

                            return (
                                <div key={item.module_item_id} className="p-4 flex items-center gap-4 hover:bg-black/[0.02] transition-colors">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-black/5 text-muted-foreground'}`}>
                                        {done ? <Tick01Icon size={16} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            {isExam ? <Edit01Icon size={12} className="text-muted-foreground" /> : <Book01Icon size={12} className="text-muted-foreground" />}
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                {isExam ? 'Ujian' : 'Materi'}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-semibold truncate text-foreground">{item.item_title || 'Untitled'}</h4>
                                        {item.updated_at && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                                <Clock01Icon size={10} /> Diselesaikan: {new Date(item.updated_at).toLocaleString('id-ID')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="shrink-0 flex items-center gap-4">
                                        {isExam && done && item.score !== null ? (
                                            <div className="text-right">
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Nilai</p>
                                                <span className="inline-flex px-2.5 py-1 rounded-md bg-primary/10 text-primary text-sm font-bold">
                                                    {item.score}
                                                </span>
                                            </div>
                                        ) : !done ? (
                                            <span className="text-xs font-bold text-muted-foreground px-2">Belum</span>
                                        ) : null}

                                        {done && !isExam && (
                                            <span className="text-xs font-bold text-emerald-600 px-2">Diselesaikan</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
