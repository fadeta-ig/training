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
    const [availableExams, setAvailableExams] = useState<Array<{ id: string; title: string }>>([]);

    const [formData, setFormData] = useState({
        title: '',
        duration_minutes: 60,
        passing_grade: 70,
        allow_remedial: false,
        max_attempts: 1,
        remedial_exam_id: '' as string,
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchExamAndOptions = async () => {
            try {
                const [examRes, listRes] = await Promise.all([
                    fetch(`/api/exams/${resolvedParams.id}`),
                    fetch('/api/exams?limit=100')
                ]);

                const [examData, listData] = await Promise.all([
                    examRes.json(),
                    listRes.json()
                ]);

                if (examData.success) {
                    setFormData({
                        title: examData.data.title,
                        duration_minutes: examData.data.duration_minutes,
                        passing_grade: Number(examData.data.passing_grade),
                        allow_remedial: examData.data.allow_remedial === 1 || examData.data.allow_remedial === true,
                        max_attempts: Number(examData.data.max_attempts) || 1,
                        remedial_exam_id: examData.data.remedial_exam_id || '',
                    });
                } else {
                    throw new Error(examData.error);
                }

                if (listData.success && Array.isArray(listData.data)) {
                    // Filter out current exam to prevent self-reference
                    setAvailableExams(listData.data.filter((ex: { id: string }) => ex.id !== resolvedParams.id));
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchExamAndOptions();
    }, [resolvedParams.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const payload = {
                ...formData,
                remedial_exam_id: formData.allow_remedial && formData.remedial_exam_id ? formData.remedial_exam_id : null,
            };

            const res = await fetch(`/api/exams/${resolvedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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
                        Edit Informasi Ujian
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Perbarui batas kelulusan, durasi waktu, atau paket soal remedial untuk ujian ini.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="glass-card space-y-6 p-4 sm:p-6 md:p-8">
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

                <div className="pt-4 border-t border-black/5">
                    <div className="flex items-center gap-3 mb-4">
                        <input
                            type="checkbox"
                            id="allow_remedial"
                            className="w-5 h-5 rounded border-black/20 text-foreground focus:ring-foreground transition-all"
                            checked={formData.allow_remedial}
                            onChange={(e) => {
                                setFormData({
                                    ...formData,
                                    allow_remedial: e.target.checked,
                                    max_attempts: e.target.checked ? Math.max(2, formData.max_attempts) : 1
                                })
                            }}
                        />
                        <label htmlFor="allow_remedial" className="text-sm font-bold text-foreground cursor-pointer select-none">
                            Izinkan Pelaksanaan Remidi Ujian
                        </label>
                    </div>

                    {formData.allow_remedial && (
                        <div className="space-y-5 mb-6 ml-0 sm:ml-8 p-4 sm:p-5 bg-black/[0.02] rounded-xl border border-black/5">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Batas Maksimal Percobaan <span className="text-destructive">*</span></label>
                                <input
                                    type="number"
                                    required
                                    min={2}
                                    max={10}
                                    className="w-full max-w-xs glass-input px-4 py-3 rounded-xl text-sm focus:outline-none block"
                                    value={formData.max_attempts}
                                    onChange={e => setFormData({ ...formData, max_attempts: Number(e.target.value) })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Jumlah kesempatan maksimal yang diberikan kepada peserta (termasuk ujian pertama).</p>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-black/5">
                                <label className="text-sm font-bold text-foreground">Paket Soal Ujian Remedial</label>
                                <select
                                    className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none bg-white text-foreground"
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
