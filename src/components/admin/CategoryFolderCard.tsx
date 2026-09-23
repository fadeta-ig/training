'use client';

import React from 'react';
import {
    Folder,
    FolderOpen,
    ArrowRight,
    BookOpen,
    FileQuestion,
    Boxes,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type CategoryResourceType = 'training' | 'exam' | 'module';

export interface CategoryFolderCardProps {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    color?: string | null;
    isActive?: boolean;
    itemCount: number;
    resourceType: CategoryResourceType;
    isUncategorized?: boolean;
    onOpen: (id: string) => void;
}

const RESOURCE_LABELS: Record<CategoryResourceType, { singular: string; plural: string; icon: React.ElementType }> = {
    training: { singular: 'Materi', plural: 'Materi Pelatihan', icon: BookOpen },
    exam: { singular: 'Ujian', plural: 'Paket Ujian', icon: FileQuestion },
    module: { singular: 'Modul', plural: 'Modul Pembelajaran', icon: Boxes },
};

export function CategoryFolderCard({
    id,
    name,
    code,
    description,
    color,
    isActive = true,
    itemCount,
    resourceType,
    isUncategorized = false,
    onOpen,
}: CategoryFolderCardProps) {
    const activeColor = color || (isUncategorized ? '#64748b' : '#0ea5e9');
    const { plural, icon: ResourceIcon } = RESOURCE_LABELS[resourceType];

    return (
        <Card
            onClick={() => onOpen(id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(id);
                }
            }}
            className={cn(
                'group relative flex flex-col justify-between overflow-hidden border border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer select-none text-left',
                'hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary'
            )}
        >
            {/* Top Color Accent Line */}
            <div
                className="h-1 w-full transition-all duration-200 group-hover:h-1.5"
                style={{ backgroundColor: activeColor }}
            />

            <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    {/* Folder Icon & Code Badge */}
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="flex size-9 items-center justify-center rounded-lg border transition-colors shadow-2xs group-hover:scale-105"
                            style={{
                                backgroundColor: `${activeColor}15`,
                                borderColor: `${activeColor}30`,
                                color: activeColor,
                            }}
                        >
                            <Folder className="size-5 transition-transform group-hover:hidden" />
                            <FolderOpen className="size-5 hidden transition-transform group-hover:block" />
                        </div>

                        <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider border shadow-2xs"
                            style={{
                                backgroundColor: `${activeColor}12`,
                                color: activeColor,
                                borderColor: `${activeColor}28`,
                            }}
                        >
                            {code}
                        </span>
                    </div>

                    {/* Status Badge */}
                    {isUncategorized ? (
                        <Badge variant="outline" className="text-[10px] font-medium h-5 px-2 border-dashed">
                            Tanpa Kategori
                        </Badge>
                    ) : (
                        <Badge
                            variant={isActive ? 'success' : 'secondary'}
                            className="text-[10px] font-semibold h-5 px-2"
                        >
                            {isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                    )}
                </div>

                {/* Title & Description */}
                <div>
                    <CardTitle className="text-base font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {name}
                    </CardTitle>
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 min-h-[2rem] leading-relaxed">
                        {description || 'Tidak ada deskripsi cakupan kategori.'}
                    </p>
                </div>
            </CardHeader>

            <CardContent className="px-4 sm:px-5 py-2.5 border-t border-border/40 bg-muted/20">
                <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                        <ResourceIcon className="size-3.5" style={{ color: activeColor }} />
                        <span>{plural}:</span>
                    </span>
                    <span className="font-bold text-foreground">
                        {itemCount} {RESOURCE_LABELS[resourceType].singular}
                    </span>
                </div>
            </CardContent>

            <CardFooter className="px-4 sm:px-5 py-2.5 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground group-hover:text-foreground">
                <span className="text-[11px]">Buka folder ini</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary text-[11px] transition-transform group-hover:translate-x-1">
                    Masuk
                    <ArrowRight className="size-3" />
                </span>
            </CardFooter>
        </Card>
    );
}
