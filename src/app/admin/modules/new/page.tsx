'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    CubeIcon,
    FloppyDiskIcon,
    ArrowLeft01Icon,
    Book01Icon,
    Edit01Icon,
    ArrowUp01Icon,
    ArrowDown01Icon,
    Delete02Icon,
} from 'hugeicons-react';
import { Lock, Unlock, Sparkles, Layers, ListOrdered, Plus, BookOpen, FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ModuleContentSidebar } from '@/components/admin/ModuleContentSidebar';
import { ModuleContentPickerModal } from '@/components/admin/ModuleContentPickerModal';
import type { MasterResourceItem, SelectedModuleItem, ResourceTabType } from '@/types/module-builder';

interface CategoryOption {
    id: string;
    name: string;
    code: string;
    color: string;
}

function NewModuleBuilderForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paramCategoryId = searchParams.get('category_id') || searchParams.get('category') || '';
    const [isLoading, setIsLoading] = useState(false);

    // Master Lists 
    const [trainings, setTrainings] = useState<MasterResourceItem[]>([]);
    const [exams, setExams] = useState<MasterResourceItem[]>([]);

    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [categoryId, setCategoryId] = useState(paramCategoryId);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [enforceSequence, setEnforceSequence] = useState(false);
    const [selectedItems, setSelectedItems] = useState<SelectedModuleItem[]>([]);

    // Picker Modal State
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerInitialTab, setPickerInitialTab] = useState<ResourceTabType>('all');

    const [error, setError] = useState<string | null>(null);

    // Proteksi: Trainer tidak diizinkan membuat modul
    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data.role === 'trainer') {
                    toast.error('Pengajar tidak memiliki izin membuat modul baru.');
                    router.replace('/admin/modules');
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
                        setCategoryId((prev) => (hasParam ? paramCategoryId : prev || data.data[0].id));
                    }
                }
            })
            .catch(() => undefined);

        // Fetch available trainings and exams with rich metadata
        Promise.all([
            fetch('/api/trainings?limit=100').then((res) => res.json()),
            fetch('/api/exams?limit=100').then((res) => res.json()),
        ]).then(([tRes, eRes]) => {
            if (tRes.success && Array.isArray(tRes.data)) {
                setTrainings(tRes.data.map((t: any) => ({ ...t, type: 'training' as const })));
            }
            if (eRes.success && Array.isArray(eRes.data)) {
                setExams(eRes.data.map((e: any) => ({ ...e, type: 'exam' as const })));
            }
        });
    }, [router, paramCategoryId]);

    const addItem = (item: MasterResourceItem) => {
        // Prevent duplicate addition
        const alreadyExists = selectedItems.some(
            (si) => si.item_id === item.id && si.item_type === item.type
        );
        if (alreadyExists) {
            toast.info(`"${item.title}" sudah ada di dalam antrean modul.`);
            return;
        }

        const newItem: SelectedModuleItem = {
            item_type: item.type,
            item_id: item.id,
            title: item.title,
            sequence_order: selectedItems.length + 1,
        };
        setSelectedItems((prev) => [...prev, newItem]);
        toast.success(`"${item.title}" ditambahkan ke alur modul.`);
    };

    const addItemsBulk = (items: MasterResourceItem[]) => {
        const unaddedItems = items.filter(
            (item) => !selectedItems.some((si) => si.item_id === item.id && si.item_type === item.type)
        );

        if (unaddedItems.length === 0) {
            toast.info('Item yang dipilih sudah ada di dalam antrean modul.');
            return;
        }

        const newItems: SelectedModuleItem[] = unaddedItems.map((item, idx) => ({
            item_type: item.type,
            item_id: item.id,
            title: item.title,
            sequence_order: selectedItems.length + idx + 1,
        }));

        setSelectedItems((prev) => [...prev, ...newItems]);
        toast.success(`${newItems.length} item berhasil ditambahkan ke alur modul.`);
    };

    const removeItem = (index: number) => {
        const newItems = [...selectedItems];
        newItems.splice(index, 1);
        newItems.forEach((item, idx) => (item.sequence_order = idx + 1));
        setSelectedItems(newItems);
    };

    const removeItemByTargetId = (itemId: string, itemType: 'training' | 'exam') => {
        const filtered = selectedItems.filter(
            (si) => !(si.item_id === itemId && si.item_type === itemType)
        );
        filtered.forEach((item, idx) => (item.sequence_order = idx + 1));
        setSelectedItems(filtered);
        toast.info('Item dihapus dari susunan modul.');
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === selectedItems.length - 1) return;

        const newItems = [...selectedItems];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        newItems.forEach((item, idx) => (item.sequence_order = idx + 1));
        setSelectedItems(newItems);
    };

    const openPickerModal = (tab: ResourceTabType = 'all') => {
        setPickerInitialTab(tab);
        setIsPickerOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!categoryId) {
            setError('Kategori pembelajaran wajib dipilih.');
            return;
        }

        if (selectedItems.length === 0) {
            setError('Anda harus memasukkan setidaknya satu item (Pelatihan atau Ujian) ke dalam modul.');
            return;
        }

        setIsLoading(true);
        setError(null);

        const payload = {
            category_id: categoryId,
            title,
            description,
            enforce_sequence: enforceSequence,
            items: selectedItems.map((si) => ({
                item_type: si.item_type,
                item_id: si.item_id,
                sequence_order: si.sequence_order,
            })),
        };

        try {
            const res = await fetch('/api/modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await res.json();

            if (result.success) {
                toast.success('Modul pelatihan berhasil dibuat');
                const returnUrl = categoryId
                    ? `/admin/modules?category=${categoryId}`
                    : '/admin/modules';
                router.push(returnUrl);
                router.refresh();
            } else {
                throw new Error(result.error || 'Gagal membuat modul');
            }
        } catch (err: any) {
            setError(err.message || 'Gagal membuat modul');
        } finally {
            setIsLoading(false);
        }
    };

    const backUrl = paramCategoryId ? `/admin/modules?category=${paramCategoryId}` : '/admin/modules';

    return (
        <div className="space-y-8 pb-12">
            <div className="flex items-start gap-3 border-b border-black/5 pb-5 sm:items-center sm:gap-4 sm:pb-6">
                <Link
                    href={backUrl}
                    className="shrink-0 p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <CubeIcon size={28} className="text-muted-foreground" />
                        Perakit Alur Modul
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Ciptakan kurikulum dengan menyusun Materi Pelatihan dan Ujian secara fleksibel atau bertahap.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Module Details & Sequence Definition */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="glass-card p-6 space-y-5">
                        <h2 className="text-lg font-bold border-b border-black/5 pb-3">1. Informasi Modul</h2>

                        {/* Category Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">
                                Kategori Pembelajaran <span className="text-destructive">*</span>
                            </label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                required
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none bg-background cursor-pointer"
                            >
                                <option value="" disabled>-- Pilih Kategori --</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.code})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                Kategori ini menentukan kelompok topik modul pelatihan dan instruktur yang berwenang.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">
                                Judul Modul <span className="text-destructive">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm"
                                placeholder="Contoh: Orientasi Pekerja Baru (Q1)"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Deskripsi Singkat</label>
                            <textarea
                                rows={3}
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm resize-y"
                                placeholder="Jelaskan tujuan dari modul ini secara singkat..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Flow Rule Card */}
                    <div className="glass-card p-6 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/5 pb-3">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                                    <Layers className="size-5 text-indigo-600 dark:text-indigo-400" />
                                    2. Aturan Alur Pengerjaan (Flow Rule)
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Tentukan bagaimana peserta mengakses item-item materi dan ujian dalam modul ini.
                                </p>
                            </div>
                            <span
                                className={cn(
                                    'text-xs font-semibold px-3 py-1 rounded-full w-fit',
                                    !enforceSequence
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                                        : 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                                )}
                            >
                                {!enforceSequence ? 'Mode: Terbuka & Fleksibel' : 'Mode: Terkunci Bertahap'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Option 1: Unlocked / Open Flow */}
                            <div
                                onClick={() => setEnforceSequence(false)}
                                className={cn(
                                    'relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer select-none',
                                    !enforceSequence
                                        ? 'border-emerald-500 bg-emerald-50/40 shadow-sm dark:bg-emerald-950/20 dark:border-emerald-500'
                                        : 'border-black/10 bg-white/50 hover:border-black/20 hover:bg-white/80 dark:border-white/10 dark:bg-card/40 dark:hover:border-white/20'
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={cn(
                                                'size-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                                                !enforceSequence
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'bg-black/5 text-muted-foreground'
                                            )}
                                        >
                                            <Unlock className="size-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-sm text-foreground">Alur Terbuka & Fleksibel</h3>
                                                <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                                                    Standar
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                                Peserta bebas membuka dan mengerjakan materi maupun ujian kapan saja tanpa harus menyelesaikan step sebelumnya terlebih dahulu.
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        className={cn(
                                            'size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                                            !enforceSequence
                                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                                : 'border-black/20'
                                        )}
                                    >
                                        {!enforceSequence && <div className="size-2 rounded-full bg-white" />}
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                                    <Sparkles className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span>Pilihan ideal untuk pembelajaran mandiri tanpa blokir.</span>
                                </div>
                            </div>

                            {/* Option 2: Sequential / Locked Flow */}
                            <div
                                onClick={() => setEnforceSequence(true)}
                                className={cn(
                                    'relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer select-none',
                                    enforceSequence
                                        ? 'border-amber-500 bg-amber-50/40 shadow-sm dark:bg-amber-950/20 dark:border-amber-500'
                                        : 'border-black/10 bg-white/50 hover:border-black/20 hover:bg-white/80 dark:border-white/10 dark:bg-card/40 dark:hover:border-white/20'
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={cn(
                                                'size-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                                                enforceSequence
                                                    ? 'bg-amber-600 text-white shadow-xs'
                                                    : 'bg-black/5 text-muted-foreground'
                                            )}
                                        >
                                            <Lock className="size-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-sm text-foreground">Alur Bertahap (Terkunci)</h3>
                                                <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-md">
                                                    Linier
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                                Peserta wajib menyelesaikan materi atau ujian secara berurutan. Step berikutnya baru terbuka setelah step sebelumnya tuntas.
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        className={cn(
                                            'size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                                            enforceSequence
                                                ? 'border-amber-600 bg-amber-600 text-white'
                                                : 'border-black/20'
                                        )}
                                    >
                                        {enforceSequence && <div className="size-2 rounded-full bg-white" />}
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                                    <ListOrdered className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span>Gunakan bila materi awal merupakan prasyarat mutlak ujian.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Learning Items Sequence */}
                    <div className="glass-card p-6 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-black/5 pb-4">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">3. Susunan Item Pembelajaran</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Atur urutan materi dan ujian yang akan ditempuh peserta.
                                </p>
                            </div>

                            {/* Action Buttons to open Picker */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openPickerModal('training')}
                                    className="h-8 px-2.5 text-xs font-medium rounded-lg text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                                >
                                    <BookOpen className="size-3.5 mr-1 text-blue-500" />
                                    + Tambah Materi
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openPickerModal('exam')}
                                    className="h-8 px-2.5 text-xs font-medium rounded-lg text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
                                >
                                    <FileQuestion className="size-3.5 mr-1 text-amber-500" />
                                    + Tambah Ujian
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => openPickerModal('all')}
                                    className="h-8 px-3 text-xs font-semibold rounded-lg"
                                >
                                    <Plus className="size-3.5 mr-1" />
                                    Pustaka Lengkap
                                </Button>
                            </div>
                        </div>

                        {selectedItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-8 sm:p-12 text-center space-y-4">
                                <div className="size-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground border">
                                    <Layers className="size-7 opacity-60" />
                                </div>
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="font-bold text-sm text-foreground">Alur modul masih kosong</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Pilih materi bacaan dan ujian evaluasi dari panel pustaka sebelah kanan, atau klik tombol di bawah untuk memilih sekaligus.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openPickerModal('training')}
                                        className="h-9 px-3 text-xs font-medium rounded-xl"
                                    >
                                        <BookOpen className="size-3.5 mr-1 text-blue-500" />
                                        Pilih Materi Pelatihan
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openPickerModal('exam')}
                                        className="h-9 px-3 text-xs font-medium rounded-xl"
                                    >
                                        <FileQuestion className="size-3.5 mr-1 text-amber-500" />
                                        Pilih Paket Ujian
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => openPickerModal('all')}
                                        className="h-9 px-4 text-xs font-semibold rounded-xl"
                                    >
                                        <Plus className="size-3.5 mr-1.5" />
                                        Buka Pustaka Lengkap
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedItems.map((item, index) => (
                                    <div
                                        key={`${item.item_id}-${index}`}
                                        className="group flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white/60 p-3 shadow-sm backdrop-blur-sm transition-all hover:border-black/20 sm:flex-nowrap sm:gap-4 sm:p-4"
                                    >
                                        <div className="font-bold text-xl text-black/20 w-8 text-center">
                                            {index + 1}
                                        </div>

                                        <div className="p-2 rounded-lg bg-black/5 text-muted-foreground">
                                            {item.item_type === 'training' ? (
                                                <Book01Icon size={20} className="text-blue-600" />
                                            ) : (
                                                <Edit01Icon size={20} className="text-amber-600" />
                                            )}
                                        </div>

                                        <div className="min-w-[8rem] flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="break-words font-semibold text-sm">{item.title}</h4>
                                                {!enforceSequence ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md px-1.5 py-0.5">
                                                        <Unlock className="size-3" /> Akses Terbuka
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80 rounded-md px-1.5 py-0.5">
                                                        <Lock className="size-3" /> Langkah {index + 1}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-mono text-muted-foreground uppercase mt-0.5">
                                                {item.item_type === 'training' ? 'Materi Pelatihan' : 'Paket Ujian'}
                                            </p>
                                        </div>

                                        <div className="ml-auto flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                                            <button
                                                type="button"
                                                onClick={() => moveItem(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1.5 rounded-md hover:bg-black/5 disabled:opacity-30 transition-colors"
                                                title="Pindah ke atas"
                                            >
                                                <ArrowUp01Icon size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveItem(index, 'down')}
                                                disabled={index === selectedItems.length - 1}
                                                className="p-1.5 rounded-md hover:bg-black/5 disabled:opacity-30 transition-colors"
                                                title="Pindah ke bawah"
                                            >
                                                <ArrowDown01Icon size={18} />
                                            </button>
                                            <div className="w-px h-6 bg-black/10 mx-1"></div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
                                                title="Hapus dari alur modul"
                                            >
                                                <Delete02Icon size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 flex justify-stretch border-t border-black/5 pt-6 sm:justify-end">
                            <button
                                type="submit"
                                disabled={isLoading || selectedItems.length === 0}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-8 py-3.5 text-sm font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 sm:w-auto cursor-pointer"
                            >
                                <FloppyDiskIcon size={20} />
                                {isLoading ? 'Menyimpan...' : 'Simpan & Terbitkan Modul'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Overhauled Content Library */}
                <div className="lg:col-span-4">
                    <ModuleContentSidebar
                        trainings={trainings}
                        exams={exams}
                        categories={categories}
                        currentCategoryId={categoryId}
                        selectedItems={selectedItems}
                        onAddItem={addItem}
                        onRemoveItemByTargetId={removeItemByTargetId}
                        onOpenModal={openPickerModal}
                    />
                </div>
            </form>

            {/* Modal Dialog Content Picker */}
            <ModuleContentPickerModal
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                trainings={trainings}
                exams={exams}
                categories={categories}
                currentCategoryId={categoryId}
                selectedItems={selectedItems}
                initialTab={pickerInitialTab}
                onAddItems={addItemsBulk}
            />
        </div>
    );
}

export default function NewModuleBuilderPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat perakit modul...</div>}>
            <NewModuleBuilderForm />
        </Suspense>
    );
}
