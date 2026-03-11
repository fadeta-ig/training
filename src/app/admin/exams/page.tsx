'use client';

import { useState, useEffect } from 'react';
import {
    Edit01Icon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon,
    HelpCircleIcon
} from 'hugeicons-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useConfirm } from '@/hooks/useConfirm';
import { toast } from 'sonner';

type Exam = {
    id: string;
    title: string;
    duration_minutes: number;
    passing_grade: number;
    created_at: string;
};

export default function ExamsManagerPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchExams = async (targetPage = page) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/exams?page=${targetPage}&limit=10`);
            if (!res.ok) throw new Error('Gagal memuat ujian');
            const result = await res.json();
            if (result.success) {
                setExams(result.data);
                if (result.pagination) {
                    setTotalPages(result.pagination.totalPages);
                }
            } else {
                throw new Error(result.error || 'Terjadi kesalahan server');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchExams(page);
    }, [page]);

    const deleteExam = async (id: string, title: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Ujian?',
            message: `Apakah Anda yakin ingin menghapus Ujian "${title}" beserta seluruh soalnya secara permanen? Aksi ini tidak dapat dibatalkan.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus Ujian',
            cancelLabel: 'Batal'
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus ujian');
            toast.success('Ujian berhasil dihapus');
            fetchExams(page);
        } catch (err: any) {
            toast.error(err.message || 'Gagal menghapus ujian');
        }
    };

    return (
        <div className="space-y-8 max-w-6xl relative">
            <ConfirmComponent />
            <PageHeader
                title="Ujian & Bank Soal"
                description="Buat parameter ujian (waktu, passing grade) lalu pasangkan soal-soalnya ke dalam Bank Soal."
                icon={<Edit01Icon size={28} className="text-muted-foreground" />}
                actionLabel="Buat Ujian Baru"
                actionHref="/admin/exams/new"
                onRefresh={fetchExams}
                isRefreshing={isLoading}
            />

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Data Ujian</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/5 border-b border-black/5 text-muted-foreground font-medium uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-2xl">Judul Ujian</th>
                                <th className="px-6 py-4">Durasi</th>
                                <th className="px-6 py-4">Passing Grade</th>
                                <th className="px-6 py-4">Bank Soal</th>
                                <th className="px-6 py-4 text-right rounded-tr-2xl">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                                        <RefreshIcon size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                        Memuat data ujian...
                                    </td>
                                </tr>
                            ) : exams.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-0">
                                        <EmptyState
                                            icon={<Edit01Icon size={40} className="text-black/10" />}
                                            title="Belum ada ujian"
                                            description="Buat satu parameter ujian baru untuk mulai memasukkan soal."
                                            actionLabel="Buat Ujian Pertama"
                                            actionHref="/admin/exams/new"
                                        />
                                    </td>
                                </tr>
                            ) : (
                                exams.map((exam) => (
                                    <tr key={exam.id} className="hover:bg-black/5 transition-colors group">
                                        <td className="px-6 py-4 font-semibold text-foreground">
                                            {exam.title}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {exam.duration_minutes} Menit
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/5 text-foreground font-bold text-xs">
                                                {exam.passing_grade}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                href={`/admin/exams/${exam.id}/questions`}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-black/80 transition-colors shadow-sm"
                                            >
                                                <HelpCircleIcon size={14} />
                                                Kelola Soal
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1.5 flex justify-end gap-1.5">
                                            <ActionButton
                                                href={`/admin/exams/${exam.id}/edit`}
                                                icon={<PencilEdit02Icon size={16} />}
                                                title="Edit Parameter"
                                            />
                                            <ActionButton
                                                onClick={() => deleteExam(exam.id, exam.title)}
                                                variant="destructive"
                                                icon={<Delete02Icon size={16} />}
                                                title="Hapus Ujian"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
    );
}
