'use client';

import { useState, useEffect } from 'react';
import {
    Book01Icon,
    PlusSignIcon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon
} from 'hugeicons-react';
import Link from 'next/link';

type Training = {
    id: string;
    title: string;
    created_at: string;
};

export default function ContentManagerPage() {
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTrainings = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/trainings');
            if (!res.ok) throw new Error('Gagal mengambil data materi');
            const result = await res.json();
            if (result.success) {
                setTrainings(result.data);
            } else {
                throw new Error(result.error || 'Terjadi kesalahan sistem');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTrainings();
    }, []);

    const deleteTraining = async (id: string, title: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus materi "${title}" secara permanen? Aksi ini tidak dapat dibatalkan.`)) return;

        try {
            const res = await fetch(`/api/trainings/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus materi');
            fetchTrainings();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-8 max-w-5xl">
            <div className="flex justify-between items-end border-b border-black/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Book01Icon size={28} className="text-muted-foreground" />
                        Materi Pelatihan
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Kelola bacaan, artikel HTML, dan tautan video yang akan digunakan pada Modul.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchTrainings}
                        className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-white border border-black/10 text-foreground hover:bg-black/5 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm"
                        disabled={isLoading}
                    >
                        <RefreshIcon size={18} className={isLoading ? 'animate-spin' : ''} />
                        Segarkan
                    </button>
                    <Link href="/admin/content/new" className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm">
                        <PlusSignIcon size={18} />
                        Buat Materi Baru
                    </Link>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Materi</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/5 border-b border-black/5 text-muted-foreground font-medium uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-2xl">Judul Materi</th>
                                <th className="px-6 py-4">Tanggal Dibuat</th>
                                <th className="px-6 py-4 text-right rounded-tr-2xl">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-muted-foreground">
                                        <RefreshIcon size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                        Memuat materi...
                                    </td>
                                </tr>
                            ) : trainings.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-muted-foreground">
                                        Belum ada materi pelatihan. Silakan buat satu materi baru.
                                    </td>
                                </tr>
                            ) : (
                                trainings.map((training) => (
                                    <tr key={training.id} className="hover:bg-black/5 transition-colors group">
                                        <td className="px-6 py-4 font-semibold text-foreground">
                                            {training.title}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {new Date(training.created_at).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1.5">
                                            <Link href={`/admin/content/${training.id}/edit`} className="inline-block p-2 text-muted-foreground hover:text-foreground bg-white hover:bg-black/5 rounded-lg transition-colors border border-black/10">
                                                <PencilEdit02Icon size={16} />
                                            </Link>
                                            <button
                                                onClick={() => deleteTraining(training.id, training.title)}
                                                className="inline-block p-2 text-destructive/60 hover:text-destructive bg-white hover:bg-destructive/10 rounded-lg transition-colors border border-black/10 hover:border-destructive/20"
                                            >
                                                <Delete02Icon size={16} />
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
