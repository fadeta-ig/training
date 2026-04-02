'use client';

import { useState, useEffect, use } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft01Icon, Time02Icon, SecurityLockIcon, Calendar02Icon, UserMultipleIcon, PencilEdit01Icon, Logout01Icon, Download01Icon, MailSend01Icon, AlertCircleIcon, Cancel01Icon } from 'hugeicons-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';

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

    useEffect(() => {
        setIsSeb(navigator.userAgent.includes('SafeExamBrowser'));
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
            } catch (err) {
                setError('Masalah koneksi jaringan.');
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
    }, [resolvedParams.id]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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

    const getSessionStatus = (start: string, end: string) => {
        const now = new Date();
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (now < startDate) {
            return {
                label: 'Akan Datang',
                className: 'bg-amber-100 text-amber-700 border-amber-200'
            };
        } else if (now >= startDate && now <= endDate) {
            return {
                label: 'Berlangsung',
                className: 'bg-green-100 text-green-700 border-green-200 animate-pulse'
            };
        } else {
            return {
                label: 'Selesai',
                className: 'bg-gray-100 text-gray-500 border-gray-200'
            };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center justify-center border border-destructive/20 max-w-2xl mx-auto mt-12">
                {error || 'Sesi tidak ditemukan'}
            </div>
        );
    }

    const status = getSessionStatus(session.start_time, session.end_time);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className="flex items-center justify-between gap-4">
                <Link href="/admin/sessions" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={16} />
                    Kembali ke Daftar Sesi
                </Link>

                {isSeb && (
                    <Link
                        href="/quit-seb"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 px-4 py-1.5 rounded-full border border-red-100 transition-all active:scale-95"
                    >
                        <Logout01Icon size={14} />
                        Keluar Aplikasi SEB
                    </Link>
                )}
            </div>

            <PageHeader
                title="Detail Sesi Ujian"
                description="Informasi lengkap mengenai jadwal ujian dan peserta yang terdaftar."
                icon={<Calendar02Icon size={28} />}
                actionLabel="Edit Sesi"
                actionHref={`/admin/sessions/${session.id}/edit`}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <GlassCard className="p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-foreground mb-1">{session.title}</h2>
                                <p className="text-sm text-muted-foreground font-mono">ID: {session.id}</p>
                            </div>
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${status.className}`}>
                                {status.label}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-black/5">
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                    <Time02Icon size={16} /> Jadwal Pelaksanaan
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Waktu Mulai</p>
                                        <p className="text-sm font-medium text-foreground">{formatDate(session.start_time)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Waktu Selesai</p>
                                        <p className="text-sm font-medium text-foreground">{formatDate(session.end_time)}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                    <SecurityLockIcon size={16} /> Pengaturan Keamanan
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Safe Exam Browser (SEB)</p>
                                        {session.require_seb ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 mt-1">
                                                <SecurityLockIcon size={12} /> DIWAJIBKAN
                                            </span>
                                        ) : (
                                            <p className="text-sm font-medium text-foreground mt-1">Tidak Diwajibkan</p>
                                        )}
                                    </div>
                                    {session.require_seb && session.seb_config_key && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mt-2">SEB Config Key</p>
                                            <p className="text-xs font-mono bg-black/5 p-1.5 rounded text-foreground break-all mt-1">
                                                {session.seb_config_key}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/5 pb-4 mb-4 gap-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <UserMultipleIcon size={20} /> Daftar Peserta Terdaftar
                                </h3>
                                <span className="bg-black/5 text-foreground px-3 py-1 rounded-full text-xs font-bold">
                                    {session.participants.length} Orang
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowBlastConfirm(true)}
                                    disabled={isSendingBlast || session.participants.length === 0}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {isSendingBlast ? (
                                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <MailSend01Icon size={16} />
                                    )}
                                    Blast Pengingat
                                </button>
                                <a
                                    href={`/api/admin/sessions/${session.id}/export`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                >
                                    <Download01Icon size={16} />
                                    Export Laporan Excel
                                </a>
                            </div>
                        </div>

                        {session.participants.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-black/10 rounded-xl">
                                Belum ada peserta yang didaftarkan pada sesi ini.
                            </div>
                        ) : (
                            <div className="overflow-hidden border border-black/5 rounded-xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-black/5">
                                        <tr>
                                            <th className="px-4 py-3 font-medium w-16 text-center">No</th>
                                            <th className="px-4 py-3 font-medium">Username</th>
                                            <th className="px-4 py-3 font-medium">Nama Lengkap</th>
                                            <th className="px-4 py-3 font-medium w-48">Progress</th>
                                            <th className="px-4 py-3 font-medium text-center w-28">Status</th>
                                            <th className="px-4 py-3 font-medium text-center w-24">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5">
                                        {session.participants.map((p, idx) => (
                                            <tr key={p.id} className="hover:bg-black/[0.02] transition-colors">
                                                <td className="px-4 py-3 text-center text-muted-foreground">{idx + 1}</td>
                                                <td className="px-4 py-3 font-medium text-foreground">{p.username}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{p.full_name}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${p.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                                                                style={{ width: `${p.progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-muted-foreground w-8 text-right">
                                                            {p.progress}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {p.progress === 100 ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wide">
                                                            SELESAI
                                                        </span>
                                                    ) : p.progress > 0 ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold tracking-wide pulse text-center">
                                                            MENGERJAKAN
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold tracking-wide">
                                                            BELUM
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Link
                                                        href={`/admin/sessions/${session.id}/participants/${p.id}`}
                                                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/80 bg-primary/10 px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors"
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
                    </GlassCard>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <GlassCard className="p-5 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                            <Calendar02Icon size={32} />
                        </div>
                        <h4 className="font-bold text-foreground">Modul Ujian</h4>
                        <p className="text-sm text-muted-foreground mt-2 border border-black/5 p-3 rounded-lg bg-white/50 w-full mb-4">
                            ID Modul: <br /> <span className="font-mono text-xs">{session.module_id}</span>
                        </p>
                        <Link
                            href={`/admin/modules`}
                            className="text-primary text-xs font-semibold hover:underline"
                        >
                            Lihat Modul di Master Data &rarr;
                        </Link>
                    </GlassCard>
                </div>
            </div>

            {/* Custom Blast Confirmation Modal */}
            {showBlastConfirm && typeof window !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decorative Top Bar */}
                        <div className="h-2 w-full bg-blue-600 absolute top-0 left-0"></div>

                        <div className="p-6 text-center space-y-4 mt-2">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <MailSend01Icon size={32} />
                            </div>
                            <h3 className="font-bold text-xl text-slate-800">Kirim Broadcast Email?</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Anda yakin ingin mengirim pemberitahuan jadwal sesi pelatihan ini ke <b className="text-slate-800">SELURUH</b> peserta yang terdaftar secara serentak?
                            </p>
                        </div>
                        
                        <div className="bg-slate-50 border-t border-black/5 p-4 flex gap-3 justify-end items-center">
                            <button
                                onClick={() => setShowBlastConfirm(false)}
                                className="px-5 py-2.5 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-200/50 transition-colors focus:ring-2 focus:ring-slate-200 outline-none"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleBlastEmail}
                                className="px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 outline-none"
                            >
                                Ya, Kirim Sekarang
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
