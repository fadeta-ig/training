'use client';

import { useState, useEffect } from 'react';
import {
    CubeIcon,
    PlusSignIcon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon
} from 'hugeicons-react';
import Link from 'next/link';

type Module = {
    id: string;
    title: string;
    description: string;
    created_at: string;
};

export default function ModulesManagerPage() {
    const [modules, setModules] = useState<Module[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchModules = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/modules');
            if (!res.ok) throw new Error('Gagal mengambil data modul');
            const result = await res.json();
            if (result.success) {
                setModules(result.data);
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
        fetchModules();
    }, []);

    const deleteModule = async (id: string, title: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus Modul "${title}" secara permanen? Sesi yang sedang berjalan untuk modul ini akan terganggu.`)) return;

        try {
            const res = await fetch(`/api/modules/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus modul');
            fetchModules();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-8 max-w-6xl">
            <div className="flex justify-between items-end border-b border-black/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <CubeIcon size={28} className="text-muted-foreground" />
                        Perakit Modul (Builder)
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Susun kurikulum dengan menyatukan Materi Pelatihan dan Ujian menjadi satu alur linier utuh.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchModules}
                        className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-white border border-black/10 text-foreground hover:bg-black/5 transition-colors shadow-sm"
                        disabled={isLoading}
                    >
                        <RefreshIcon size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <Link
                        href="/admin/modules/new"
                        className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <PlusSignIcon size={18} />
                        Rakit Modul Baru
                    </Link>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Data Modul</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground glass-card flex flex-col items-center justify-center">
                        <RefreshIcon size={32} className="animate-spin mb-4 opacity-50" />
                        <p>Memuat deret modul...</p>
                    </div>
                ) : modules.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground glass-card flex flex-col items-center justify-center">
                        <CubeIcon size={48} className="mb-4 opacity-20" />
                        <p>Belum ada modul yang terdaftar. Mulai rakit alur pembelajaran Anda.</p>
                    </div>
                ) : (
                    modules.map((mod) => (
                        <div key={mod.id} className="glass-card flex flex-col group transition-all hover:glass-card-hover">
                            <div className="p-6 flex-1">
                                <h3 className="text-xl font-bold tracking-tight text-foreground line-clamp-2 mb-2">
                                    {mod.title}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                                    {mod.description || 'Tidak ada deskripsi detail tambahan.'}
                                </p>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Dibuat pada: {new Date(mod.created_at).toLocaleDateString('id-ID')}
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-black/5 flex justify-end gap-2 bg-black/5">
                                <Link href={`/admin/modules/${mod.id}/edit`} className="inline-block p-2 text-muted-foreground hover:text-foreground hover:bg-white rounded-lg transition-colors border border-transparent hover:border-black/10 shadow-sm opacity-0 group-hover:opacity-100">
                                    <PencilEdit02Icon size={18} />
                                </Link>
                                <button
                                    onClick={() => deleteModule(mod.id, mod.title)}
                                    className="inline-block p-2 text-destructive/70 hover:text-destructive hover:bg-white rounded-lg transition-colors border border-transparent hover:border-destructive/20 shadow-sm opacity-0 group-hover:opacity-100"
                                >
                                    <Delete02Icon size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
