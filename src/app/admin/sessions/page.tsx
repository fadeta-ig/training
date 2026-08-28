'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Calendar02Icon,
    Time02Icon,
    SecurityLockIcon,
    PencilEdit01Icon,
    Delete02Icon,
    ViewIcon,
    ViewOffIcon,
    Camera01Icon,
    Search01Icon,
    Add01Icon,
    UserMultipleIcon,
    CheckmarkCircle02Icon,
    Clock01Icon
} from 'hugeicons-react';
import { useConfirm } from '@/hooks/useConfirm';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from 'sonner';

type Session = {
    id: string;
    module_id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    show_score: boolean;
    enable_proctoring: boolean;
    created_at: string;
};

type StatusFilter = 'all' | 'active' | 'upcoming' | 'ended';

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sessions');
            const data = await res.json();
            if (data.success) {
                setSessions(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setUserRole(data.data.role);
                }
            })
            .catch(() => {});
    }, []);

    const handleDelete = async (id: string, title: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Sesi?',
            message: `Apakah Anda yakin ingin menghapus sesi "${title}"? Data peserta terdaftar akan ikut terhapus.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus Sesi',
            cancelLabel: 'Batal',
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Sesi berhasil dihapus');
                setSessions((prev) => prev.filter((s) => s.id !== id));
            } else {
                toast.error('Gagal menghapus sesi');
            }
        } catch {
            toast.error('Terjadi kesalahan saat menghapus sesi');
        }
    };

    const getSessionState = (start: string, end: string): 'upcoming' | 'active' | 'ended' => {
        const now = new Date();
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (now < startDate) return 'upcoming';
        if (now >= startDate && now <= endDate) return 'active';
        return 'ended';
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Calculate metrics
    const metrics = useMemo(() => {
        let active = 0;
        let upcoming = 0;
        let ended = 0;

        sessions.forEach((s) => {
            const state = getSessionState(s.start_time, s.end_time);
            if (state === 'active') active++;
            else if (state === 'upcoming') upcoming++;
            else ended++;
        });

        return { total: sessions.length, active, upcoming, ended };
    }, [sessions]);

    // Filter sessions
    const filteredSessions = useMemo(() => {
        return sessions.filter((s) => {
            const matchesSearch =
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.id.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (statusFilter === 'all') return true;
            const state = getSessionState(s.start_time, s.end_time);
            return state === statusFilter;
        });
    }, [sessions, searchQuery, statusFilter]);

    const {
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        paginatedItems: paginatedSessions,
        setPage,
        setPageSize,
    } = usePagination({ items: filteredSessions, initialPageSize: 10 });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <ConfirmComponent />

            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2.5">
                        <Calendar02Icon className="text-slate-700" size={24} />
                        Sesi Ujian & Kelas
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-normal">
                        Kelola jadwal ujian, pengaturan keamanan, dan alokasi peserta.
                    </p>
                </div>

                {userRole === 'admin' && (
                    <Link
                        href="/admin/sessions/create"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow-sm border border-blue-700/30 active:scale-95 transition-all cursor-pointer"
                    >
                        <Add01Icon size={17} />
                        <span>Buat Sesi Baru</span>
                    </Link>
                )}
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl border border-black/5 p-4 flex items-center justify-between shadow-2xs">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Total Sesi</p>
                        <p className="text-xl font-semibold text-foreground mt-0.5">{metrics.total}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <Calendar02Icon size={18} />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-black/5 p-4 flex items-center justify-between shadow-2xs">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Berlangsung</p>
                        <p className="text-xl font-semibold text-emerald-600 mt-0.5">{metrics.active}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckmarkCircle02Icon size={18} />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-black/5 p-4 flex items-center justify-between shadow-2xs">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Akan Datang</p>
                        <p className="text-xl font-semibold text-amber-600 mt-0.5">{metrics.upcoming}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                        <Clock01Icon size={18} />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-black/5 p-4 flex items-center justify-between shadow-2xs">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Selesai</p>
                        <p className="text-xl font-semibold text-slate-500 mt-0.5">{metrics.ended}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <Time02Icon size={18} />
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-xl border border-black/5 p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
                {/* Status Tabs */}
                <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-lg overflow-x-auto text-xs font-medium">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-md transition-all ${
                            statusFilter === 'all'
                                ? 'bg-white text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Semua ({metrics.total})
                    </button>
                    <button
                        onClick={() => setStatusFilter('active')}
                        className={`px-3 py-1.5 rounded-md transition-all ${
                            statusFilter === 'active'
                                ? 'bg-white text-emerald-700 shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Berlangsung ({metrics.active})
                    </button>
                    <button
                        onClick={() => setStatusFilter('upcoming')}
                        className={`px-3 py-1.5 rounded-md transition-all ${
                            statusFilter === 'upcoming'
                                ? 'bg-white text-amber-700 shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Akan Datang ({metrics.upcoming})
                    </button>
                    <button
                        onClick={() => setStatusFilter('ended')}
                        className={`px-3 py-1.5 rounded-md transition-all ${
                            statusFilter === 'ended'
                                ? 'bg-white text-slate-700 shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Selesai ({metrics.ended})
                    </button>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                    <Search01Icon
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                        type="text"
                        placeholder="Cari sesi ujian..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition-all"
                    />
                </div>
            </div>

            {/* Main Table Container */}
            <div className="bg-white rounded-xl border border-black/5 shadow-2xs overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-xs text-muted-foreground font-medium animate-pulse">
                        Memuat data sesi...
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                            <Calendar02Icon size={24} />
                        </div>
                        <h3 className="text-sm font-medium text-foreground">Tidak Ada Sesi Ditemukan</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            {searchQuery || statusFilter !== 'all'
                                ? 'Tidak ada sesi yang sesuai dengan kriteria pencarian/filter Anda.'
                                : 'Belum ada sesi yang dibuat. Silakan buat sesi baru untuk memulai.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 border-b border-black/5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Judul Sesi</th>
                                    <th className="px-5 py-3.5">Jadwal Pelaksanaan</th>
                                    <th className="px-5 py-3.5">Keamanan & Fitur</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {paginatedSessions.map((session) => {
                                    const state = getSessionState(session.start_time, session.end_time);

                                    return (
                                        <tr
                                            key={session.id}
                                            className="hover:bg-slate-50/60 transition-colors group"
                                        >
                                            {/* Judul Sesi */}
                                            <td className="px-5 py-4 align-middle">
                                                <Link
                                                    href={`/admin/sessions/${session.id}`}
                                                    className="font-medium text-sm text-foreground hover:text-slate-700 transition-colors block line-clamp-1"
                                                >
                                                    {session.title}
                                                </Link>
                                                <span className="font-mono text-[10px] text-muted-foreground mt-0.5 block">
                                                    ID: {session.id.slice(0, 13)}...
                                                </span>
                                            </td>

                                            {/* Jadwal Pelaksanaan */}
                                            <td className="px-5 py-4 align-middle">
                                                <div className="flex items-start gap-1.5 text-muted-foreground">
                                                    <Time02Icon size={14} className="mt-0.5 shrink-0 text-slate-400" />
                                                    <div className="text-xs leading-relaxed">
                                                        <span className="font-medium text-foreground">
                                                            {formatDate(session.start_time)}
                                                        </span>
                                                        <br />
                                                        <span className="text-muted-foreground">
                                                            s/d {formatDate(session.end_time)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Pengamanan */}
                                            <td className="px-5 py-4 align-middle">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {session.require_seb ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900 text-white">
                                                            <SecurityLockIcon size={11} />
                                                            SEB
                                                        </span>
                                                    ) : null}

                                                    {session.enable_proctoring ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                                            <Camera01Icon size={11} />
                                                            Kamera
                                                        </span>
                                                    ) : null}

                                                    {!session.show_score ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                                                            <ViewOffIcon size={11} />
                                                            Nilai Sembunyi
                                                        </span>
                                                    ) : null}

                                                    {!session.require_seb && !session.enable_proctoring && session.show_score ? (
                                                        <span className="text-muted-foreground text-xs font-normal">
                                                            Standar
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>

                                            {/* Status Sesi */}
                                            <td className="px-5 py-4 align-middle">
                                                {state === 'active' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Berlangsung
                                                    </span>
                                                ) : state === 'upcoming' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                        Akan Datang
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/50">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        Selesai
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action Buttons */}
                                            <td className="px-5 py-4 align-middle text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link
                                                        href={`/admin/sessions/${session.id}`}
                                                        className="p-2 rounded-xl text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 shadow-2xs transition-all active:scale-95 cursor-pointer"
                                                        title="Detail Sesi"
                                                    >
                                                        <ViewIcon size={16} />
                                                    </Link>

                                                    {userRole === 'admin' && (
                                                        <>
                                                            <Link
                                                                href={`/admin/sessions/${session.id}/edit`}
                                                                className="p-2 rounded-xl text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 shadow-2xs transition-all active:scale-95 cursor-pointer"
                                                                title="Edit Sesi"
                                                            >
                                                                <PencilEdit01Icon size={16} />
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(session.id, session.title)}
                                                                className="p-2 rounded-xl text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
                                                                title="Hapus Sesi"
                                                            >
                                                                <Delete02Icon size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
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
    );
}
