'use client';

import { useState, useEffect } from 'react';
import { CrownIcon, Medal01Icon, UserCircleIcon, Target01Icon, BookOpen01Icon } from 'hugeicons-react';
import Link from 'next/link';

type PlayerRank = {
    rank: number;
    user_id: string;
    full_name: string;
    username: string;
    institution: string;
    training_points: number;
    exam_points: number;
    total_points: number;
};

export default function LeaderboardPage() {
    const [players, setPlayers] = useState<PlayerRank[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/participant/leaderboard')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setPlayers(data.data);
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    const getRankStyle = (rank: number) => {
        if (rank === 1) return { bg: 'bg-amber-100/80 border-amber-300 shadow-amber-200/50', text: 'text-amber-700', icon: 'text-amber-500' };
        if (rank === 2) return { bg: 'bg-slate-100/80 border-slate-300 shadow-slate-200/50', text: 'text-slate-700', icon: 'text-slate-500' };
        if (rank === 3) return { bg: 'bg-orange-100/80 border-orange-300 shadow-orange-200/50', text: 'text-orange-800', icon: 'text-orange-600' };
        return { bg: 'bg-white/50 border-black/5 hover:bg-white', text: 'text-muted-foreground', icon: 'text-muted-foreground' };
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-3 mb-10 pt-4">
                <div className="mx-auto w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center rotate-12 shadow-sm border border-amber-100">
                    <CrownIcon size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Leaderboard Klasemen</h1>
                    <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
                        Peringkat dihitung berdasarkan akumulasi nilai kelulusan materi dan <i>high score</i> Ujian Anda.
                    </p>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {players.length === 0 ? (
                    <div className="glass-card p-12 text-center text-muted-foreground flex flex-col items-center">
                        <CrownIcon size={32} className="opacity-20 mb-3" />
                        <p className="font-semibold">Belum Ada Data Klasemen</p>
                        <p className="text-xs mt-1">Selesaikan materi atau ujian untuk meraih poin pertama Anda!</p>
                    </div>
                ) : (
                    players.map((player) => {
                        const style = getRankStyle(player.rank);
                        const isTop3 = player.rank <= 3;
                        return (
                            <div
                                key={player.user_id}
                                className={`p-4 md:p-5 rounded-2xl border transition-all flex items-center gap-4 md:gap-6 shadow-sm ${style.bg}`}
                            >
                                {/* Rank Badge */}
                                <div className="w-12 flex flex-col items-center justify-center shrink-0">
                                    {isTop3 ? (
                                        <div className={`relative flex items-center justify-center drop-shadow-sm ${style.icon}`}>
                                            <Medal01Icon size={32} />
                                            <span className="absolute text-[10px] font-bold text-white mt-1.5">{player.rank}</span>
                                        </div>
                                    ) : (
                                        <span className={`text-lg font-bold font-mono ${style.text}`}>#{player.rank}</span>
                                    )}
                                </div>

                                {/* Avatar */}
                                <div className={`hidden sm:flex w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-lg font-bold border-2 ${isTop3 ? 'bg-white border-transparent' : 'bg-black/5 border-white text-muted-foreground'}`}>
                                    {isTop3 ? (
                                        <span className={style.text}>{player.full_name.charAt(0).toUpperCase()}</span>
                                    ) : (
                                        <UserCircleIcon size={24} />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-base font-bold truncate ${isTop3 ? 'text-foreground' : ''}`}>{player.full_name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5 whitespace-nowrap overflow-x-auto no-scrollbar">
                                        <span className="text-xs text-muted-foreground font-medium shrink-0">{player.institution}</span>
                                        <span className="w-1 h-1 rounded-full bg-black/10 shrink-0"></span>
                                        <span className="text-[10px] text-muted-foreground shrink-0">{player.username}</span>
                                    </div>
                                </div>

                                {/* Points breakdown */}
                                <div className="hidden md:flex items-center gap-6 px-4 py-2 rounded-xl bg-white/40 border border-white shrink-0">
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-muted-foreground mb-0.5">
                                            <BookOpen01Icon size={12} /> Materi
                                        </div>
                                        <span className="text-sm font-semibold">{player.training_points.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="w-px h-6 bg-black/10"></div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-muted-foreground mb-0.5">
                                            <Target01Icon size={12} /> Ujian
                                        </div>
                                        <span className="text-sm font-semibold">{player.exam_points.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>

                                {/* Total Score */}
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Total Poin</p>
                                    <h3 className={`text-xl md:text-2xl font-extrabold font-mono ${isTop3 ? style.text : 'text-foreground'}`}>
                                        {player.total_points.toLocaleString('id-ID')}
                                    </h3>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="text-center pt-4">
                <Link href="/dashboard" className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline transition-colors">
                    &larr; Kembali ke Dashboard
                </Link>
            </div>
        </div>
    );
}
