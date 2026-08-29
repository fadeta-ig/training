'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
    VideoReplayIcon,
    Image01Icon,
    File01Icon,
    Delete02Icon,
    ArrowUp01Icon,
    ArrowDown01Icon,
} from 'hugeicons-react';
import { GripVertical } from 'lucide-react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
    attachClosestEdge,
    extractClosestEdge,
    type Edge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { MediaItem } from './MediaAttachmentManager';

const TYPE_CONFIG: Record<
    MediaItem['media_type'],
    { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; color: string; badgeBg: string }
> = {
    video: { label: 'Video', Icon: VideoReplayIcon, color: 'text-red-600 bg-red-50 border-red-200/80', badgeBg: 'bg-red-50 text-red-700' },
    image: { label: 'Gambar', Icon: Image01Icon, color: 'text-blue-600 bg-blue-50 border-blue-200/80', badgeBg: 'bg-blue-50 text-blue-700' },
    pdf: { label: 'PDF', Icon: File01Icon, color: 'text-orange-600 bg-orange-50 border-orange-200/80', badgeBg: 'bg-orange-50 text-orange-700' },
    document: { label: 'Dokumen', Icon: File01Icon, color: 'text-violet-600 bg-violet-50 border-violet-200/80', badgeBg: 'bg-violet-50 text-violet-700' },
};

interface SortableMediaItemProps {
    item: MediaItem;
    index: number;
    totalCount: number;
    onRemove: (index: number) => void;
    onMoveUp?: (index: number) => void;
    onMoveDown?: (index: number) => void;
}

export function SortableMediaItem({
    item,
    index,
    totalCount,
    onRemove,
    onMoveUp,
    onMoveDown,
}: SortableMediaItemProps) {
    const itemRef = useRef<HTMLDivElement>(null);
    const dragHandleRef = useRef<HTMLButtonElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    const config = TYPE_CONFIG[item.media_type] || TYPE_CONFIG.document;
    const IconComp = config.Icon;

    useEffect(() => {
        const itemEl = itemRef.current;
        const handleEl = dragHandleRef.current;
        if (!itemEl || !handleEl) return;

        const cleanups: Array<() => void> = [];

        cleanups.push(
            draggable({
                element: handleEl,
                getInitialData: () => ({ index, type: 'media-item' }),
                onDragStart: () => setIsDragging(true),
                onDrop: () => {
                    setIsDragging(false);
                    setClosestEdge(null);
                },
            })
        );

        cleanups.push(
            dropTargetForElements({
                element: itemEl,
                canDrop: ({ source }) => {
                    return source.data.type === 'media-item' && source.data.index !== index;
                },
                getData: ({ input, element }) => {
                    const data = { index, type: 'media-item' };
                    return attachClosestEdge(data, {
                        element,
                        input,
                        allowedEdges: ['top', 'bottom'],
                    });
                },
                onDragEnter: (args) => {
                    const edge = extractClosestEdge(args.self.data);
                    setClosestEdge(edge);
                },
                onDrag: (args) => {
                    const edge = extractClosestEdge(args.self.data);
                    setClosestEdge(edge);
                },
                onDragLeave: () => {
                    setClosestEdge(null);
                },
                onDrop: () => {
                    setClosestEdge(null);
                },
            })
        );

        return () => {
            cleanups.forEach((cleanup) => cleanup());
        };
    }, [index]);

    return (
        <div ref={itemRef} className="relative transition-all duration-150">
            {/* Drop indicators */}
            {closestEdge === 'top' && (
                <div className="absolute -top-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-20 shadow-xs animate-pulse" />
            )}
            {closestEdge === 'bottom' && (
                <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-20 shadow-xs animate-pulse" />
            )}

            <div
                className={`flex items-center gap-3 p-3 rounded-2xl border bg-white/90 shadow-2xs group transition-all ${
                    isDragging
                        ? 'opacity-40 border-dashed border-blue-400 scale-[0.99] shadow-sm'
                        : closestEdge
                        ? 'ring-2 ring-blue-500/40 border-blue-300 bg-blue-50/30'
                        : 'border-black/10 hover:border-black/20 hover:shadow-xs'
                }`}
            >
                {/* Drag Handle */}
                <button
                    ref={dragHandleRef}
                    type="button"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors shrink-0"
                    title="Tahan dan geser untuk mengatur urutan materi"
                    aria-label={`Geser posisi item ${index + 1}`}
                >
                    <GripVertical className="size-4.5" />
                </button>

                {/* Sequence badge */}
                <div className="size-6 rounded-lg bg-slate-100 border border-black/5 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0">
                    {index + 1}
                </div>

                {/* File Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${config.color}`}>
                    <IconComp size={18} />
                </div>

                {/* File Details */}
                <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate" title={item.original_filename || item.media_url}>
                        {item.original_filename || item.media_url}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${config.badgeBg}`}>
                            {config.label}
                        </span>
                        {item.media_type === 'video' && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {item.media_url}
                            </span>
                        )}
                    </div>
                </div>

                {/* Quick actions (Move Up/Down & Remove) */}
                <div className="flex items-center gap-1 shrink-0">
                    {onMoveUp && index > 0 && (
                        <button
                            type="button"
                            onClick={() => onMoveUp(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors hidden sm:inline-flex"
                            title="Pindah urutan ke atas"
                        >
                            <ArrowUp01Icon size={14} />
                        </button>
                    )}
                    {onMoveDown && index < totalCount - 1 && (
                        <button
                            type="button"
                            onClick={() => onMoveDown(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors hidden sm:inline-flex"
                            title="Pindah urutan ke bawah"
                        >
                            <ArrowDown01Icon size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onRemove(index)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Hapus ${item.original_filename || config.label}`}
                        title="Hapus lampiran"
                    >
                        <Delete02Icon size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
