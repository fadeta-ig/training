'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    PlusSignIcon,
    Cancel01Icon,
    Loading03Icon,
    LinkSquare01Icon,
    Image01Icon,
    File01Icon,
} from 'hugeicons-react';
import { UploadCloud, GripVertical } from 'lucide-react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { SortableMediaItem } from './SortableMediaItem';
import { toast } from 'sonner';

/** Represents a single media attachment in the form state */
export interface MediaItem {
    media_type: 'video' | 'image' | 'pdf' | 'document';
    media_url: string;
    original_filename: string;
}

interface MediaAttachmentManagerProps {
    items: MediaItem[];
    onChange: (items: MediaItem[]) => void;
}

const ACCEPT_MAP: Record<string, string> = {
    image: 'image/jpeg,image/png,image/gif,image/webp',
    pdf: 'application/pdf',
    document: '.doc,.docx,.ppt,.pptx',
};

/**
 * Reusable admin UI for adding, removing, and reordering media attachments on training materials.
 * Supports drag-and-drop reordering, direct OS file drop upload, YouTube links, and multi-file uploads.
 */
export default function MediaAttachmentManager({ items, onChange }: MediaAttachmentManagerProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [videoUrlInput, setVideoUrlInput] = useState('');
    const [showVideoInput, setShowVideoInput] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isDraggingFileOver, setIsDraggingFileOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<'image' | 'pdf' | 'document' | null>(null);

    // Global monitor for drag-and-drop reordering
    useEffect(() => {
        return monitorForElements({
            onDrop: ({ source, location }) => {
                const destination = location.current.dropTargets[0];
                if (!destination) return;

                const sourceIndex = source.data.index as number;
                const destIndex = destination.data.index as number;
                if (
                    source.data.type !== 'media-item' ||
                    destination.data.type !== 'media-item' ||
                    sourceIndex === undefined ||
                    destIndex === undefined ||
                    sourceIndex === destIndex
                ) {
                    return;
                }

                const edge = extractClosestEdge(destination.data);
                const updated = [...items];
                const [moved] = updated.splice(sourceIndex, 1);
                const targetIndex = edge === 'top' ? destIndex : destIndex + 1;
                const finalIndex = sourceIndex < destIndex ? targetIndex - 1 : targetIndex;
                updated.splice(finalIndex, 0, moved);
                onChange(updated);
            },
        });
    }, [items, onChange]);

    const addItem = useCallback((item: MediaItem) => {
        onChange([...items, item]);
    }, [items, onChange]);

    const removeItem = useCallback((index: number) => {
        onChange(items.filter((_, i) => i !== index));
    }, [items, onChange]);

    const handleMoveUp = useCallback((index: number) => {
        if (index <= 0) return;
        const updated = [...items];
        const [moved] = updated.splice(index, 1);
        updated.splice(index - 1, 0, moved);
        onChange(updated);
    }, [items, onChange]);

    const handleMoveDown = useCallback((index: number) => {
        if (index >= items.length - 1) return;
        const updated = [...items];
        const [moved] = updated.splice(index, 1);
        updated.splice(index + 1, 0, moved);
        onChange(updated);
    }, [items, onChange]);

    const handleAddVideo = () => {
        if (!videoUrlInput.trim()) return;

        addItem({
            media_type: 'video',
            media_url: videoUrlInput.trim(),
            original_filename: 'YouTube Video',
        });
        setVideoUrlInput('');
        setShowVideoInput(false);
        setShowMenu(false);
        toast.success('Video YouTube berhasil ditambahkan');
    };

    const triggerUpload = (type: 'image' | 'pdf' | 'document') => {
        setUploadTarget(type);
        setShowMenu(false);
        setTimeout(() => fileInputRef.current?.click(), 50);
    };

    const uploadSingleFile = async (file: File): Promise<MediaItem | null> => {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await res.json();

        if (!result.success) {
            throw new Error(result.error || `Upload gagal untuk ${file.name}`);
        }

        return {
            media_type: result.media_type,
            media_url: result.url,
            original_filename: result.original_filename || file.name,
        };
    };

    const handleFilesUpload = async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        setUploading(true);
        const uploaded: MediaItem[] = [];
        let failedCount = 0;

        for (const file of fileArray) {
            try {
                const item = await uploadSingleFile(file);
                if (item) uploaded.push(item);
            } catch (err: unknown) {
                failedCount++;
                const message = err instanceof Error ? err.message : 'Gagal mengunggah file';
                toast.error(message);
            }
        }

        if (uploaded.length > 0) {
            onChange([...items, ...uploaded]);
            toast.success(`${uploaded.length} file berhasil diunggah`);
        }

        setUploading(false);
        setUploadTarget(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFilesUpload(e.target.files);
        }
    };

    // Native Drag and drop upload from OS explorer
    const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setIsDraggingFileOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only trigger if leaving the drop container entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingFileOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            setIsDraggingFileOver(false);
            handleFilesUpload(e.dataTransfer.files);
        }
    };

    return (
        <div
            className={`space-y-3 rounded-2xl transition-all ${
                isDraggingFileOver
                    ? 'ring-2 ring-blue-500 bg-blue-50/40 p-3 -m-3 border-dashed border-blue-400'
                    : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <label className="text-sm font-bold text-foreground">
                        Media Lampiran <span className="text-muted-foreground font-normal">(Opsional)</span>
                    </label>
                    {items.length > 1 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Tahan dan geser ikon <GripVertical className="inline size-3 text-slate-400" /> untuk mengatur urutan file lampiran.
                        </p>
                    )}
                </div>

                <div className="relative self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => { setShowMenu(!showMenu); setShowVideoInput(false); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    >
                        <PlusSignIcon size={14} />
                        Tambah Media
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl border border-black/10 shadow-xl z-30 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                                type="button"
                                onClick={() => { setShowVideoInput(true); setShowMenu(false); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-foreground hover:bg-slate-50 transition-colors"
                            >
                                <LinkSquare01Icon size={16} className="text-red-500" />
                                Link YouTube
                            </button>
                            <button
                                type="button"
                                onClick={() => triggerUpload('image')}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-foreground hover:bg-slate-50 transition-colors"
                            >
                                <Image01Icon size={16} className="text-blue-500" />
                                Upload Gambar
                            </button>
                            <button
                                type="button"
                                onClick={() => triggerUpload('pdf')}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-foreground hover:bg-slate-50 transition-colors"
                            >
                                <File01Icon size={16} className="text-orange-500" />
                                Upload PDF
                            </button>
                            <button
                                type="button"
                                onClick={() => triggerUpload('document')}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-foreground hover:bg-slate-50 transition-colors"
                            >
                                <File01Icon size={16} className="text-violet-500" />
                                Upload Dokumen (PPT / Word)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* YouTube URL input */}
            {showVideoInput && (
                <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/80 p-3 sm:flex-row sm:items-center shadow-xs animate-in fade-in">
                    <input
                        type="url"
                        placeholder="https://youtube.com/watch?v=... atau https://youtu.be/..."
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        className="min-w-0 flex-1 glass-input px-3.5 py-2.5 rounded-xl text-xs focus:outline-none"
                        autoFocus
                    />
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleAddVideo}
                            disabled={!videoUrlInput.trim()}
                            className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
                        >
                            Simpan Video
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowVideoInput(false); setVideoUrlInput(''); }}
                            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-black/5 transition-colors"
                            title="Batal"
                        >
                            <Cancel01Icon size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Uploading state */}
            {uploading && (
                <div className="flex items-center gap-2 p-3 rounded-2xl border border-blue-200 bg-blue-50/80 text-xs text-blue-900 animate-in fade-in">
                    <Loading03Icon size={16} className="animate-spin text-blue-600" />
                    <span>Mengunggah file ke server...</span>
                </div>
            )}

            {/* Listed sortable media items */}
            {items.length > 0 ? (
                <div className="space-y-2">
                    {items.map((item, idx) => (
                        <SortableMediaItem
                            key={`${item.media_url}-${idx}`}
                            item={item}
                            index={idx}
                            totalCount={items.length}
                            onRemove={removeItem}
                            onMoveUp={handleMoveUp}
                            onMoveDown={handleMoveDown}
                        />
                    ))}
                </div>
            ) : (
                <div
                    onClick={() => setShowMenu(true)}
                    className="border-2 border-dashed border-black/10 rounded-2xl p-6 text-center cursor-pointer hover:border-black/20 hover:bg-black/[0.02] transition-colors"
                >
                    <UploadCloud className="size-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-foreground">
                        Tarik & lepas file ke sini, atau klik untuk memilih media
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Mendukung PDF, PPT, PPTX, Word, Gambar, atau Link YouTube
                    </p>
                </div>
            )}

            {/* Hidden multi-file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept={uploadTarget ? ACCEPT_MAP[uploadTarget] : ''}
                onChange={handleFileChange}
            />
        </div>
    );
}
