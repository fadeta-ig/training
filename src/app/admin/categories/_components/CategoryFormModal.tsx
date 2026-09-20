'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { LearningCategory } from '@/types';

interface CategoryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    category?: LearningCategory | null;
}

const PRESET_COLORS = [
    { name: 'Sky Blue', hex: '#0ea5e9' },
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Rose', hex: '#f43f5e' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Teal', hex: '#14b8a6' },
    { name: 'Slate', hex: '#64748b' },
];

export function CategoryFormModal({ isOpen, onClose, onSuccess, category }: CategoryFormModalProps) {
    const isEdit = Boolean(category);
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#0ea5e9');
    const [isActive, setIsActive] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (category) {
            setName(category.name);
            setCode(category.code);
            setDescription(category.description || '');
            setColor(category.color || '#0ea5e9');
            setIsActive(category.is_active);
        } else {
            setName('');
            setCode('');
            setDescription('');
            setColor('#0ea5e9');
            setIsActive(true);
        }
    }, [category, isOpen]);

    if (!isOpen) return null;

    // Otomatis buat kode dari nama kategori jika belum diisi
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
        if (!name.trim() || !code.trim()) {
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
                    name: name.trim(),
                    code: code.trim().toUpperCase(),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="size-4 rounded-full shadow-xs"
                            style={{ backgroundColor: color }}
                        />
                        <h2 className="text-base font-semibold text-foreground">
                            {isEdit ? 'Edit Kategori Pembelajaran' : 'Tambah Kategori Baru'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Nama Kategori */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Nama Kategori <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Contoh: Manajemen Risiko Perbankan"
                            required
                            className="w-full h-10 px-3.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                        />
                    </div>

                    {/* Kode Kategori */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Kode Kategori (ID Unik) <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                            placeholder="Contoh: CAT-RISK-01"
                            required
                            className="w-full h-10 px-3.5 text-sm font-mono uppercase tracking-wider rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Hanya huruf kapital, angka, dan tanda hubung (-).
                        </p>
                    </div>

                    {/* Deskripsi */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Deskripsi Singkat
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Deskripsi materi pembelajaran atau lingkup topik..."
                            rows={3}
                            className="w-full p-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                        />
                    </div>

                    {/* Palet Warna Aksen */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Warna Aksen Kategori</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{color}</span>
                        </label>
                        <div className="flex flex-wrap gap-2 items-center">
                            {PRESET_COLORS.map((preset) => (
                                <button
                                    key={preset.hex}
                                    type="button"
                                    onClick={() => setColor(preset.hex)}
                                    title={preset.name}
                                    className={`size-7 rounded-lg transition-transform ${
                                        color.toLowerCase() === preset.hex.toLowerCase()
                                            ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110'
                                            : 'hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: preset.hex }}
                                />
                            ))}
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="size-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                                title="Pilih warna kustom"
                            />
                        </div>
                    </div>

                    {/* Status Aktif */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                            <p className="text-sm font-medium text-foreground">Status Kategori</p>
                            <p className="text-xs text-muted-foreground">
                                Kategori aktif dapat diakses dan digunakan pada materi & modul.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                        </label>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-medium rounded-xl border border-input hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    <span>{isEdit ? 'Simpan Perubahan' : 'Buat Kategori'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
