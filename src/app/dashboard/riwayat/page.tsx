'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Calendar02Icon,
    Time02Icon,
    CheckmarkCircle02Icon,
    ArrowRight01Icon,
    BookOpen01Icon,
    Search01Icon,
    Clock01Icon,
    Task01Icon
} from 'hugeicons-react';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';

type HistoryItem = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    module_title: string;
    total_items: number;
    completed_items: number;
    participant_name?: string;
};

type FilterType = 'all' | 'completed' | 'ended';

export default function RiwayatPage() {
    const [sessions, setSessions] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');

    useEffect(() => {
        fetch('/api/participant/sessions')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    const now = new Date();
                    // Show sessions that are either ended OR 100% completed
                    const finished = data.data.filter(
                        (s: HistoryItem) =>
                            new Date(s.end_time) < now ||
                            (s.total_items > 0 && s.completed_items >= s.total_items)
                    );
                    setSessions(finished);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    // Metrics summary
    const metrics = useMemo(() => {
        let completed = 0;
        let ended = 0;

        sessions.forEach((s) => {
            const progress =
                s.total_items > 0 ? Math.round((s.completed_items / s.total_items) * 100) : 0;
            if (progress === 100 && s.total_items > 0) completed++;
            else ended++;
        });

        return { total: sessions.length, completed, ended };
    }, [sessions]);

    // Filtered list
    const filteredSessions = useMemo(() => {
        return sessions.filter((s) => {
            const matchesSearch =
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.module_title?.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            const progress =
                s.total_items > 0 ? Math.round((s.completed_items / s.total_items) * 100) : 0;
            const isCompleted = progress === 100 && s.total_items > 0;

            if (filterType === 'completed') return isCompleted;
            if (filterType === 'ended') return !isCompleted;
            return true;
        });
    }, [sessions, searchQuery, filterType]);

    const {
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        paginatedItems: paginatedSessions,
        setPage,
        setPageSize,
    } = usePagination({ items: filteredSessions, initialPageSize: 10 });

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20 text-xs font-medium text-muted-foreground animate-pulse">
                Memuat riwayat sesi...
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-16">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2.5">
                        <Clock01Icon className="text-slate-700" size={24} />
                        Riwayat Sesi & Ujian
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Daftar seluruh sesi pelatihan dan ujian yang telah Anda selesaikan atau telah berakhir.
                    </p>
                </div>

                <Link
                    href="/dashboard/sesi"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-all shadow-2xs shrink-0 active:scale-98"
                >
                    <BookOpen01Icon size={15} />
                    Sesi Aktif
                </Link>
            </div>

            {/* Metrics Summary Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl border border-black/5 p-4 flex items-center justify-between shadow-2xs">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Total Riwayat</p>
                        <p className="text-xl font-semibold text-foreground mt-0.5">{metrics.total}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <Clock01Icon size={18} />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-black/5 p-4 flex items-center justify-between shadow-2xs">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Selesai 100%</p>
                        <p className="text-xl font-semibold text-emerald-600 mt-0.5">{metrics.completed}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckmarkCircle02Icon size={18} />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-black/5 p-4 flex items-center justify-between shadow-2xs">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Sesi Berakhir</p>
                        <p className="text-xl font-semibold text-slate-500 mt-0.5">{metrics.ended}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <Calendar02Icon size={18} />
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="bg-white rounded-xl border border-black/5 p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-lg text-xs font-medium">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-3 py-1.5 rounded-md transition-all ${
                            filterType === 'all'
                                ? 'bg-white text-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Semua ({metrics.total})
                    </button>
                    <button
                        onClick={() => setFilterType('completed')}
                        className={`px-3 py-1.5 rounded-md transition-all ${
                            filterType === 'completed'
                                ? 'bg-white text-emerald-700 shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Selesai ({metrics.completed})
                    </button>
                    <button
                        onClick={() => setFilterType('ended')}
                        className={`px-3 py-1.5 rounded-md transition-all ${
                            filterType === 'ended'
                                ? 'bg-white text-slate-700 shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Berakhir ({metrics.ended})
                    </button>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search01Icon
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                        type="text"
                        placeholder="Cari riwayat..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition-all"
                    />
                </div>
            </div>

            {/* Sessions History List */}
            {filteredSessions.length === 0 ? (
                <div className="bg-white rounded-xl border border-black/5 p-12 text-center space-y-3 shadow-2xs">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                        <Task01Icon size={24} />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Belum Ada Riwayat</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {searchQuery || filterType !== 'all'
                            ? 'Tidak ada riwayat sesi yang sesuai dengan filter pencarian.'
                            : 'Riwayat akan otomatis muncul setelah Anda menyelesaikan sesi atau jadwal sesi telah berakhir.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-3">
                        {paginatedSessions.map((s) => {
                            const progress =
                                s.total_items > 0
                                    ? Math.round((s.completed_items / s.total_items) * 100)
                                    : 0;
                            const allDone = progress === 100 && s.total_items > 0;

                            return (
                                <div
                                    key={s.id}
                                    className="bg-white rounded-xl border border-black/5 p-4 sm:p-5 shadow-2xs hover:border-black/10 hover:shadow-xs transition-all group"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        {/* Left Info Section */}
                                        <div className="flex items-start gap-3.5 min-w-0">
                                            <div
                                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                                    allDone
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                                                        : 'bg-slate-100 text-slate-500 border border-slate-200/50'
                                                }`}
                                            >
                                                {allDone ? (
                                                    <CheckmarkCircle02Icon size={18} />
                                                ) : (
                                                    <Time02Icon size={18} />
                                                )}
                                            </div>

                                            <div className="min-w-0 space-y-1">
                                                <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-slate-900 transition-colors">
                                                    {s.title}
                                                </h3>

                                                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                                                        {s.module_title}
                                                    </span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="flex items-center gap-1 text-[11px]">
                                                        <Calendar02Icon size={12} className="text-slate-400" />
                                                        {formatDate(s.start_time)} – {formatDate(s.end_time)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Progress & Action Section */}
                                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 border-black/5 pt-3 sm:pt-0">
                                            {/* Progress Bar & Status */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 sm:w-32 hidden sm:block">
                                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                allDone ? 'bg-emerald-500' : 'bg-slate-700'
                                                            }`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {allDone ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-medium">
                                                        100% Selesai
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/50 text-[11px] font-medium">
                                                        {progress}% • Berakhir
                                                    </span>
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            <Link
                                                href={`/dashboard/sesi/${s.id}`}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/70 text-slate-800 text-xs font-medium rounded-lg transition-colors shrink-0"
                                            >
                                                Buka Sesi
                                                <ArrowRight01Icon
                                                    size={14}
                                                    className="group-hover:translate-x-0.5 transition-transform"
                                                />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            )}
        </div>
    );
}
