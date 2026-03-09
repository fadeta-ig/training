'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Edit01Icon, FloppyDiskIcon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';

export default function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        duration_minutes: 60,
        passing_grade: 70
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchExam = async () => {
            try {
                const res = await fetch(`/api/exams/${resolvedParams.id}`);
                const data = await res.json();
                if (data.success) {
                    setFormData({
                        title: data.data.title,
                        duration_minutes: data.data.duration_minutes,
                        passing_grade: Number(data.data.passing_grade)
                    });
                } else {
                    throw new Error(data.error);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchExam();
    }, [resolvedParams.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/exams/${resolvedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (result.success) {
                router.push('/admin/exams');
                router.refresh();
            } else {
                throw new Error(result.error || 'Gagal menyimpan perubahan ujian');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center">Memuat detail ujian...</div>;

    return (
        <div className="space-y-8 max-w-4xl">
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
                        Edit Informasi Ujian
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Perbarui batas kelulusan atau durasi waktu untuk ujian ini.
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
                    </div>
                </div>

                <div className="pt-4 border-t border-black/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <FloppyDiskIcon size={18} />
                        {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </form>
        </div>
    );
}
