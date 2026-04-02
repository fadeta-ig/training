'use client';

import { useState, useRef } from 'react';
import {
    VideoReplayIcon,
    Image01Icon,
    File01Icon,
    Delete02Icon,
    PlusSignIcon,
    Cancel01Icon,
    Loading03Icon,
    LinkSquare01Icon,
} from 'hugeicons-react';

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

const TYPE_CONFIG: Record<MediaItem['media_type'], { label: string; Icon: React.ComponentType<any>; color: string }> = {
    video: { label: 'Video', Icon: VideoReplayIcon, color: 'text-red-500 bg-red-50' },
    image: { label: 'Gambar', Icon: Image01Icon, color: 'text-blue-500 bg-blue-50' },
    pdf: { label: 'PDF', Icon: File01Icon, color: 'text-orange-500 bg-orange-50' },
    document: { label: 'Dokumen', Icon: File01Icon, color: 'text-violet-500 bg-violet-50' },
};

const ACCEPT_MAP: Record<string, string> = {
    image: 'image/jpeg,image/png,image/gif,image/webp',
    pdf: 'application/pdf',
    document: '.doc,.docx,.ppt,.pptx',
};

/**
 * Reusable admin UI for adding/removing media attachments on a training.
 * Supports YouTube videos (by link) and uploaded files (images, PDFs, documents).
 */
export default function MediaAttachmentManager({ items, onChange }: MediaAttachmentManagerProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [videoUrlInput, setVideoUrlInput] = useState('');
    const [showVideoInput, setShowVideoInput] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<'image' | 'pdf' | 'document' | null>(null);

    const addItem = (item: MediaItem) => {
        onChange([...items, item]);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

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
    };

    const triggerUpload = (type: 'image' | 'pdf' | 'document') => {
        setUploadTarget(type);
        setShowMenu(false);
        // Defer to let state settle
        setTimeout(() => fileInputRef.current?.click(), 50);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Upload gagal');
            }

            addItem({
                media_type: result.media_type || uploadTarget,
                media_url: result.url,
                original_filename: result.original_filename || file.name,
            });
        } catch (err: any) {
            alert(err.message || 'Gagal mengunggah file');
        } finally {
            setUploading(false);
            setUploadTarget(null);
            // Reset input so the same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-foreground">
                    Media Lampiran <span className="text-muted-foreground font-normal">(Opsional)</span>
                </label>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => { setShowMenu(!showMenu); setShowVideoInput(false); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors active:scale-95"
                    >
                        <PlusSignIcon size={14} />
                        Tambah Media
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-black/10 shadow-lg z-20 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                                type="button"
                                onClick={() => { setShowVideoInput(true); setShowMenu(false); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-black/5 transition-colors"
                            >
                                <LinkSquare01Icon size={15} className="text-red-500" />
                                Link YouTube
                            </button>
                            <button
                                type="button"
                                onClick={() => triggerUpload('image')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-black/5 transition-colors"
                            >
                                <Image01Icon size={15} className="text-blue-500" />
                                Upload Gambar
                            </button>
                            <button
                                type="button"
                                onClick={() => triggerUpload('pdf')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-black/5 transition-colors"
                            >
                                <File01Icon size={15} className="text-orange-500" />
                                Upload PDF
                            </button>
                            <button
                                type="button"
                                onClick={() => triggerUpload('document')}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-black/5 transition-colors"
                            >
                                <File01Icon size={15} className="text-violet-500" />
                                Upload Dokumen
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* YouTube URL input */}
            {showVideoInput && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-black/10 bg-white/60">
                    <input
                        type="url"
                        placeholder="https://youtube.com/watch?v=..."
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        className="flex-1 glass-input px-3 py-2 rounded-lg text-xs focus:outline-none"
                        autoFocus
                    />
                    <button
                        type="button"
                        onClick={handleAddVideo}
                        disabled={!videoUrlInput.trim()}
                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40"
                    >
                        Tambah
                    </button>
                    <button
                        type="button"
                        onClick={() => { setShowVideoInput(false); setVideoUrlInput(''); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Cancel01Icon size={14} />
                    </button>
                </div>
            )}

            {/* Uploading state */}
            {uploading && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-black/10 bg-white/60 text-xs text-muted-foreground">
                    <Loading03Icon size={14} className="animate-spin" />
                    Mengunggah file...
                </div>
            )}

            {/* Listed media items */}
            {items.length > 0 && (
                <div className="space-y-2">
                    {items.map((item, idx) => {
                        const config = TYPE_CONFIG[item.media_type];
                        const IconComp = config.Icon;
                        return (
                            <div
                                key={`${item.media_url}-${idx}`}
                                className="flex items-center gap-3 p-3 rounded-xl border border-black/5 bg-white/80 group hover:border-black/10 transition-colors"
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                                    <IconComp size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">{item.original_filename || item.media_url}</p>
                                    <p className="text-[10px] text-muted-foreground">{config.label}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeItem(idx)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Delete02Icon size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={uploadTarget ? ACCEPT_MAP[uploadTarget] : ''}
                onChange={handleFileChange}
            />
        </div>
    );
}
