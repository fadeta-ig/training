'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Search, X, ChevronDown, ArrowUpDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
    label: string;
    value: string;
}

export interface FilterItemConfig {
    id: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
}

export interface SortOption {
    label: string;
    value: string;
}

export interface LearningFilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    filters?: FilterItemConfig[];
    sort: string;
    onSortChange: (value: string) => void;
    sortOptions: SortOption[];
    onReset: () => void;
    totalItems?: number;
    itemLabel?: string;
    className?: string;
    children?: React.ReactNode;
}

export function LearningFilterBar({
    search,
    onSearchChange,
    searchPlaceholder = 'Cari...',
    filters = [],
    sort,
    onSortChange,
    sortOptions,
    onReset,
    totalItems,
    itemLabel = 'data',
    className,
    children,
}: LearningFilterBarProps) {
    const [inputValue, setInputValue] = useState(search);
    const [, startTransition] = useTransition();

    // Sync input value if parent search changes externally (e.g. after reset)
    useEffect(() => {
        setInputValue(search);
    }, [search]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputValue !== search) {
                startTransition(() => {
                    onSearchChange(inputValue);
                });
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [inputValue, search, onSearchChange]);

    const handleClearSearch = () => {
        setInputValue('');
        onSearchChange('');
    };

    const defaultSortValue = sortOptions[0]?.value || 'created_desc';
    const activeFiltersCount =
        filters.filter((f) => f.value !== 'all' && f.value !== '').length +
        (search.trim() ? 1 : 0) +
        (sort !== defaultSortValue ? 1 : 0);

    return (
        <div className={cn('space-y-2.5', className)}>
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full h-10 pl-10 pr-9 text-xs sm:text-sm rounded-xl border border-input bg-background/80 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                    {inputValue && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                            title="Hapus pencarian"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>

                {/* Filter and Sort Dropdowns */}
                <div className="flex flex-wrap items-center gap-2">
                    {filters.map((filter) => {
                        const isActive = filter.value !== 'all' && filter.value !== '';
                        return (
                            <div key={filter.id} className="relative min-w-[130px] flex-1 sm:flex-initial">
                                <select
                                    value={filter.value}
                                    onChange={(e) => filter.onChange(e.target.value)}
                                    className={cn(
                                        'w-full h-10 pl-3 pr-8 text-xs font-medium rounded-xl border bg-background text-foreground transition-all cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-ring',
                                        isActive
                                            ? 'border-primary/50 bg-primary/5 font-semibold text-primary'
                                            : 'border-input hover:border-input/80'
                                    )}
                                    aria-label={filter.label}
                                >
                                    {filter.options.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                            </div>
                        );
                    })}

                    {/* Sort Dropdown */}
                    <div className="relative min-w-[150px] flex-1 sm:flex-initial">
                        <select
                            value={sort}
                            onChange={(e) => onSortChange(e.target.value)}
                            className={cn(
                                'w-full h-10 pl-8 pr-8 text-xs font-medium rounded-xl border bg-background text-foreground transition-all cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-ring',
                                sort !== defaultSortValue
                                    ? 'border-primary/50 bg-primary/5 font-semibold text-primary'
                                    : 'border-input hover:border-input/80'
                            )}
                            aria-label="Urutkan berdasarkan"
                        >
                            {sortOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Reset Button */}
                    {activeFiltersCount > 0 && (
                        <button
                            type="button"
                            onClick={onReset}
                            className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border border-dashed border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                            title="Reset semua filter dan pencarian"
                        >
                            <RotateCcw className="size-3.5" />
                            <span>Reset</span>
                            <span className="size-4 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold flex items-center justify-center">
                                {activeFiltersCount}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Total Indicator & Active Filters Bar */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5 pt-0.5">
                <div className="flex items-center gap-2">
                    {totalItems !== undefined && (
                        <span>
                            Menampilkan <strong className="text-foreground">{totalItems}</strong> {itemLabel}
                        </span>
                    )}
                    {activeFiltersCount > 0 && (
                        <span className="text-[11px] text-primary font-medium">
                            • {activeFiltersCount} kriteria aktif
                        </span>
                    )}
                </div>

                {children && <div className="shrink-0">{children}</div>}
            </div>
        </div>
    );
}
