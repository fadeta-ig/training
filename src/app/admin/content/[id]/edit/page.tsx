'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Book01Icon, FloppyDiskIcon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/ui/RichTextEditor'), { ssr: false });

export default function EditTrainingPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        content_html: '',
        video_url: ''
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTraining = async () => {
            try {
                const res = await fetch(`/api/trainings/${resolvedParams.id}`);
                const data = await res.json();
                if (data.success) {
                    setFormData({
                        title: data.data.title,
                        content_html: data.data.content_html,
                        video_url: data.data.video_url || ''
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
        fetchTraining();
    }, [resolvedParams.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/trainings/${resolvedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (result.success) {
                router.push('/admin/content');
                router.refresh();
            } else {
                throw new Error(result.error || 'Gagal menyimpan perubahan materi');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center">Memuat detail materi...</div>;

    return (
        <div className="space-y-8 max-w-5xl">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
                <Link
                    href="/admin/content"
                    className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Book01Icon size={28} className="text-muted-foreground" />
                        Edit Materi Pelatihan
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Perbarui detail informasi untuk materi ini.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass-card p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Judul <span className="text-destructive">*</span></label>
                        <input
                            type="text"
                            required
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Tautan Video <span className="text-muted-foreground font-normal">(Opsional)</span></label>
                        <input
                            type="url"
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            value={formData.video_url}
                            onChange={e => setFormData({ ...formData, video_url: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-bold text-foreground">Konten Materi <span className="text-destructive">*</span></label>
                    <p className="text-xs text-muted-foreground">
                        Gunakan toolbar untuk memformat teks dan menyisipkan gambar.
                    </p>
                    <RichTextEditor
                        content={formData.content_html}
                        onChange={(html) => setFormData({ ...formData, content_html: html })}
                        placeholder="Konten materi pelatihan..."
                    />
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
