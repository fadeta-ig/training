'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    CubeIcon,
    FloppyDiskIcon,
    ArrowLeft01Icon,
    Book01Icon,
    Edit01Icon,
    ArrowUp01Icon,
    ArrowDown01Icon,
    Delete02Icon,
    PlusSignIcon
} from 'hugeicons-react';
import { Lock, Unlock, Sparkles, Layers, ListOrdered } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CategoryOption {
    id: string;
    name: string;
    code: string;
    color: string;
}

type MasterItem = {
    id: string;
    title: string;
    type: 'training' | 'exam';
};

type ModuleItem = {
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
    title: string;
};

export default function EditModuleBuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Master Lists 
    const [trainings, setTrainings] = useState<MasterItem[]>([]);
    const [exams, setExams] = useState<MasterItem[]>([]);

    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [categoryId, setCategoryId] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [enforceSequence, setEnforceSequence] = useState(false);
    const [selectedItems, setSelectedItems] = useState<ModuleItem[]>([]);

    const [error, setError] = useState<string | null>(null);

    // Proteksi: Trainer tidak diizinkan mengubah modul
    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data.role === 'trainer') {
                    toast.error('Pengajar tidak memiliki izin mengedit modul.');
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
                }
            })
            .catch(() => undefined);
    }, [router]);

    useEffect(() => {
        // Fetch module data and available resources
        Promise.all([
            fetch(`/api/modules/${resolvedParams.id}`).then(res => res.json()),
            fetch('/api/trainings').then(res => res.json()),
            fetch('/api/exams').then(res => res.json())
        ]).then(([mRes, tRes, eRes]) => {
            if (mRes.success) {
                setCategoryId(mRes.data.category_id || '');
                setTitle(mRes.data.title);
                setDescription(mRes.data.description || '');
                setEnforceSequence(Boolean(mRes.data.enforce_sequence));

                // Map items to include titles (the API returns item_type and item_id, we need to map titles from tRes and eRes)
                let tempTrainings: any[] = [];
                let tempExams: any[] = [];

                if (tRes.success) tempTrainings = tRes.data;
                if (eRes.success) tempExams = eRes.data;

                const loadedItems = mRes.data.items.map((it: any) => {
                    let itemTitle = 'Unknown Item';
                    if (it.item_type === 'training') {
                        const rec = tempTrainings.find(t => t.id === it.item_id);
                        if (rec) itemTitle = rec.title;
                    } else if (it.item_type === 'exam') {
                        const rec = tempExams.find(e => e.id === it.item_id);
                        if (rec) itemTitle = rec.title;
                    }
                    return {
                        item_type: it.item_type,
                        item_id: it.item_id,
                        sequence_order: it.sequence_order,
                        title: itemTitle
                    };
                });
                setSelectedItems(loadedItems);
            }

            if (tRes.success) {
                setTrainings(tRes.data.map((t: any) => ({ ...t, type: 'training' })));
            }
            if (eRes.success) {
                setExams(eRes.data.map((e: any) => ({ ...e, type: 'exam' })));
            }
            setIsLoading(false);
        }).catch(() => {
            setError('Gagal memuat data modul');
            setIsLoading(false);
        });
    }, [resolvedParams.id]);

    const addItem = (item: MasterItem) => {
        const newItem: ModuleItem = {
            item_type: item.type,
            item_id: item.id,
            title: item.title,
            sequence_order: selectedItems.length + 1
        };
        setSelectedItems([...selectedItems, newItem]);
    };

    const removeItem = (index: number) => {
        const newItems = [...selectedItems];
        newItems.splice(index, 1);
        // Re-calculate sequence_order
        newItems.forEach((item, idx) => item.sequence_order = idx + 1);
        setSelectedItems(newItems);
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === selectedItems.length - 1) return;

        const newItems = [...selectedItems];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

        // Re-calculate sequence_order
        newItems.forEach((item, idx) => item.sequence_order = idx + 1);
        setSelectedItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!categoryId) {
            setError("Kategori pembelajaran wajib dipilih.");
            return;
        }

        if (selectedItems.length === 0) {
            setError("Anda harus memasukkan setidaknya satu item (Pelatihan atau Ujian) ke dalam modul.");
            return;
        }

        setIsSaving(true);
        setError(null);

        const payload = {
            category_id: categoryId,
            title,
            description,
            enforce_sequence: enforceSequence,
            items: selectedItems.map(si => ({
                item_type: si.item_type,
                item_id: si.item_id,
                sequence_order: si.sequence_order
            }))
        };

        try {
            const res = await fetch(`/api/modules/${resolvedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (result.success) {
                toast.success('Modul pelatihan berhasil diperbarui');
                router.push('/admin/modules');
                router.refresh();
            } else {
                throw new Error(result.error || 'Gagal menyimpan perubahan modul');
            }
        } catch (err: any) {
            setError(err.message || 'Gagal menyimpan modul');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            <div className="flex items-start gap-3 border-b border-black/5 pb-5 sm:items-center sm:gap-4 sm:pb-6">
                <Link
                    href="/admin/modules"
                    className="shrink-0 p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <CubeIcon size={28} className="text-muted-foreground" />
                        Edit Alur Modul
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Ubah kurikulum modul, aturan akses alur, serta urutan materi dan ujian.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column */}
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
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none bg-background"
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
                            <label className="text-sm font-bold text-foreground">Judul Modul <span className="text-destructive">*</span></label>
                            <input
                                type="text"
                                required
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Deskripsi Singkat</label>
                            <textarea
                                rows={3}
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm resize-y"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
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
                            <span className={cn(
                                "text-xs font-semibold px-3 py-1 rounded-full w-fit",
                                !enforceSequence
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                    : "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                            )}>
                                {!enforceSequence ? "Mode: Terbuka & Fleksibel" : "Mode: Terkunci Bertahap"}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Option 1: Unlocked / Open Flow */}
                            <div
                                onClick={() => setEnforceSequence(false)}
                                className={cn(
                                    "relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer select-none",
                                    !enforceSequence
                                        ? "border-emerald-500 bg-emerald-50/40 shadow-sm dark:bg-emerald-950/20 dark:border-emerald-500"
                                        : "border-black/10 bg-white/50 hover:border-black/20 hover:bg-white/80 dark:border-white/10 dark:bg-card/40 dark:hover:border-white/20"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "size-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                                            !enforceSequence
                                                ? "bg-emerald-600 text-white shadow-xs"
                                                : "bg-black/5 text-muted-foreground"
                                        )}>
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
                                    <div className={cn(
                                        "size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                                        !enforceSequence
                                            ? "border-emerald-600 bg-emerald-600 text-white"
                                            : "border-black/20"
                                    )}>
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
                                    "relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer select-none",
                                    enforceSequence
                                        ? "border-amber-500 bg-amber-50/40 shadow-sm dark:bg-amber-950/20 dark:border-amber-500"
                                        : "border-black/10 bg-white/50 hover:border-black/20 hover:bg-white/80 dark:border-white/10 dark:bg-card/40 dark:hover:border-white/20"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "size-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                                            enforceSequence
                                                ? "bg-amber-600 text-white shadow-xs"
                                                : "bg-black/5 text-muted-foreground"
                                        )}>
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
                                    <div className={cn(
                                        "size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                                        enforceSequence
                                            ? "border-amber-600 bg-amber-600 text-white"
                                            : "border-black/20"
                                    )}>
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

                    <div className="glass-card p-6 space-y-5">
                        <div className="flex flex-col items-start gap-2 border-b border-black/5 pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-lg font-bold">3. Susunan Item Pembelajaran</h2>
                            <span className="text-sm font-semibold text-muted-foreground bg-black/5 px-3 py-1 rounded-full">
                                {selectedItems.length} Item Terpilih
                            </span>
                        </div>

                        {selectedItems.length === 0 ? (
                            <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-black/10 bg-black/5 p-5 text-center text-muted-foreground sm:p-10">
                                Pilih Materi atau Ujian dari pustaka di sebelah kanan untuk menambahkannya.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedItems.map((item, index) => (
                                    <div key={`${item.item_id}-${index}`} className="group flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white/60 p-3 shadow-sm backdrop-blur-sm transition-all hover:border-black/20 sm:flex-nowrap sm:gap-4 sm:p-4">
                                        <div className="font-bold text-xl text-black/20 w-8 text-center">{index + 1}</div>

                                        <div className="p-2 rounded-lg bg-black/5 text-muted-foreground">
                                            {item.item_type === 'training' ? <Book01Icon size={20} /> : <Edit01Icon size={20} />}
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
                                            <p className="text-xs font-mono text-muted-foreground uppercase mt-0.5">{item.item_type}</p>
                                        </div>

                                        <div className="ml-auto flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                                            <button
                                                type="button"
                                                onClick={() => moveItem(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1.5 rounded-md hover:bg-black/5 disabled:opacity-30 transition-colors"
                                            >
                                                <ArrowUp01Icon size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveItem(index, 'down')}
                                                disabled={index === selectedItems.length - 1}
                                                className="p-1.5 rounded-md hover:bg-black/5 disabled:opacity-30 transition-colors"
                                            >
                                                <ArrowDown01Icon size={18} />
                                            </button>
                                            <div className="w-px h-6 bg-black/10 mx-1"></div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
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
                                disabled={isSaving || selectedItems.length === 0}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-8 py-3.5 text-sm font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 sm:w-auto cursor-pointer"
                            >
                                <FloppyDiskIcon size={20} />
                                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan Modul'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Library Pool */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-card flex h-[min(600px,70dvh)] flex-col overflow-hidden lg:sticky lg:top-8">
                        <div className="p-5 border-b border-black/5 bg-white/60 z-10">
                            <h3 className="font-bold text-lg">Pustaka Konten</h3>
                            <p className="text-xs text-muted-foreground mt-1">Klik item untuk menambahkannya ke antrean susunan modul.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-6">

                            {/* Trainings Section */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-2 flex items-center gap-2">
                                    <Book01Icon size={14} /> Materi Tersedia
                                </h4>
                                <div className="space-y-2">
                                    {trainings.length === 0 ? (
                                        <p className="text-xs text-muted-foreground px-2">Data materi tidak tersedia.</p>
                                    ) : (
                                        trainings.map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => addItem(t)}
                                                className="w-full text-left p-3 rounded-xl hover:bg-black/5 active:bg-black/10 transition-colors text-sm font-medium border border-transparent hover:border-black/10 group flex justify-between items-center cursor-pointer"
                                            >
                                                <span className="truncate pr-2">{t.title}</span>
                                                <PlusSignIcon size={16} className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Exams Section */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-2 flex items-center gap-2">
                                    <Edit01Icon size={14} /> Ujian Tersedia
                                </h4>
                                <div className="space-y-2">
                                    {exams.length === 0 ? (
                                        <p className="text-xs text-muted-foreground px-2">Data ujian tidak tersedia.</p>
                                    ) : (
                                        exams.map(e => (
                                            <button
                                                key={e.id}
                                                type="button"
                                                onClick={() => addItem(e)}
                                                className="w-full text-left p-3 rounded-xl hover:bg-black/5 active:bg-black/10 transition-colors text-sm font-medium border border-transparent hover:border-black/10 group flex justify-between items-center cursor-pointer"
                                            >
                                                <span className="truncate pr-2">{e.title}</span>
                                                <PlusSignIcon size={16} className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

            </form>
        </div>
    );
}
