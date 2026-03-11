'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Clock01Icon,
    Tick01Icon,
    Cancel01Icon,
    ArrowLeft01Icon,
    BookOpen01Icon,
} from 'hugeicons-react';

type HistoryItem = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    module_title: string;
    total_items: number;
    completed_items: number;
};

export default function RiwayatPage() {
    const [sessions, setSessions] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/participant/sessions')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    // Filter only ended sessions
                    const now = new Date();
                    const ended = data.data.filter((s: HistoryItem) => new Date(s.end_time) < now);
                    setSessions(ended);
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">Riwayat Ujian</h1>
                <p className="text-muted-foreground mt-2 text-sm lg:text-base">
                    Daftar sesi pelatihan dan ujian yang telah selesai.
                </p>
            </div>

            {sessions.length === 0 ? (
                <div className="glass-card p-10 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                        <BookOpen01Icon size={32} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground font-medium">Belum ada riwayat ujian.</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Riwayat akan muncul setelah sesi yang Anda ikuti berakhir.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map((s) => {
                        const progress = s.total_items > 0
                            ? Math.round((s.completed_items / s.total_items) * 100)
                            : 0;
                        const allDone = s.completed_items === s.total_items && s.total_items > 0;

                        return (
                            <Link
                                key={s.id}
                                href={`/dashboard/sesi/${s.id}`}
                                className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 glass-card-hover group"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {allDone ? <Tick01Icon size={18} /> : <Cancel01Icon size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold truncate">{s.title}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                        <span>{s.module_title}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock01Icon size={10} />
                                            {new Date(s.end_time).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                        <p className="text-xs font-semibold">{progress}% selesai</p>
                                        <p className="text-[10px] text-muted-foreground">{s.completed_items}/{s.total_items} item</p>
                                    </div>
                                    <ArrowLeft01Icon size={16} className="rotate-180 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
