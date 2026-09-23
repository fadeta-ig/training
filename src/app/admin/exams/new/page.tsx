'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Edit01Icon, FloppyDiskIcon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface CategoryOption {
    id: string;
    name: string;
    code: string;
    color: string;
}

function NewExamForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paramCategoryId = searchParams.get('category_id') || searchParams.get('category') || '';

    const [isLoading, setIsLoading] = useState(false);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [availableExams, setAvailableExams] = useState<Array<{ id: string; title: string }>>([]);
    const [formData, setFormData] = useState({
        category_id: paramCategoryId,
        title: '',
        duration_minutes: 60,
        passing_grade: 70,
        allow_remedial: false,
        max_attempts: 1,
        remedial_exam_id: '' as string,
    });
    const [error, setError] = useState<string | null>(null);

    // Proteksi: Trainer tidak diizinkan membuat ujian
    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data.role === 'trainer') {
                    toast.error('Pengajar tidak memiliki izin membuat paket ujian baru.');
                    router.replace('/admin/exams');
                }
            })
            .catch(() => undefined);

        // Fetch categories list
        fetch('/api/admin/categories?all=true')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && Array.isArray(data.data)) {
                    setCategories(data.data);
                    if (data.data.length > 0) {
                        const hasParam = data.data.some((c: CategoryOption) => c.id === paramCategoryId);
                        setFormData((prev) => ({
                            ...prev,
                            category_id: hasParam ? paramCategoryId : prev.category_id || data.data[0].id,
                        }));
                    }
                }
            })
            .catch(() => undefined);

        // Fetch available exams for remedial dropdown
        fetch('/api/exams?limit=100')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && Array.isArray(data.data)) {
                    setAvailableExams(data.data);
                }
            })
            .catch(() => {});
    }, [router, paramCategoryId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.category_id) {
            setError('Kategori pembelajaran wajib dipilih.');
            return;
        }

        if (!formData.title.trim()) {
            setError('Judul paket ujian wajib diisi.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await res.json();

            if (result.success) {
                toast.success('Paket ujian berhasil dibuat');
                const returnUrl = formData.category_id
                    ? `/admin/exams?category=${formData.category_id}`
                    : '/admin/exams';
                router.push(returnUrl);
                router.refresh();
            } else {
                throw new Error(result.error || 'Gagal menyimpan ujian');
            }
        } catch (err: any) {
            setError(err.message || 'Gagal menyimpan ujian');
        } finally {
            setIsLoading(false);
        }
    };

    const backUrl = paramCategoryId ? `/admin/exams?category=${paramCategoryId}` : '/admin/exams';

    return (
        <div className="space-y-8 pb-12">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
                <Link
                    href={backUrl}
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
                        Tentukan kategori dan parameter (waktu, batas kelulusan, dan paket remedial) sebelum memasukkan soal-soal.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="glass-card space-y-6 p-4 sm:p-6 md:p-8">
                {/* Category Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">
                        Kategori Program <span className="text-destructive">*</span>
                    </label>
                    <select
                        required
                        className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none bg-background cursor-pointer"
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    >
                        <option value="" disabled>-- Pilih Kategori --</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.code})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">
                        Judul Paket Ujian <span className="text-destructive">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                        placeholder="Contoh: Ujian Sertifikasi K3 Tingkat Dasar"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">
                            Durasi Pengerjaan (Menit) <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="number"
                            required
                            min={1}
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            value={formData.duration_minutes}
                            onChange={e => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">Waktu maksimal peserta menyelesaikan ujian.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">
                            Batas Nilai Kelulusan (Passing Grade %) <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="number"
                            required
                            min={0}
                            max={100}
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            value={formData.passing_grade}
                            onChange={e => setFormData({ ...formData, passing_grade: Number(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">Nilai minimum persentase untuk dinyatakan lulus.</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-black/5 space-y-4">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="allow_remedial"
                            className="size-4 rounded text-foreground focus:ring-ring"
                            checked={formData.allow_remedial}
                            onChange={e => setFormData({ ...formData, allow_remedial: e.target.checked })}
                        />
                        <label htmlFor="allow_remedial" className="text-sm font-bold text-foreground cursor-pointer select-none">
                            Aktifkan Fitur Remedial
                        </label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-7">
                        Izinkan peserta mengulang ujian jika skor akhir di bawah Passing Grade.
                    </p>

                    {formData.allow_remedial && (
                        <div className="ml-7 space-y-4 pt-2">
                            <div className="space-y-2 max-w-xs">
                                <label className="text-sm font-bold text-foreground">
                                    Maksimal Percobaan (Attempts)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                    value={formData.max_attempts}
                                    onChange={e => setFormData({ ...formData, max_attempts: Number(e.target.value) })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Termasuk 1x ujian utama (Contoh: 2 = 1x Ujian Utama + 1x Remedial).
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">
                                    Sumber Paket Soal Remedial
                                </label>
                                <select
                                    className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none bg-background cursor-pointer"
                                    value={formData.remedial_exam_id}
                                    onChange={e => setFormData({ ...formData, remedial_exam_id: e.target.value })}
                                >
                                    <option value="">Gunakan Soal Ujian yang Sama (Paket Saat Ini)</option>
                                    {availableExams.map((ex) => (
                                        <option key={ex.id} value={ex.id}>
                                            {ex.title}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Pilih paket ujian khusus untuk remedial jika peserta harus mengerjakan butir soal yang berbeda saat mengulang.
                                </p>
                            </div>
                        </div>
                    )}
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

export default function NewExamPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat formulir...</div>}>
            <NewExamForm />
        </Suspense>
    );
}
