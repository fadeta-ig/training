'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    X,
    Search,
    BookOpen,
    FileQuestion,
    Check,
    Plus,
    Filter,
    Layers,
    Timer,
    Target,
    FileText,
} from 'lucide-react';
import { ClientPortal } from '@/components/ui/ClientPortal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MasterResourceItem, SelectedModuleItem, ResourceTabType } from '@/types/module-builder';

interface CategoryOption {
    id: string;
    name: string;
    code: string;
    color: string;
}

interface ModuleContentPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    trainings: MasterResourceItem[];
    exams: MasterResourceItem[];
    categories: CategoryOption[];
    currentCategoryId: string;
    selectedItems: SelectedModuleItem[];
    initialTab?: ResourceTabType;
    onAddItems: (items: MasterResourceItem[]) => void;
}

function ModuleContentPickerModalContent({
    onClose,
    trainings,
    exams,
    categories,
    currentCategoryId,
    selectedItems,
    initialTab = 'all',
    onAddItems,
}: Omit<ModuleContentPickerModalProps, 'isOpen'>) {
    const [activeTab, setActiveTab] = useState<ResourceTabType>(initialTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>(currentCategoryId || 'all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Map existing added items by item_id
    const addedItemMap = useMemo(() => {
        const map = new Map<string, number>();
        selectedItems.forEach((item, index) => {
            map.set(item.item_id, index + 1);
        });
        return map;
    }, [selectedItems]);

    // Combine pool based on tab
    const combinedPool = useMemo(() => {
        if (activeTab === 'training') return trainings;
        if (activeTab === 'exam') return exams;
        return [...trainings, ...exams];
    }, [activeTab, trainings, exams]);

    // Filter items
    const filteredItems = useMemo(() => {
        let items = combinedPool;

        if (filterCategory !== 'all') {
            items = items.filter((item) => item.category_id === filterCategory);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            items = items.filter(
                (item) =>
                    item.title.toLowerCase().includes(q) ||
                    (item.category_code && item.category_code.toLowerCase().includes(q)) ||
                    (item.category_name && item.category_name.toLowerCase().includes(q))
            );
        }

        return items;
    }, [combinedPool, filterCategory, searchQuery]);

    const currentCategoryObj = categories.find((c) => c.id === currentCategoryId);

    const toggleSelection = (id: string) => {
        if (addedItemMap.has(id)) return; // Already in module
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleSelectAllUnadded = () => {
        const unaddedFiltered = filteredItems.filter((item) => !addedItemMap.has(item.id));
        const allSelected = unaddedFiltered.every((item) => selectedIds.has(item.id));

        const next = new Set(selectedIds);
        if (allSelected) {
            unaddedFiltered.forEach((item) => next.delete(item.id));
        } else {
            unaddedFiltered.forEach((item) => next.add(item.id));
        }
        setSelectedIds(next);
    };

    const handleConfirmAdd = () => {
        const itemsToAdd = combinedPool.filter((item) => selectedIds.has(item.id));
        if (itemsToAdd.length > 0) {
            onAddItems(itemsToAdd);
        }
        onClose();
    };

    const handleQuickAddSingle = (item: MasterResourceItem, e: React.MouseEvent) => {
        e.stopPropagation();
        onAddItems([item]);
    };

    return (
        <ClientPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                    onClick={onClose}
                />

                {/* Modal Container */}
                <div className="relative z-10 flex h-[90vh] max-h-[820px] w-full max-w-4xl flex-col rounded-2xl border border-border/80 bg-background shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/30">
                        <div>
                            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Layers className="size-5 text-primary" />
                                Pustaka Konten Pembelajaran
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Pilih materi pelatihan atau paket ujian untuk disusun ke dalam alur modul.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onClose}
                            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                            aria-label="Tutup dialog"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="border-b px-5 py-3 space-y-3 bg-muted/10">
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                            {/* Tabs */}
                            <div className="flex items-center bg-muted/70 p-1 rounded-xl border border-border/60 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('all')}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg font-medium transition-all',
                                        activeTab === 'all'
                                            ? 'bg-background text-foreground shadow-2xs font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    Semua ({trainings.length + exams.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('training')}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all',
                                        activeTab === 'training'
                                            ? 'bg-background text-foreground shadow-2xs font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <BookOpen className="size-3.5 text-blue-500" />
                                    Materi ({trainings.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('exam')}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all',
                                        activeTab === 'exam'
                                            ? 'bg-background text-foreground shadow-2xs font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <FileQuestion className="size-3.5 text-amber-500" />
                                    Ujian ({exams.length})
                                </button>
                            </div>

                            {/* Category Filter Dropdown */}
                            <div className="flex items-center gap-2">
                                <Filter className="size-3.5 text-muted-foreground shrink-0" />
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="all">Semua Kategori</option>
                                    {currentCategoryObj && (
                                        <option value={currentCategoryObj.id}>
                                            Hanya Kategori Modul Ini ({currentCategoryObj.code})
                                        </option>
                                    )}
                                    {categories
                                        .filter((c) => c.id !== currentCategoryId)
                                        .map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.code})
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Ketik kata kunci untuk mencari judul materi atau ujian..."
                                className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-border/70 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sub-header Controls */}
                    <div className="flex items-center justify-between px-5 py-2 text-xs text-muted-foreground border-b bg-muted/20">
                        <span>
                            Menampilkan <strong className="text-foreground">{filteredItems.length}</strong> item
                            {filterCategory !== 'all' && ' (kategori terfilter)'}
                        </span>
                        <button
                            type="button"
                            onClick={handleSelectAllUnadded}
                            className="font-medium text-primary hover:underline"
                        >
                            Pilih / Lepas Semua
                        </button>
                    </div>

                    {/* Scrollable Items List */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
                        {filteredItems.length === 0 ? (
                            <div className="py-14 text-center text-muted-foreground space-y-2">
                                <Layers className="mx-auto size-10 opacity-30" />
                                <p className="font-medium text-sm">Tidak ada konten yang sesuai</p>
                                <p className="text-xs max-w-sm mx-auto">
                                    Coba ubah kata kunci pencarian atau ganti filter kategori menjadi &quot;Semua Kategori&quot;.
                                </p>
                                {(searchQuery || filterCategory !== 'all') && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setFilterCategory('all');
                                        }}
                                        className="mt-3 text-xs"
                                    >
                                        Reset Filter
                                    </Button>
                                )}
                            </div>
                        ) : (
                            filteredItems.map((item) => {
                                const isAdded = addedItemMap.has(item.id);
                                const stepNumber = addedItemMap.get(item.id);
                                const isSelected = selectedIds.has(item.id);
                                const isTraining = item.type === 'training';
                                const catColor = item.category_color || '#0ea5e9';

                                return (
                                    <div
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => toggleSelection(item.id)}
                                        className={cn(
                                            'group relative flex items-start gap-3.5 p-3.5 rounded-xl border transition-all text-left select-none',
                                            isAdded
                                                ? 'bg-muted/40 border-border/50 opacity-80 cursor-default'
                                                : isSelected
                                                ? 'border-primary bg-primary/5 shadow-2xs cursor-pointer'
                                                : 'border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30 cursor-pointer'
                                        )}
                                    >
                                        {/* Selection Checkbox */}
                                        <div className="pt-0.5 shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={isSelected || isAdded}
                                                disabled={isAdded}
                                                onChange={() => toggleSelection(item.id)}
                                                className="size-4 rounded text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>

                                        {/* Type Icon */}
                                        <div
                                            className={cn(
                                                'size-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5',
                                                isTraining
                                                    ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300'
                                                    : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                                            )}
                                        >
                                            {isTraining ? (
                                                <BookOpen className="size-4.5" />
                                            ) : (
                                                <FileQuestion className="size-4.5" />
                                            )}
                                        </div>

                                        {/* Content Information */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {item.category_code && (
                                                    <span
                                                        className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold font-mono uppercase tracking-wider border shadow-2xs"
                                                        style={{
                                                            backgroundColor: `${catColor}15`,
                                                            color: catColor,
                                                            borderColor: `${catColor}30`,
                                                        }}
                                                    >
                                                        {item.category_code}
                                                    </span>
                                                )}
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] font-medium h-4 px-1.5 uppercase"
                                                >
                                                    {isTraining ? 'Materi Pelatihan' : 'Paket Ujian'}
                                                </Badge>
                                            </div>

                                            <h3 className="font-semibold text-sm text-foreground leading-snug break-words">
                                                {item.title}
                                            </h3>

                                            {/* Details Metadata */}
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
                                                {isTraining ? (
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="size-3 text-blue-500" />
                                                        {Number(item.media_count) > 0
                                                            ? `${item.media_count} berkas lampiran`
                                                            : 'Materi teks'}
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className="flex items-center gap-1">
                                                            <FileQuestion className="size-3 text-amber-500" />
                                                            {item.question_count || 0} soal
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Timer className="size-3 text-muted-foreground" />
                                                            {item.duration_minutes || 60} menit
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Target className="size-3 text-emerald-500" />
                                                            Passing {item.passing_grade || 70}%
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status / Quick Action */}
                                        <div className="shrink-0 self-center pl-2">
                                            {isAdded ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                                    <Check className="size-3.5" />
                                                    Langkah {stepNumber}
                                                </span>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={isSelected ? 'default' : 'outline'}
                                                    onClick={(e) => handleQuickAddSingle(item, e)}
                                                    className="h-8 px-2.5 text-xs font-medium rounded-lg"
                                                >
                                                    <Plus className="size-3.5 mr-1" />
                                                    Tambah
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t px-5 py-3.5 bg-muted/30">
                        <div className="text-xs text-muted-foreground">
                            {selectedIds.size > 0 ? (
                                <span>
                                    <strong className="text-foreground">{selectedIds.size}</strong> item dipilih
                                </span>
                            ) : (
                                <span>Pilih item dengan mencentang kotak atau klik &quot;Tambah&quot;</span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                                className="h-9 px-4 text-xs font-medium rounded-xl"
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleConfirmAdd}
                                disabled={selectedIds.size === 0}
                                className="h-9 px-4 text-xs font-semibold rounded-xl"
                            >
                                <Plus className="size-4 mr-1.5" />
                                Tambahkan {selectedIds.size > 0 ? `${selectedIds.size} Item Terpilih` : 'ke Modul'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </ClientPortal>
    );
}

export function ModuleContentPickerModal(props: ModuleContentPickerModalProps) {
    if (!props.isOpen) return null;
    return <ModuleContentPickerModalContent {...props} />;
}
