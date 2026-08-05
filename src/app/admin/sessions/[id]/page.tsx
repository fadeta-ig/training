'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    Time02Icon,
    SecurityLockIcon,
    Calendar02Icon,
    UserMultipleIcon,
    Logout01Icon,
    Download01Icon,
    MailSend01Icon,
    ViewIcon,
    ViewOffIcon,
    Camera01Icon,
    PencilEdit01Icon,
    Search01Icon,
    CheckmarkCircle02Icon,
    FoldersIcon
} from 'hugeicons-react';
import { toast } from 'sonner';

type User = {
    id: string;
    username: string;
    full_name: string;
    completed_items: number;
    total_items: number;
    progress: number;
};

type SessionDetail = {
    id: string;
    module_id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    show_score: boolean;
    enable_proctoring: boolean;
    seb_config_key: string | null;
    created_at: string;
    participants: User[];
};

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSeb, setIsSeb] = useState(false);
    const [isSendingBlast, setIsSendingBlast] = useState(false);
    const [showBlastConfirm, setShowBlastConfirm] = useState(false);
    const [userRole, setUserRole] = useState<string>('');
    const [searchParticipant, setSearchParticipant] = useState('');

    useEffect(() => {
        setIsSeb(typeof navigator !== 'undefined' && navigator.userAgent.includes('SafeExamBrowser'));
    }, []);

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await fetch(`/api/sessions/${resolvedParams.id}`);
                const data = await res.json();
                if (data.success) {
                    setSession(data.data);
                } else {
                    setError('Terjadi kesalahan saat memuat data sesi.');
                }
            } catch {
                setError('Masalah koneksi jaringan.');
            } finally {
                setLoading(false);
            }
        };

        const fetchRole = async () => {
            try {
                const res = await fetch('/api/auth/me');
                const data = await res.json();
                if (data.success) {
                    setUserRole(data.data.role);
                }
            } catch {}
        };

        fetchSession();
        fetchRole();
    }, [resolvedParams.id]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleBlastEmail = async () => {
        setShowBlastConfirm(false);
        setIsSendingBlast(true);
        try {
            const res = await fetch(`/api/admin/sessions/${session?.id}/remind`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success('Broadcast Terkirim!', { description: data.message });
            } else {
                toast.error('Gagal Broadcast', { description: data.error });
            }
        } catch (err: any) {
            toast.error('Galat Eksekusi', { description: err.message });
        } finally {
            setIsSendingBlast(false);
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

    const filteredParticipants = useMemo(() => {
        if (!session?.participants) return [];
        return session.participants.filter(
            (p) =>
                p.full_name.toLowerCase().includes(searchParticipant.toLowerCase()) ||
                p.username.toLowerCase().includes(searchParticipant.toLowerCase())
        );
    }, [session?.participants, searchParticipant]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20 text-xs text-muted-foreground font-medium animate-pulse">
                Memuat detail sesi...
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center justify-center border border-red-200/60 max-w-2xl mx-auto mt-12 text-sm font-medium">
                {error || 'Sesi tidak ditemukan'}
            </div>
        );
    }

    const state = getSessionState(session.start_time, session.end_time);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Navigation & SEB Badge */}
            <div className="flex items-center justify-between gap-4">
                <Link
                    href="/admin/sessions"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                    <ArrowLeft01Icon size={15} />
                    Kembali ke Daftar Sesi
                </Link>

                {isSeb && (
                    <Link
                        href="/quit-seb"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 px-3 py-1 rounded-lg border border-red-200/60 transition-all active:scale-98"
                    >
                        <Logout01Icon size={14} />
                        Keluar SEB
                    </Link>
                )}
            </div>

            {/* Header Title Section */}
            <div className="bg-white rounded-xl border border-black/5 p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                                {session.title}
                            </h1>

                            {state === 'active' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Berlangsung
                                </span>
                            ) : state === 'upcoming' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Akan Datang
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Selesai
                                </span>
                            )}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">ID Sesi: {session.id}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {userRole === 'admin' && (
                            <Link
                                href={`/admin/sessions/${session.id}/edit`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200/70 text-slate-800 text-xs font-medium rounded-lg transition-colors"
                            >
                                <PencilEdit01Icon size={15} />
                                Edit Sesi
                            </Link>
                        )}
                        <a
                            href={`/api/admin/sessions/${session.id}/export`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs"
                        >
                            <Download01Icon size={15} />
                            Export Excel
                        </a>
                    </div>
                </div>
            </div>

            {/* Information Grid: 3 Clean Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Jadwal */}
                <div className="bg-white rounded-xl border border-black/5 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b border-black/5 pb-2.5">
                        <Time02Icon size={16} className="text-slate-500" />
                        Jadwal Pelaksanaan
                    </div>
                    <div className="space-y-2.5 text-xs">
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Waktu Mulai</span>
                            <span className="font-medium text-foreground">{formatDate(session.start_time)}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Waktu Selesai</span>
                            <span className="font-medium text-foreground">{formatDate(session.end_time)}</span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Keamanan */}
                <div className="bg-white rounded-xl border border-black/5 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b border-black/5 pb-2.5">
                        <SecurityLockIcon size={16} className="text-slate-500" />
                        Pengaturan Keamanan
                    </div>
                    <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-[11px]">Safe Exam Browser (SEB)</span>
                            {session.require_seb ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900 text-white">
                                    <SecurityLockIcon size={11} /> SEB Wajib
                                </span>
                            ) : (
                                <span className="text-muted-foreground font-normal">Tidak Diwajibkan</span>
                            )}
                        </div>

                        {Boolean(session.require_seb && session.seb_config_key) && (
                            <div>
                                <span className="text-muted-foreground block text-[11px]">SEB Config Hash</span>
                                <span className="font-mono text-[10px] bg-slate-50 border border-black/5 p-1 rounded block truncate text-slate-700 mt-0.5">
                                    {session.seb_config_key}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-[11px]">Kamera Proctoring</span>
                            {session.enable_proctoring ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    <Camera01Icon size={11} /> Aktif
                                </span>
                            ) : (
                                <span className="text-muted-foreground font-normal">Non-aktif</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Card 3: Visibilitas & Modul */}
                <div className="bg-white rounded-xl border border-black/5 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b border-black/5 pb-2.5">
                        <FoldersIcon size={16} className="text-slate-500" />
                        Modul & Fitur
                    </div>
                    <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-[11px]">Visibilitas Nilai</span>
                            {session.show_score ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    <ViewIcon size={11} /> Ditampilkan
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                                    <ViewOffIcon size={11} /> Disembunyikan
                                </span>
                            )}
                        </div>

                        <div>
                            <span className="text-muted-foreground block text-[11px]">ID Modul Ujian</span>
                            <div className="flex items-center justify-between mt-0.5">
                                <span className="font-mono text-[10px] text-foreground truncate max-w-[140px]">
                                    {session.module_id}
                                </span>
                                <Link
                                    href="/admin/modules"
                                    className="text-[11px] font-medium text-slate-700 hover:text-slate-900 underline"
                                >
                                    Master Data &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Participants Section */}
            <div className="bg-white rounded-xl border border-black/5 shadow-2xs overflow-hidden">
                {/* Participant Section Header */}
                <div className="p-4 sm:p-5 border-b border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <UserMultipleIcon size={18} className="text-slate-600" />
                        <h2 className="text-sm font-semibold text-foreground">Daftar Peserta Terdaftar</h2>
                        <span className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
                            {session.participants.length} Peserta
                        </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                            <Search01Icon
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                type="text"
                                placeholder="Cari peserta..."
                                value={searchParticipant}
                                onChange={(e) => setSearchParticipant(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition-all"
                            />
                        </div>

                        <button
                            onClick={() => setShowBlastConfirm(true)}
                            disabled={isSendingBlast || session.participants.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs disabled:opacity-50 shrink-0"
                        >
                            {isSendingBlast ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                                <MailSend01Icon size={14} />
                            )}
                            Blast Pengingat
                        </button>
                    </div>
                </div>

                {/* Participant Table */}
                {filteredParticipants.length === 0 ? (
                    <div className="p-10 text-center text-xs text-muted-foreground">
                        {searchParticipant
                            ? 'Tidak ada peserta yang cocok dengan kata kunci pencarian.'
                            : 'Belum ada peserta yang didaftarkan pada sesi ini.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 border-b border-black/5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 w-12 text-center">No</th>
                                    <th className="px-5 py-3">Username</th>
                                    <th className="px-5 py-3">Nama Lengkap</th>
                                    <th className="px-5 py-3 w-48">Progres Pembelajaran</th>
                                    <th className="px-5 py-3 text-center w-28">Status</th>
                                    <th className="px-5 py-3 text-center w-24">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {filteredParticipants.map((p, idx) => (
                                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-3.5 text-center text-muted-foreground font-mono">
                                            {idx + 1}
                                        </td>
                                        <td className="px-5 py-3.5 font-medium text-foreground">{p.username}</td>
                                        <td className="px-5 py-3.5 text-muted-foreground">{p.full_name}</td>
                                        <td className="px-5 py-3.5 align-middle">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            p.progress === 100 ? 'bg-emerald-500' : 'bg-slate-800'
                                                        }`}
                                                        style={{ width: `${p.progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-[11px] font-mono font-medium text-muted-foreground w-8 text-right">
                                                    {p.progress}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-center align-middle">
                                            {p.progress === 100 ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/60">
                                                    <CheckmarkCircle02Icon size={11} /> Selesai
                                                </span>
                                            ) : p.progress > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200/60">
                                                    Mengerjakan
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200/50">
                                                    Belum
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-center align-middle">
                                            <Link
                                                href={`/admin/sessions/${session.id}/participants/${p.id}`}
                                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-md transition-colors"
                                            >
                                                Detail
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Blast Confirmation Modal */}
            {showBlastConfirm &&
                typeof window !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
                        onClick={() => setShowBlastConfirm(false)}
                    >
                        <div
                            className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-black/5 p-6 space-y-4 animate-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-11 h-11 bg-slate-100 text-slate-800 rounded-lg flex items-center justify-center">
                                <MailSend01Icon size={22} />
                            </div>

                            <div className="space-y-1">
                                <h3 className="font-semibold text-base text-foreground">Kirim Broadcast Email?</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Anda akan mengirimkan email pemberitahuan jadwal sesi pelatihan ini ke{' '}
                                    <strong className="text-foreground">{session.participants.length} peserta</strong>{' '}
                                    terdaftar.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
                                <button
                                    onClick={() => setShowBlastConfirm(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleBlastEmail}
                                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
                                >
                                    Ya, Kirim Email
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
