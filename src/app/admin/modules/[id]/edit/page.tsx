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
import Link from 'next/link';

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

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedItems, setSelectedItems] = useState<ModuleItem[]>([]);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fetch module data and available resources
        Promise.all([
            fetch(`/api/modules/${resolvedParams.id}`).then(res => res.json()),
            fetch('/api/trainings').then(res => res.json()),
            fetch('/api/exams').then(res => res.json())
        ]).then(([mRes, tRes, eRes]) => {
            if (mRes.success) {
                setTitle(mRes.data.title);
                setDescription(mRes.data.description || '');

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
        }).catch(err => {
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

        if (selectedItems.length === 0) {
            setError("Anda harus memasukkan setidaknya satu item (Pelatihan atau Ujian) ke dalam modul.");
            return;
        }

        setIsSaving(true);
        setError(null);

        const payload = {
            title,
            description,
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
                router.push('/admin/modules');
                router.refresh();
            } else {
                throw new Error(result.error || 'Gagal menyimpan perubahan modul');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center">Memuat data perakit modul...</div>;

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
                <Link
                    href="/admin/modules"
                    className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <CubeIcon size={28} className="text-muted-foreground" />
                        Edit Alur Modul
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Ubah kurikulum modul, tambah, kurangi, atau ubah urutan materi dan ujian.
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

                    <div className="glass-card p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-black/5 pb-3">
                            <h2 className="text-lg font-bold">2. Alur Pembelajaran (Sequence)</h2>
                            <span className="text-sm font-semibold text-muted-foreground bg-black/5 px-3 py-1 rounded-full">
                                {selectedItems.length} Item Terpilih
                            </span>
                        </div>

                        {selectedItems.length === 0 ? (
                            <div className="p-10 border-2 border-dashed border-black/10 rounded-2xl flex items-center justify-center text-center text-muted-foreground bg-black/5">
                                Pilih Materi atau Ujian dari pustaka di sebelah kanan untuk menambahkannya.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedItems.map((item, index) => (
                                    <div key={`${item.item_id}-${index}`} className="flex items-center gap-4 p-4 rounded-xl border border-black/10 bg-white/60 backdrop-blur-sm shadow-sm hover:border-black/20 transition-all group">
                                        <div className="font-bold text-xl text-black/20 w-8 text-center">{index + 1}</div>

                                        <div className="p-2 rounded-lg bg-black/5 text-muted-foreground">
                                            {item.item_type === 'training' ? <Book01Icon size={20} /> : <Edit01Icon size={20} />}
                                        </div>

                                        <div className="flex-1">
                                            <h4 className="font-semibold text-sm">{item.title}</h4>
                                            <p className="text-xs font-mono text-muted-foreground uppercase mt-0.5">{item.item_type}</p>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

                        <div className="pt-6 mt-4 border-t border-black/5 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSaving || selectedItems.length === 0}
                                className="px-8 py-3.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 shadow-sm disabled:opacity-50"
                            >
                                <FloppyDiskIcon size={20} />
                                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-card flex flex-col h-[600px] overflow-hidden sticky top-8">
                        <div className="p-5 border-b border-black/5 bg-white/60 z-10">
                            <h3 className="font-bold text-lg">Pustaka Konten</h3>
                            <p className="text-xs text-muted-foreground mt-1">Klik item untuk menambahkannya.</p>
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
                                                key={`t-${t.id}`}
                                                type="button"
                                                onClick={() => addItem(t)}
                                                className="w-full text-left p-3 rounded-xl hover:bg-black/5 active:bg-black/10 transition-colors text-sm font-medium border border-transparent hover:border-black/10 group flex justify-between items-center"
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
                                                key={`e-${e.id}`}
                                                type="button"
                                                onClick={() => addItem(e)}
                                                className="w-full text-left p-3 rounded-xl hover:bg-black/5 active:bg-black/10 transition-colors text-sm font-medium border border-transparent hover:border-black/10 group flex justify-between items-center"
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
