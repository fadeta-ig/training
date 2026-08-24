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
    graduation_status?: 'pending' | 'passed' | 'failed';
    graduation_decided_at?: string | null;
    graduation_notes?: string | null;
    skl_number?: string | null;
    certificate_file_url?: string | null;
    certificate_number?: string | null;
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
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Riwayat Sesi Pelatihan</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Memuat riwayat sesi pelatihan dan ujian Anda...
                    </p>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-foreground">Riwayat Sesi Pelatihan</h1>
                <p className="text-xs text-muted-foreground mt-1">
                    Arsip lengkap sesi pelatihan, status kelulusan resmi, SKL, dan sertifikat yang telah selesai Anda ikuti.
                </p>
            </div>

            {/* Metrics Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-black/5 p-4 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-medium">Total Riwayat Sesi</span>
                        <BookOpen01Icon size={16} />
                    </div>
                    <p className="text-2xl font-bold text-foreground font-mono">{metrics.total}</p>
                </div>
                <div className="bg-white rounded-xl border border-black/5 p-4 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-medium">Selesai 100%</span>
                        <CheckmarkCircle02Icon size={16} className="text-emerald-600" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 font-mono">{metrics.completed}</p>
                </div>
                <div className="bg-white rounded-xl border border-black/5 p-4 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-medium">Sesi Berakhir</span>
                        <Clock01Icon size={16} className="text-slate-500" />
                    </div>
                    <p className="text-2xl font-bold text-slate-700 font-mono">{metrics.ended}</p>
                </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-lg w-fit">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            filterType === 'all'
                                ? 'bg-white text-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Semua ({metrics.total})
                    </button>
                    <button
                        onClick={() => setFilterType('completed')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            filterType === 'completed'
                                ? 'bg-white text-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Selesai ({metrics.completed})
                    </button>
                    <button
                        onClick={() => setFilterType('ended')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            filterType === 'ended'
                                ? 'bg-white text-foreground shadow-2xs'
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
                            const isPassed = s.graduation_status === 'passed';
                            const isFailed = s.graduation_status === 'failed';

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
                                                    isPassed
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                                                        : allDone
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                                                        : 'bg-slate-100 text-slate-500 border border-slate-200/50'
                                                }`}
                                            >
                                                {allDone || isPassed ? (
                                                    <CheckmarkCircle02Icon size={18} />
                                                ) : (
                                                    <Time02Icon size={18} />
                                                )}
                                            </div>

                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-slate-900 transition-colors">
                                                        {s.title}
                                                    </h3>
                                                    {isPassed && (
                                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                            ✓ LULUS
                                                        </span>
                                                    )}
                                                    {isFailed && (
                                                        <span className="bg-red-50 text-red-700 border border-red-200/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                            TIDAK LULUS
                                                        </span>
                                                    )}
                                                </div>

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
                                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 border-black/5 pt-3 sm:pt-0 flex-wrap">
                                            {/* SKL direct download */}
                                            {isPassed && (
                                                <a
                                                    href={`/api/participant/sessions/${s.id}/skl`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors"
                                                    title="Unduh Surat Keterangan Lulus (SKL)"
                                                >
                                                    Unduh SKL
                                                </a>
                                            )}

                                            {/* Official certificate if available */}
                                            {isPassed && s.certificate_file_url && (
                                                <a
                                                    href={s.certificate_file_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
                                                    title="Unduh Sertifikat Resmi"
                                                >
                                                    Sertifikat Resmi
                                                </a>
                                            )}

                                            {/* Action Button */}
                                            <Link
                                                href={`/dashboard/sesi/${s.id}`}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/70 text-slate-800 text-xs font-medium rounded-lg transition-colors shrink-0 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
                                            >
                                                Lihat Detail
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
