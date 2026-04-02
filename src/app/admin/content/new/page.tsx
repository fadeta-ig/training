'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Book01Icon, FloppyDiskIcon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import MediaAttachmentManager from '@/components/ui/MediaAttachmentManager';
import type { MediaItem } from '@/components/ui/MediaAttachmentManager';

const RichTextEditor = dynamic(() => import('@/components/ui/RichTextEditor'), { ssr: false });

export default function NewTrainingPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        content_html: '',
    });
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.content_html || formData.content_html === '<p></p>') {
            setError('Konten materi tidak boleh kosong.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/trainings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, media })
            });

            const result = await res.json();

            if (result.success) {
                router.push('/admin/content');
                router.refresh();
            } else {
                throw new Error(result.error || 'Gagal menyimpan materi');
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
                    href="/admin/content"
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

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass-card p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Judul <span className="text-destructive">*</span></label>
                        <input
                            type="text"
                            required
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            placeholder="Contoh: Pengantar Arsitektur Sistem"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <MediaAttachmentManager items={media} onChange={setMedia} />
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-bold text-foreground">Konten Materi <span className="text-destructive">*</span></label>
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
