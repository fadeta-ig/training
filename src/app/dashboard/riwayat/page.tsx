'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Clock01Icon,
    Tick01Icon,
    Cancel01Icon,
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar01Icon,
    Award01Icon,
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
                    const now = new Date();
                    // Show sessions that are either ended OR 100% completed
                    const finished = data.data.filter((s: HistoryItem) =>
                        new Date(s.end_time) < now ||
                        (s.total_items > 0 && s.completed_items >= s.total_items)
                    );
                    setSessions(finished);
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Riwayat</h1>
                <p className="text-muted-foreground text-sm mt-1">Sesi yang telah selesai atau berakhir.</p>
            </div>

            {sessions.length === 0 ? (
                <div className="glass-card p-12 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center mb-4">
                        <BookOpen01Icon size={28} className="text-muted-foreground/40" />
                    </div>
                    <p className="font-semibold text-muted-foreground text-sm">Belum ada riwayat</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Riwayat muncul setelah sesi berakhir atau Anda menyelesaikan semua item.</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {sessions.map((s) => {
                        const progress = s.total_items > 0
                            ? Math.round((s.completed_items / s.total_items) * 100)
                            : 0;
                        const allDone = progress === 100 && s.total_items > 0;

                        return (
                            <Link
                                key={s.id}
                                href={`/dashboard/sesi/${s.id}`}
                                className="glass-card px-4 py-3 flex items-center gap-3 glass-card-hover group"
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${allDone ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {allDone ? <Award01Icon size={14} /> : <Cancel01Icon size={12} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold truncate">{s.title}</h3>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                        <span>{s.module_title}</span>
                                        <span className="opacity-30">·</span>
                                        <span className="flex items-center gap-1">
                                            <Calendar01Icon size={10} />
                                            {new Date(s.end_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${allDone ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {progress}%
                                    </span>
                                    <ArrowRight01Icon size={14} className="text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
