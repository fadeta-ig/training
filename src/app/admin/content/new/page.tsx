'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Book01Icon, FloppyDiskIcon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import MediaAttachmentManager from '@/components/ui/MediaAttachmentManager';
import type { MediaItem } from '@/components/ui/MediaAttachmentManager';
import { safeFetchJson } from '@/lib/api-client';
import { toast } from 'sonner';

const RichTextEditor = dynamic(() => import('@/components/ui/RichTextEditor'), { ssr: false });

interface CategoryOption {
    id: string;
    name: string;
    code: string;
    color: string;
}

function NewTrainingForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paramCategoryId = searchParams.get('category_id') || searchParams.get('category') || '';

    const [isLoading, setIsLoading] = useState(false);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [formData, setFormData] = useState({
        category_id: paramCategoryId,
        title: '',
        content_html: '',
    });
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Proteksi: Trainer tidak diizinkan membuat materi
    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data.role === 'trainer') {
                    toast.error('Pengajar tidak memiliki izin membuat materi baru.');
                    router.replace('/admin/content');
                }
            })
            .catch(() => undefined);

        // Fetch categories
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
    }, [router, paramCategoryId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.category_id) {
            setError('Kategori pembelajaran wajib dipilih.');
            return;
        }

        if (!formData.title.trim()) {
            setError('Judul materi wajib diisi.');
            return;
        }

        if (!formData.content_html.trim() || formData.content_html === '<p></p>') {
            setError('Konten materi wajib diisi.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await safeFetchJson<{ success: boolean; data?: { id: string } }>('/api/trainings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, media }),
            });

            if (res.ok && res.data?.success) {
                toast.success('Materi pelatihan berhasil dibuat');
                const returnUrl = formData.category_id
                    ? `/admin/content?category=${formData.category_id}`
                    : '/admin/content';
                router.push(returnUrl);
                router.refresh();
            } else {
                throw new Error(res.error || 'Gagal menyimpan materi pelatihan');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan materi';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const backUrl = paramCategoryId ? `/admin/content?category=${paramCategoryId}` : '/admin/content';

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
                        <Book01Icon size={28} className="text-muted-foreground" />
                        Buat Materi Baru
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Tambahkan bahan bacaan, artikel, atau konten multimedia baru ke dalam sistem.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
                <div className="glass-card p-6 space-y-6">
                    {/* Category Selector */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">
                            Kategori Pembelajaran <span className="text-destructive">*</span>
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
                            Judul <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            placeholder="Contoh: Pengantar Arsitektur Sistem"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <MediaAttachmentManager items={media} onChange={setMedia} />
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-bold text-foreground">
                        Konten Materi <span className="text-destructive">*</span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                        Gunakan toolbar untuk memformat teks (Bold, Italic, Heading, List, dll.) dan menyisipkan gambar.
                    </p>
                    <RichTextEditor
                        content={formData.content_html}
                        onChange={(html) => setFormData({ ...formData, content_html: html })}
                        placeholder="Mulai menulis konten materi pelatihan di sini..."
                    />
                </div>

                <div className="pt-4 border-t border-black/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <FloppyDiskIcon size={18} />
                        {isLoading ? 'Menyimpan...' : 'Simpan Materi'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function NewTrainingPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat formulir...</div>}>
            <NewTrainingForm />
        </Suspense>
    );
}
