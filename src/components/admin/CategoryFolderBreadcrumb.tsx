'use client';

import React from 'react';
import {
    ArrowLeft,
    ChevronRight,
    Folder,
    List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewDisplayMode = 'folder' | 'all';

export interface CategoryFolderBreadcrumbProps {
    resourceTitle: string;
    categoryName?: string;
    categoryCode?: string;
    categoryColor?: string | null;
    isUncategorized?: boolean;
    viewMode: ViewDisplayMode;
    onViewModeChange: (mode: ViewDisplayMode) => void;
    onBackToFolders: () => void;
    totalCategoryItems?: number;
    itemLabel?: string;
}

export function CategoryFolderBreadcrumb({
    resourceTitle,
    categoryName,
    categoryCode,
    categoryColor = '#0ea5e9',
    isUncategorized = false,
    viewMode,
    onViewModeChange,
    onBackToFolders,
    totalCategoryItems,
    itemLabel = 'item',
}: CategoryFolderBreadcrumbProps) {
    const activeColor = isUncategorized ? '#64748b' : categoryColor || '#0ea5e9';

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4 backdrop-blur-xs shadow-2xs">
            {/* Breadcrumb Path & Back Button */}
            <div className="flex flex-wrap items-center gap-2 min-w-0">
                {viewMode === 'folder' && categoryName && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onBackToFolders}
                        className="h-8 px-2.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    >
                        <ArrowLeft className="size-3.5 mr-1" />
                        Semua Kategori
                    </Button>
                )}

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <span className="font-medium text-foreground">{resourceTitle}</span>

                    {viewMode === 'folder' && categoryName && (
                        <>
                            <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                            {categoryCode && (
                                <span
                                    className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold font-mono uppercase tracking-wider border shadow-2xs shrink-0"
                                    style={{
                                        backgroundColor: `${activeColor}15`,
                                        color: activeColor,
                                        borderColor: `${activeColor}30`,
                                    }}
                                >
                                    {categoryCode}
                                </span>
                            )}
                            <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-[320px]">
                                {categoryName}
                            </span>
                        </>
                    )}

                    {viewMode === 'all' && (
                        <>
                            <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                            <span className="font-medium text-foreground">Semua Data</span>
                        </>
                    )}
                </div>

                {typeof totalCategoryItems === 'number' && (
                    <span className="text-[11px] text-muted-foreground ml-1">
                        ({totalCategoryItems} {itemLabel})
                    </span>
                )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center self-end sm:self-auto bg-muted/60 p-0.5 rounded-lg border border-border/50 text-xs shrink-0">
                <button
                    type="button"
                    onClick={() => onViewModeChange('folder')}
                    className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                        viewMode === 'folder'
                            ? 'bg-background text-foreground shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <Folder className="size-3.5" />
                    <span>Mode Folder</span>
                </button>
                <button
                    type="button"
                    onClick={() => onViewModeChange('all')}
                    className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                        viewMode === 'all'
                            ? 'bg-background text-foreground shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <List className="size-3.5" />
                    <span>Semua Data</span>
                </button>
            </div>
        </div>
    );
}
