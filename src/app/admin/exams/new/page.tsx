'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit01Icon, FloppyDiskIcon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';

export default function NewExamPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        duration_minutes: 60,
        passing_grade: 70
    });
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (result.success) {
                router.push('/admin/exams');
                router.refresh();
            } else {
                throw new Error(result.error || 'Gagal menyimpan ujian');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
                <Link
                    href="/admin/exams"
                    className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Edit01Icon size={28} className="text-muted-foreground" />
                        Buat Ujian Baru
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Tentukan parameter (waktu & batas lulus) sebelum memasukkan soal-soal.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Judul Ujian <span className="text-destructive">*</span></label>
                    <input
                        type="text"
                        required
                        className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                        placeholder="Contoh: Ujian Akhir Arsitektur Enterprise"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Durasi (Menit) <span className="text-destructive">*</span></label>
                        <input
                            type="number"
                            required
                            min={10}
                            max={300}
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            value={formData.duration_minutes}
                            onChange={e => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">Antara 10 hingga 300 menit.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Kriteria Kelulusan (%) <span className="text-destructive">*</span></label>
                        <input
                            type="number"
                            required
                            min={0}
                            max={100}
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            value={formData.passing_grade}
                            onChange={e => setFormData({ ...formData, passing_grade: Number(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">Persentase minimum untuk lulus (0-100).</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-black/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <FloppyDiskIcon size={18} />
                        {isLoading ? 'Menyimpan...' : 'Simpan Ujian'}
                    </button>
                </div>
            </form>
        </div>
    );
}
