'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Users, Loader2, UserCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ClientPortal } from '@/components/ui/ClientPortal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TrainerItem {
    id: string;
    full_name: string;
    username: string;
    is_assigned: boolean;
    assigned_at?: string;
}

interface AssignTrainersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    categoryId: string;
    categoryName: string;
}

export function AssignTrainersModal({
    isOpen,
    onClose,
    onSuccess,
    categoryId,
    categoryName,
}: AssignTrainersModalProps) {
    const [trainers, setTrainers] = useState<TrainerItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch trainers data
    useEffect(() => {
        if (!isOpen || !categoryId) return;

        let isMounted = true;
        const fetchTrainers = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/categories/${categoryId}/trainers`);
                const json = await res.json();
                if (isMounted && json.success) {
                    setTrainers(json.data || []);
                    const initialSelected = new Set<string>();
                    (json.data || []).forEach((t: TrainerItem) => {
                        if (t.is_assigned) initialSelected.add(t.id);
                    });
                    setSelectedIds(initialSelected);
                }
            } catch {
                toast.error('Gagal mengambil daftar trainer');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchTrainers();
        return () => {
            isMounted = false;
        };
    }, [isOpen, categoryId]);

    // Body scroll lock & Escape key listener
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSaving) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, isSaving, onClose]);

    const filteredTrainers = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return trainers;
        return trainers.filter(
            (t) => t.full_name.toLowerCase().includes(q) || t.username.toLowerCase().includes(q)
        );
    }, [trainers, searchQuery]);

    if (!isOpen) return null;

    const toggleTrainer = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleAllFiltered = () => {
        const allFilteredSelected = filteredTrainers.length > 0 && filteredTrainers.every((t) => selectedIds.has(t.id));
        setSelectedIds((prev) => {
            const next = new Set(prev);
            filteredTrainers.forEach((t) => {
                if (allFilteredSelected) {
                    next.delete(t.id);
                } else {
                    next.add(t.id);
                }
            });
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/categories/${categoryId}/trainers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trainer_ids: Array.from(selectedIds),
                }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || 'Gagal menyimpan penugasan trainer');
                return;
            }

            toast.success(json.message || 'Penugasan trainer berhasil diperbarui');
            onSuccess();
            onClose();
        } catch {
            toast.error('Terjadi kesalahan jaringan');
        } finally {
            setIsSaving(false);
        }
    };

    const allFilteredAreSelected =
        filteredTrainers.length > 0 && filteredTrainers.every((t) => selectedIds.has(t.id));

    return (
        <ClientPortal>
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
                onClick={() => {
                    if (!isSaving) onClose();
                }}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="assign-modal-title"
                    className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/20 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                                <Users className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 id="assign-modal-title" className="text-base font-bold text-foreground truncate">
                                    Penugasan Trainer
                                </h2>
                                <p className="text-xs text-muted-foreground truncate max-w-sm">
                                    Kategori: <strong className="text-foreground">{categoryName}</strong>
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                            aria-label="Tutup modal"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    {/* Search & Selection Controls */}
                    <div className="p-4 border-b border-border/80 bg-card space-y-3 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari nama atau username trainer..."
                                className="w-full h-10 pl-10 pr-9 text-xs sm:text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
                                    title="Hapus pencarian"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="font-medium text-[11px]">
                                    {selectedIds.size} dari {trainers.length} Trainer Dipilih
                                </Badge>
                            </div>

                            {filteredTrainers.length > 0 && (
                                <button
                                    type="button"
                                    onClick={toggleAllFiltered}
                                    className="text-xs font-semibold text-primary hover:underline transition-colors"
                                >
                                    {allFilteredAreSelected ? 'Batalkan Semua' : 'Pilih Semua'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Trainer List (Scrollable Area) */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 max-h-[50vh]">
                        {isLoading ? (
                            <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
                                <Loader2 className="size-6 animate-spin text-primary" />
                                <p className="text-xs font-medium">Memuat data trainer terdaftar...</p>
                            </div>
                        ) : filteredTrainers.length === 0 ? (
                            <div className="py-14 text-center text-muted-foreground space-y-2">
                                <Users className="size-10 text-muted-foreground/30 mx-auto" />
                                <p className="text-sm font-semibold text-foreground">
                                    {searchQuery ? 'Tidak Ada Trainer yang Cocok' : 'Belum Ada Akun Trainer'}
                                </p>
                                <p className="text-xs max-w-xs mx-auto">
                                    {searchQuery
                                        ? 'Coba gunakan kata kunci pencarian nama atau username lain.'
                                        : 'Pastikan ada pengguna dengan role "trainer" yang sudah disetujui di sistem.'}
                                </p>
                            </div>
                        ) : (
                            filteredTrainers.map((t) => {
                                const isSelected = selectedIds.has(t.id);
                                return (
                                    <div
                                        key={t.id}
                                        onClick={() => toggleTrainer(t.id)}
                                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${
                                            isSelected
                                                ? 'border-primary/40 bg-primary/5 hover:bg-primary/10 shadow-2xs'
                                                : 'border-transparent hover:border-border hover:bg-muted/40'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className={`size-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors shadow-2xs ${
                                                    isSelected
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20 group-hover:text-foreground'
                                                }`}
                                            >
                                                {t.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">
                                                    {t.full_name}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>@{t.username}</span>
                                                    {t.assigned_at && (
                                                        <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
                                                            • Ditugaskan sejak {new Date(t.assigned_at).toLocaleDateString('id-ID')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            className={`size-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                                isSelected
                                                    ? 'bg-primary border-primary text-primary-foreground shadow-xs'
                                                    : 'border-muted-foreground/30 bg-background group-hover:border-primary/60'
                                            }`}
                                        >
                                            {isSelected && <Check className="size-3.5 stroke-[3]" />}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Notice bar */}
                    <div className="px-6 py-2.5 bg-blue-500/5 border-t border-blue-500/10 flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-300 shrink-0">
                        <ShieldCheck className="size-4 shrink-0 text-blue-500" />
                        <span>Trainer yang ditugaskan hanya dapat memantau dan mengakses sesi yang menggunakan modul di kategori ini.</span>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/80 bg-muted/20 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSaving}
                            className="rounded-xl"
                        >
                            Tutup
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="rounded-xl min-w-[150px]"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="size-4 animate-spin mr-1.5" />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <UserCheck className="size-4 mr-1.5" />
                                    <span>Simpan ({selectedIds.size})</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </ClientPortal>
    );
}
