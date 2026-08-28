'use client';

import { useState, useRef, useEffect } from 'react';
import { FileBadge2, X, UploadCloud, CheckCircle2, Loader2, Trash2, ExternalLink, ShieldCheck } from 'lucide-react';
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

    const isAlreadyUploaded = Boolean(participant?.certificate_file_url);

    useEffect(() => {
        if (participant) {
            setCertNumber(participant.certificate_number || '');
            setFileUrl(participant.certificate_file_url || null);
            setFileName(participant.certificate_file_url ? 'Berkas Sertifikat Resmi Aktif' : null);
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
            toast.error('Silakan pilih dan unggah berkas sertifikat terlebih dahulu.');
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
                    description: `Sertifikat untuk ${participant.full_name || participant.username} telah aktif dan dapat diunduh peserta.`,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="w-full max-w-lg overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-slate-900 flex flex-col"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-black/5 dark:border-white/5 px-6 py-4.5">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 shrink-0 shadow-xs">
                            <FileBadge2 className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold tracking-tight text-foreground">
                                {isAlreadyUploaded ? 'Kelola & Perbarui Sertifikat Resmi' : 'Upload Sertifikat Kelulusan'}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Terbitkan berkas sertifikat resmi (PDF / Gambar) untuk peserta.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    {/* Participant Summary */}
                    <div className="rounded-2xl border border-black/5 bg-slate-50/80 p-3.5 space-y-1 dark:border-white/5 dark:bg-slate-800/50 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-medium">Nama Peserta:</span>
                            {participant.nip && (
                                <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 text-[10px]">
                                    NIP: {participant.nip}
                                </span>
                            )}
                        </div>
                        <p className="font-bold text-sm text-foreground">
                            {participant.full_name || participant.username}
                        </p>
                    </div>

                    {/* Certificate Number Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                            Nomor Sertifikat Resmi <span className="text-muted-foreground font-normal">(Opsional)</span>
                        </label>
                        <input
                            type="text"
                            value={certNumber}
                            onChange={(e) => setCertNumber(e.target.value)}
                            placeholder="Contoh: CERT/2026/LMS-NC/0082"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono dark:border-slate-800 dark:bg-slate-950"
                        />
                    </div>

                    {/* File Upload Zone */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                            Berkas File Sertifikat (PDF / JPG / PNG) <span className="text-rose-500">*</span>
                        </label>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/webp"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {fileUrl ? (
                            <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                            <CheckCircle2 className="size-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                                                <ShieldCheck className="size-3" /> Berkas Siap Diterbitkan
                                            </span>
                                            <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100 truncate mt-1">
                                                {fileName || 'Berkas Sertifikat Resmi'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveFile}
                                        className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors shrink-0"
                                        title="Hapus / Ganti File"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-emerald-200/80 dark:border-emerald-800/50">
                                    <a
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:underline inline-flex items-center gap-1.5"
                                    >
                                        <ExternalLink className="size-3.5" />
                                        <span>Buka & Preview Berkas</span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white border border-emerald-300/80 px-2.5 py-1 rounded-lg transition-colors dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        Ganti File
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-amber-300/80 bg-amber-50/40 p-6 hover:border-amber-500 hover:bg-amber-50/70 cursor-pointer transition-all text-center dark:border-amber-800/60 dark:bg-amber-950/20 group"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="size-8 animate-spin text-amber-600" />
                                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Mengunggah file ke server...</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="size-11 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform dark:text-amber-400">
                                            <UploadCloud className="size-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground">
                                                Klik untuk memilih berkas sertifikat
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                Mendukung format PDF, PNG, atau JPG (Maksimal 15 MB)
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-black/5 dark:border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-100 text-foreground transition-colors dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={!fileUrl || isSaving || isUploading}
                            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Menerbitkan...</span>
                                </>
                            ) : (
                                <span>{isAlreadyUploaded ? 'Perbarui Sertifikat Resmi' : 'Terbitkan Sertifikat Resmi'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
