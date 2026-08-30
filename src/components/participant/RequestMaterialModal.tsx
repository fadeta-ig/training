'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, LockKeyhole, X, MessageSquare, Info } from 'lucide-react';
import { toast } from 'sonner';
import { ClientPortal } from '@/components/ui/ClientPortal';

interface RequestMaterialModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionTitle: string;
    moduleTitle?: string;
    itemTitle?: string;
    participantName?: string;
    sessionSchedule?: string;
}

export function RequestMaterialModal({
    isOpen,
    onClose,
    sessionTitle,
    moduleTitle,
    itemTitle,
    participantName,
    sessionSchedule,
}: RequestMaterialModalProps) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const messageTemplate = `Halo Bapak/Ibu Trainer & Panitia Pelatihan,

Saya bermaksud mengajukan permohonan salinan materi pembelajaran berikut:
• Sesi Pelatihan: ${sessionTitle}
• Materi / Modul: ${itemTitle ? `${itemTitle} (${moduleTitle || 'Modul Pelatihan'})` : (moduleTitle || 'Materi Pelatihan')}
• Nama Peserta: ${participantName || 'Peserta Pelatihan'}
${sessionSchedule ? `• Jadwal Sesi: ${sessionSchedule}\n` : ''}
Dikarenakan jadwal sesi pelatihan telah berakhir di portal LMS, modul materi telah terkunci. Saya bermaksud meminta dokumen materi tersebut untuk kebutuhan pembelajaran mandiri dan arsip.

Terima kasih banyak atas perhatian dan bantuannya.`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(messageTemplate);
            setCopied(true);
            toast.success('Format pesan permohonan materi berhasil disalin ke clipboard!');
            setTimeout(() => setCopied(false), 3000);
        } catch {
            toast.error('Gagal menyalin otomatis. Silakan salin teks secara manual.');
        }
    };

    return (
        <ClientPortal>
            <div 
                className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-background shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 flex flex-col"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="request-material-modal-title"
                    onClick={(e) => e.stopPropagation()}
                >
                {/* Header */}
                <div className="flex items-start justify-between border-b px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 shrink-0">
                            <LockKeyhole className="size-5" />
                        </div>
                        <div>
                            <h2 id="request-material-modal-title" className="text-base font-semibold tracking-tight text-foreground">
                                Permohonan Materi Pelatihan
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Sesi telah berakhir. Salin format pesan untuk diajukan ke Trainer / Panitia.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Tutup dialog"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="overflow-y-auto px-5 py-4 sm:px-6 space-y-4">
                    <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
                        <Info className="size-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                        <div className="leading-relaxed">
                            Akses materi ditutup otomatis sesuai batas waktu sesi. Silakan salin format pesan di bawah ini dan kirimkan melalui <strong>WhatsApp Grup</strong>, <strong>chat panitia</strong>, atau <strong>email resmi</strong> Anda.
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <MessageSquare className="size-3.5" /> Template Pesan Siap Kirim
                            </label>
                            <span className="text-[11px] text-muted-foreground">Teks Terformat</span>
                        </div>
                        <div className="relative">
                            <pre className="w-full whitespace-pre-wrap rounded-xl border border-black/10 bg-muted/40 p-3.5 text-xs font-mono leading-relaxed text-foreground select-all dark:border-white/10 dark:bg-muted/20">
                                {messageTemplate}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-5 py-3.5 dark:bg-muted/10 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl border border-input bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
                    >
                        Tutup
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-98 sm:w-auto"
                    >
                        {copied ? (
                            <>
                                <Check className="size-4 text-emerald-300" />
                                <span>Pesan Tersalin!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="size-4" />
                                <span>Salin Template Pesan</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
        </ClientPortal>
    );
}
