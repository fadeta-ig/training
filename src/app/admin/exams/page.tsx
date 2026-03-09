'use client';

import { useState, useEffect } from 'react';
import {
    Edit01Icon,
    PlusSignIcon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon,
    HelpCircleIcon
} from 'hugeicons-react';
import Link from 'next/link';

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

    const fetchExams = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/exams');
            if (!res.ok) throw new Error('Gagal memuat ujian');
            const result = await res.json();
            if (result.success) {
                setExams(result.data);
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
        fetchExams();
    }, []);

    const deleteExam = async (id: string, title: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus Ujian "${title}" beserta seluruh soalnya secara permanen? Aksi ini tidak dapat dibatalkan.`)) return;

        try {
            const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus ujian');
            fetchExams();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-8 max-w-6xl">
            <div className="flex justify-between items-end border-b border-black/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Edit01Icon size={28} className="text-muted-foreground" />
                        Ujian & Bank Soal
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Buat parameter ujian (waktu, passing grade) lalu pasangkan soal-soalnya ke dalam Bank Soal.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchExams}
                        className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-white border border-black/10 text-foreground hover:bg-black/5 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm"
                        disabled={isLoading}
                    >
                        <RefreshIcon size={18} className={isLoading ? 'animate-spin' : ''} />
                        Segarkan
                    </button>
                    <Link href="/admin/exams/new" className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm">
                        <PlusSignIcon size={18} />
                        Buat Ujian Baru
                    </Link>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Data Ujian</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <div className="glass-card overflow-hidden">
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
                                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                                        Belum ada ujian yang terdaftar. Buat satu ujian baru untuk memulai.
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
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <Link href={`/admin/exams/${exam.id}/edit`} className="inline-block p-2 text-muted-foreground hover:text-foreground hover:bg-white rounded-lg transition-colors border border-transparent hover:border-black/10 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100">
                                                <PencilEdit02Icon size={18} />
                                            </Link>
                                            <button
                                                onClick={() => deleteExam(exam.id, exam.title)}
                                                className="inline-block p-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-transparent hover:border-destructive/20 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            >
                                                <Delete02Icon size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
