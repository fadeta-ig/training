'use client';

import { useState, useEffect, useId } from 'react';
import { X, Loader2, Sparkles, Tag, Eye, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { ClientPortal } from '@/components/ui/ClientPortal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { LearningCategory } from '@/types';

interface CategoryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    category?: LearningCategory | null;
}

const PRESET_COLORS = [
    { name: 'Sky Blue', hex: '#0284c7' },
    { name: 'Indigo', hex: '#4f46e5' },
    { name: 'Violet', hex: '#7c3aed' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Amber', hex: '#d97706' },
    { name: 'Rose', hex: '#e11d48' },
    { name: 'Cyan', hex: '#0891b2' },
    { name: 'Fuchsia', hex: '#c026d3' },
    { name: 'Slate', hex: '#475569' },
];

export function CategoryFormModal({ isOpen, onClose, onSuccess, category }: CategoryFormModalProps) {
    const isEdit = Boolean(category);
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#0284c7');
    const [isActive, setIsActive] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const activeToggleId = useId();

    // Inisialisasi form saat modal terbuka atau kategori berubah
    useEffect(() => {
        if (category) {
            setName(category.name);
            setCode(category.code);
            setDescription(category.description || '');
            setColor(category.color || '#0284c7');
            setIsActive(category.is_active);
        } else {
            setName('');
            setCode('');
            setDescription('');
            setColor('#0284c7');
            setIsActive(true);
        }
    }, [category, isOpen]);

    // Body scroll lock & Escape key listener
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen) return null;

    // Otomatis buat saran kode dari nama kategori jika belum pernah diisi
    const handleNameChange = (val: string) => {
        setName(val);
        if (!isEdit && !code) {
            const suggested = val
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '')
                .split(/\s+/)
                .slice(0, 3)
                .join('-');
            if (suggested) setCode(suggested);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedCode = code.trim().toUpperCase();

        if (!trimmedName || !trimmedCode) {
            toast.error('Nama dan Kode kategori wajib diisi');
            return;
        }

        setIsSubmitting(true);
        try {
            const url = isEdit ? `/api/admin/categories/${category?.id}` : '/api/admin/categories';
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    code: trimmedCode,
                    description: description.trim() || null,
                    color,
                    is_active: isActive,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Gagal menyimpan kategori');
                return;
            }

            toast.success(isEdit ? 'Kategori berhasil diperbarui' : 'Kategori berhasil dibuat');
            onSuccess();
            onClose();
        } catch {
            toast.error('Terjadi kesalahan jaringan saat menyimpan kategori');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ClientPortal>
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
                onClick={() => {
                    if (!isSubmitting) onClose();
                }}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="category-modal-title"
                    className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/20 shrink-0">
                        <div className="flex items-center gap-3">
                            <div
                                className="size-8 rounded-xl flex items-center justify-center text-white shadow-xs transition-colors"
                                style={{ backgroundColor: color }}
                            >
                                <Tag className="size-4.5" />
                            </div>
                            <div>
                                <h2 id="category-modal-title" className="text-base font-bold text-foreground">
                                    {isEdit ? 'Edit Kategori Pembelajaran' : 'Tambah Kategori Baru'}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {isEdit
                                        ? 'Perbarui informasi dan warna pengenal kategori ini.'
                                        : 'Definisikan kategori baru untuk mengelompokkan materi, ujian, dan modul.'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                            aria-label="Tutup modal"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    {/* Form Content (Scrollable Container) */}
                    <form id="category-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* Live Preview Banner */}
                        <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Eye className="size-3.5 text-primary" />
                                    <span>Pratinjau Tampilan Badge & Kartu</span>
                                </span>
                                <span className="font-mono text-xs">{color}</span>
                            </div>

                            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border border-border/60 shadow-2xs">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                        className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold font-mono uppercase tracking-wider shrink-0 border"
                                        style={{
                                            backgroundColor: `${color}18`,
                                            color: color,
                                            borderColor: `${color}40`,
                                        }}
                                    >
                                        {code.trim() || 'KODE-CAT'}
                                    </span>
                                    <span className="text-sm font-bold text-foreground truncate">
                                        {name.trim() || 'Nama Kategori Pembelajaran'}
                                    </span>
                                </div>
                                <Badge variant={isActive ? 'success' : 'secondary'} className="shrink-0 text-[11px]">
                                    {isActive ? 'Aktif' : 'Nonaktif'}
                                </Badge>
                            </div>
                        </div>

                        {/* Nama Kategori */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span>Nama Kategori</span>
                                <span className="text-rose-500 font-bold">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                placeholder="Contoh: Manajemen Risiko Perbankan"
                                required
                                maxLength={150}
                                className="w-full h-10 px-3.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        {/* Kode Kategori */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span>Kode Kategori (Identifier Unik)</span>
                                <span className="text-rose-500 font-bold">*</span>
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                                placeholder="Contoh: CAT-RISK-01"
                                required
                                maxLength={50}
                                className="w-full h-10 px-3.5 text-sm font-mono uppercase tracking-wider rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Digunakan sebagai pengenal singkat pada badge konten, filter, dan integrasi modul.
                            </p>
                        </div>

                        {/* Deskripsi */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Deskripsi Cakupan Kategori
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Jelaskan ringkasan materi, target kompetensi, atau bidang keahlian kategori ini..."
                                rows={3}
                                maxLength={1000}
                                className="w-full p-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                            />
                        </div>

                        {/* Palet Warna Aksen */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span>Warna Aksen Kategori</span>
                                <span className="text-[11px] font-normal text-muted-foreground">Pilih preset atau kustom</span>
                            </label>
                            <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl border border-border/70 bg-muted/20">
                                {PRESET_COLORS.map((preset) => {
                                    const isSelected = color.toLowerCase() === preset.hex.toLowerCase();
                                    return (
                                        <button
                                            key={preset.hex}
                                            type="button"
                                            onClick={() => setColor(preset.hex)}
                                            title={preset.name}
                                            className={`size-8 rounded-xl transition-all flex items-center justify-center ${
                                                isSelected
                                                    ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110 shadow-sm'
                                                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                                            }`}
                                            style={{ backgroundColor: preset.hex }}
                                        />
                                    );
                                })}

                                <div className="h-6 w-px bg-border mx-1" />

                                <label
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs cursor-pointer hover:bg-muted transition-colors"
                                    title="Pilih warna khusus"
                                >
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="size-5 rounded cursor-pointer bg-transparent border-0 p-0"
                                    />
                                    <span className="font-mono font-medium uppercase text-muted-foreground">{color}</span>
                                </label>
                            </div>
                        </div>

                        {/* Status Aktif */}
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/10">
                            <div>
                                <label htmlFor={activeToggleId} className="text-sm font-semibold text-foreground cursor-pointer">
                                    Status Publikasi Kategori
                                </label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Kategori aktif dapat langsung digunakan untuk mengelompokkan materi, ujian, dan modul.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                                <input
                                    id={activeToggleId}
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 shadow-2xs" />
                            </label>
                        </div>
                    </form>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/80 bg-muted/20 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="rounded-xl"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            form="category-form"
                            variant="primary"
                            disabled={isSubmitting}
                            className="rounded-xl min-w-[130px]"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin mr-1.5" />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="size-4 mr-1.5" />
                                    <span>{isEdit ? 'Simpan Perubahan' : 'Buat Kategori'}</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </ClientPortal>
    );
}
