'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PlusSignIcon, Calendar02Icon, Time02Icon, SecurityLockIcon, PencilEdit01Icon, Delete02Icon, ViewIcon, ViewOffIcon } from 'hugeicons-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/ui/ActionButton';
import { useConfirm } from '@/hooks/useConfirm';
import { toast } from 'sonner';

type Session = {
    id: string;
    module_id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    show_score: boolean;
    created_at: string;
};

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>('');
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
        fetch('/api/auth/me').then(res => res.json()).then(data => {
            if (data.success) {
                setUserRole(data.data.role);
            }
        }).catch(() => {});
    }, []);

    const handleDelete = async (id: string, title: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Sesi?',
            message: `Apakah Anda yakin ingin menghapus sesi "${title}"?`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus',
            cancelLabel: 'Batal'
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Sesi berhasil dihapus');
                setSessions(sessions.filter(s => s.id !== id));
            } else {
                toast.error('Gagal menghapus sesi');
            }
        } catch (error) {
            toast.error('Terjadi kesalahan saat menghapus sesi');
        }
    };

    const getSessionStatus = (start: string, end: string) => {
        const now = new Date();
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (now < startDate) {
            return {
                label: 'Akan Datang',
                className: 'bg-amber-100 text-amber-700 border border-amber-200'
            };
        } else if (now >= startDate && now <= endDate) {
            return {
                label: 'Berlangsung',
                className: 'bg-green-100 text-green-700 border border-green-200 animate-pulse'
            };
        } else {
            return {
                label: 'Selesai',
                className: 'bg-gray-100 text-gray-500 border border-gray-200'
            };
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6 relative">
            <ConfirmComponent />
            <PageHeader
                title="Sesi Ujian & Kelas"
                description="Kelola jadwal ujian, kelas, dan peserta yang bergabung."
                icon={<Calendar02Icon size={28} />}
                actionLabel={userRole === 'admin' ? "Buat Sesi Baru" : undefined}
                actionHref={userRole === 'admin' ? "/admin/sessions/create" : undefined}
            />

            <GlassCard>
                {loading ? (
                    <div className="p-8 text-center text-muted-foreground animate-pulse">Memuat data sesi...</div>
                ) : sessions.length === 0 ? (
                    <EmptyState
                        icon={<Calendar02Icon size={48} className="text-muted-foreground" />}
                        title="Belum ada Sesi"
                        description="Sistem belum memiliki jadwal ujian atau kelas. Silakan buat sesi baru untuk memulai."
                        actionLabel={userRole === 'admin' ? "Buat Sesi Pertama" : undefined}
                        actionHref={userRole === 'admin' ? "/admin/sessions/create" : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-black/5 border-b border-black/10">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Judul Sesi</th>
                                    <th className="px-6 py-4 font-medium">Jadwal Pelaksanaan</th>
                                    <th className="px-6 py-4 font-medium">Pengamanan</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((session) => {
                                    const status = getSessionStatus(session.start_time, session.end_time);

                                    return (
                                        <tr key={session.id} className="border-b border-black/5 hover:bg-black/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-foreground">{session.title}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">ID: {session.id.substring(0, 8)}...</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Time02Icon size={14} />
                                                    <span>{formatDate(session.start_time)} <br />s/d {formatDate(session.end_time)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {session.require_seb ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-blue-100 text-blue-700">
                                                        <SecurityLockIcon size={12} />
                                                        SEB AKTIF
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                                {!session.show_score && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-orange-100 text-orange-700 ml-1">
                                                        <ViewOffIcon size={12} />
                                                        NILAI TERSEMBUNYI
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <ActionButton
                                                        href={`/admin/sessions/${session.id}`}
                                                        icon={<ViewIcon size={16} />}
                                                        title="Detail Sesi"
                                                    />
                                                    {userRole === 'admin' && (
                                                        <>
                                                            <ActionButton
                                                                href={`/admin/sessions/${session.id}/edit`}
                                                                icon={<PencilEdit01Icon size={16} />}
                                                                title="Edit"
                                                            />
                                                            <ActionButton
                                                                icon={<Delete02Icon size={16} />}
                                                                title="Hapus"
                                                                variant="destructive"
                                                                onClick={() => handleDelete(session.id, session.title)}
                                                            />
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
            </GlassCard>
        </div>
    );
}
