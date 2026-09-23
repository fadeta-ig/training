'use client';

import React, { useState, useMemo } from 'react';
import {
    Search,
    BookOpen,
    FileQuestion,
    Plus,
    Check,
    X,
    Maximize2,
    Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MasterResourceItem, SelectedModuleItem, ResourceTabType } from '@/types/module-builder';

interface CategoryOption {
    id: string;
    name: string;
    code: string;
    color: string;
}

interface ModuleContentSidebarProps {
    trainings: MasterResourceItem[];
    exams: MasterResourceItem[];
    categories: CategoryOption[];
    currentCategoryId: string;
    selectedItems: SelectedModuleItem[];
    onAddItem: (item: MasterResourceItem) => void;
    onRemoveItemByTargetId: (itemId: string, itemType: 'training' | 'exam') => void;
    onOpenModal: (tab?: ResourceTabType) => void;
}

export function ModuleContentSidebar({
    trainings,
    exams,
    categories,
    currentCategoryId,
    selectedItems,
    onAddItem,
    onRemoveItemByTargetId,
    onOpenModal,
}: ModuleContentSidebarProps) {
    const [activeTab, setActiveTab] = useState<ResourceTabType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategoryOnly, setFilterCategoryOnly] = useState(true);

    const currentCategoryObj = categories.find((c) => c.id === currentCategoryId);

    // Map existing added items
    const addedItemMap = useMemo(() => {
        const map = new Map<string, number>();
        selectedItems.forEach((item, index) => {
            map.set(`${item.item_type}-${item.item_id}`, index + 1);
        });
        return map;
    }, [selectedItems]);

    // Active items pool
    const pool = useMemo(() => {
        if (activeTab === 'training') return trainings;
        if (activeTab === 'exam') return exams;
        return [...trainings, ...exams];
    }, [activeTab, trainings, exams]);

    // Filtered pool
    const filteredPool = useMemo(() => {
        let items = pool;

        if (filterCategoryOnly && currentCategoryId) {
            items = items.filter((item) => item.category_id === currentCategoryId);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            items = items.filter(
                (item) =>
                    item.title.toLowerCase().includes(q) ||
                    (item.category_code && item.category_code.toLowerCase().includes(q))
            );
        }

        return items;
    }, [pool, filterCategoryOnly, currentCategoryId, searchQuery]);

    return (
        <div className="glass-card flex h-[min(720px,85dvh)] flex-col overflow-hidden lg:sticky lg:top-8 border border-border/80 shadow-md">
            {/* Header with Open Modal Button */}
            <div className="p-4 border-b border-border/70 bg-muted/40 z-10 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h3 className="font-bold text-base text-foreground">Pustaka Konten</h3>
                        <p className="text-[11px] text-muted-foreground">
                            Klik tambah untuk memasukkan ke alur.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenModal(activeTab)}
                        className="h-8 px-2.5 text-xs font-medium rounded-lg text-primary hover:bg-primary/5"
                        title="Buka pustaka dalam tampilan dialog lengkap"
                    >
                        <Maximize2 className="size-3.5 mr-1" />
                        Pustaka Penuh
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border border-border/50 text-xs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={cn(
                            'flex-1 py-1 text-center font-medium rounded-md transition-all',
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
                            'flex-1 py-1 text-center font-medium rounded-md transition-all flex items-center justify-center gap-1',
                            activeTab === 'training'
                                ? 'bg-background text-foreground shadow-2xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <BookOpen className="size-3 text-blue-500" />
                        Materi ({trainings.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('exam')}
                        className={cn(
                            'flex-1 py-1 text-center font-medium rounded-md transition-all flex items-center justify-center gap-1',
                            activeTab === 'exam'
                                ? 'bg-background text-foreground shadow-2xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <FileQuestion className="size-3 text-amber-500" />
                        Ujian ({exams.length})
                    </button>
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari materi atau ujian..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </div>

                {/* Category Filter Toggle */}
                {currentCategoryObj && (
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Filter className="size-3" />
                            Kategori: <strong className="text-foreground">{currentCategoryObj.code}</strong>
                        </span>
                        <button
                            type="button"
                            onClick={() => setFilterCategoryOnly(!filterCategoryOnly)}
                            className={cn(
                                'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                                filterCategoryOnly
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                            )}
                        >
                            {filterCategoryOnly ? 'Kategori Ini Saja' : 'Semua Kategori'}
                        </button>
                    </div>
                )}
            </div>

            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredPool.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground space-y-1.5 px-3">
                        <BookOpen className="mx-auto size-7 opacity-30" />
                        <p className="font-medium text-xs">Tidak ada konten yang sesuai</p>
                        <p className="text-[11px]">
                            {filterCategoryOnly
                                ? 'Tidak ada item dalam kategori ini. Coba klik "Semua Kategori" di atas.'
                                : 'Coba ubah kata kunci pencarian.'}
                        </p>
                        {filterCategoryOnly && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setFilterCategoryOnly(false)}
                                className="mt-2 text-xs h-7"
                            >
                                Tampilkan Semua Kategori
                            </Button>
                        )}
                    </div>
                ) : (
                    filteredPool.map((item) => {
                        const key = `${item.type}-${item.id}`;
                        const isAdded = addedItemMap.has(key);
                        const stepNumber = addedItemMap.get(key);
                        const isTraining = item.type === 'training';
                        const catColor = item.category_color || '#0ea5e9';

                        return (
                            <div
                                key={key}
                                className={cn(
                                    'group relative flex flex-col p-2.5 rounded-xl border transition-all text-left space-y-1.5',
                                    isAdded
                                        ? 'bg-muted/40 border-border/50 opacity-90'
                                        : 'bg-card hover:border-primary/40 hover:shadow-2xs border-border/70'
                                )}
                            >
                                <div className="flex items-start gap-2">
                                    <div
                                        className={cn(
                                            'size-6 rounded flex items-center justify-center shrink-0 border mt-0.5',
                                            isTraining
                                                ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300'
                                                : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                                        )}
                                    >
                                        {isTraining ? (
                                            <BookOpen className="size-3.5" />
                                        ) : (
                                            <FileQuestion className="size-3.5" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {item.category_code && (
                                                <span
                                                    className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold font-mono uppercase tracking-wider border shadow-2xs"
                                                    style={{
                                                        backgroundColor: `${catColor}15`,
                                                        color: catColor,
                                                        borderColor: `${catColor}30`,
                                                    }}
                                                >
                                                    {item.category_code}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                                {isTraining ? 'Materi' : 'Ujian'}
                                            </span>
                                        </div>

                                        <h4
                                            className="font-medium text-xs text-foreground leading-snug line-clamp-2 mt-0.5 break-words"
                                            title={item.title}
                                        >
                                            {item.title}
                                        </h4>
                                    </div>
                                </div>

                                {/* Meta & Action Row */}
                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                                    <span className="text-muted-foreground text-[10px]">
                                        {isTraining
                                            ? Number(item.media_count) > 0
                                                ? `${item.media_count} lampiran`
                                                : 'Teks saja'
                                            : `${item.question_count || 0} soal • ${item.duration_minutes || 60}m`}
                                    </span>

                                    {isAdded ? (
                                        <div className="flex items-center gap-1">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                <Check className="size-3" />
                                                Langkah {stepNumber}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => onRemoveItemByTargetId(item.id, item.type)}
                                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                title="Hapus dari alur modul"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onAddItem(item)}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2 py-0.5 rounded-md transition-colors"
                                        >
                                            <Plus className="size-3" />
                                            Tambah
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom Counter */}
            <div className="p-2.5 border-t border-border/70 bg-muted/30 text-center text-[11px] text-muted-foreground">
                Total {filteredPool.length} item tersedia di pustaka
            </div>
        </div>
    );
}
