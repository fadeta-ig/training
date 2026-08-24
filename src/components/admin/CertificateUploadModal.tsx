'use client';

import { useState, useRef, useEffect } from 'react';
import { FileBadge2, X, UploadCloud, CheckCircle2, FileText, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CertificateUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    sessionId: string;
    participant: {
        id: string; // userId
        full_name?: string;
        username: string;
        nip?: string | null;
        certificate_file_url?: string | null;
        certificate_number?: string | null;
    } | null;
}

export function CertificateUploadModal({
    isOpen,
    onClose,
    onSuccess,
    sessionId,
    participant,
}: CertificateUploadModalProps) {
    const [certNumber, setCertNumber] = useState('');
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (participant) {
            setCertNumber(participant.certificate_number || '');
            setFileUrl(participant.certificate_file_url || null);
            setFileName(participant.certificate_file_url ? 'Sertifikat Resmi Terdaftar' : null);
        }
    }, [participant]);

    if (!isOpen || !participant) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (file.size > 15 * 1024 * 1024) {
            toast.error('Ukuran file maksimal adalah 15 MB.');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setFileUrl(data.url);
                setFileName(file.name);
                toast.success('Berkas sertifikat berhasil diunggah!');
            } else {
                toast.error(data.error || 'Gagal mengunggah file.');
            }
        } catch {
            toast.error('Gagal terhubung ke server upload.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fileUrl) {
            toast.error('Silakan unggah file sertifikat resmi terlebih dahulu.');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(
                `/api/admin/sessions/${sessionId}/participants/${participant.id}/graduation`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        graduation_status: 'passed',
                        certificate_file_url: fileUrl,
                        certificate_number: certNumber.trim() || null,
                    }),
                }
            );
            const data = await res.json();

            if (res.ok && data.success) {
                toast.success('Sertifikat Resmi Berhasil Diterbitkan!', {
                    description: `Sertifikat untuk ${participant.full_name || participant.username} telah aktif.`,
                });
                onSuccess();
                onClose();
            } else {
                toast.error(data.error || 'Gagal menyimpan data sertifikat.');
            }
        } catch {
            toast.error('Gagal terhubung ke server.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveFile = () => {
        setFileUrl(null);
        setFileName(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-background shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 flex flex-col"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b px-6 py-4.5">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 shrink-0">
                            <FileBadge2 className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold tracking-tight text-foreground">
                                Upload Sertifikat Resmi
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Terbitkan file sertifikat resmi (PDF / Gambar) untuk peserta.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    {/* Participant Summary */}
                    <div className="rounded-xl border border-black/5 bg-muted/40 p-3.5 space-y-1 dark:border-white/5 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span>Nama Peserta:</span>
                            {participant.nip && <span className="font-mono">NIP: {participant.nip}</span>}
                        </div>
                        <p className="font-semibold text-sm text-foreground">
                            {participant.full_name || participant.username}
                        </p>
                    </div>

                    {/* Certificate Number Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Nomor Sertifikat Resmi <span className="text-muted-foreground">(Opsional)</span>
                        </label>
                        <input
                            type="text"
                            value={certNumber}
                            onChange={(e) => setCertNumber(e.target.value)}
                            placeholder="Contoh: CERT/2026/LMS-NC/0082"
                            className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                        />
                    </div>

                    {/* File Upload Zone */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Berkas File Sertifikat (PDF / JPG / PNG) <span className="text-destructive">*</span>
                        </label>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/webp"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {fileUrl ? (
                            <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/60 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="size-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-emerald-950 dark:text-emerald-200 truncate">
                                            {fileName || 'File Sertifikat'}
                                        </p>
                                        <a
                                            href={fileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                                        >
                                            <FileText className="size-3" />
                                            Lihat File yang Diunggah
                                        </a>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                    title="Hapus / Ganti File"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input p-6 hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-all text-center"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="size-8 animate-spin text-primary" />
                                        <p className="text-xs text-muted-foreground">Mengunggah file...</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                            <UploadCloud className="size-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-foreground">
                                                Klik untuk memilih file sertifikat
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                Mendukung format PDF, PNG, atau JPG (Maks 15 MB)
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-xl border border-input hover:bg-muted text-foreground transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={!fileUrl || isSaving || isUploading}
                            className="w-full sm:w-auto px-5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'Menerbitkan...' : 'Terbitkan Sertifikat Resmi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
