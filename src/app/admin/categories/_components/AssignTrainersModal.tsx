'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
        const allFilteredSelected = filteredTrainers.every((t) => selectedIds.has(t.id));
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Users size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-foreground">Penugasan Pengajar (Trainer)</h2>
                            <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-sm">
                                Kategori: <span className="font-semibold text-foreground">{categoryName}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search Bar & Stats */}
                <div className="p-4 border-b border-border space-y-3 bg-card shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama atau username trainer..."
                            className="w-full h-9 pl-9 pr-4 text-xs sm:text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            <strong className="text-foreground">{selectedIds.size}</strong> dari {trainers.length} trainer dipilih
                        </span>
                        {filteredTrainers.length > 0 && (
                            <button
                                type="button"
                                onClick={toggleAllFiltered}
                                className="text-primary hover:underline font-medium"
                            >
                                {filteredTrainers.every((t) => selectedIds.has(t.id))
                                    ? 'Batalkan Semua'
                                    : 'Pilih Semua'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Trainer List */}
                <div className="flex-1 overflow-y-auto p-4 divide-y divide-border/60">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 size={24} className="animate-spin text-primary" />
                            <p className="text-xs">Memuat daftar trainer...</p>
                        </div>
                    ) : filteredTrainers.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground space-y-1">
                            <p className="text-sm font-medium">Tidak ada trainer ditemukan</p>
                            <p className="text-xs">
                                {searchQuery
                                    ? 'Coba gunakan kata kunci pencarian yang berbeda'
                                    : 'Belum ada pengguna dengan peran trainer di sistem'}
                            </p>
                        </div>
                    ) : (
                        filteredTrainers.map((t) => {
                            const isSelected = selectedIds.has(t.id);
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => toggleTrainer(t.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                                        isSelected
                                            ? 'bg-primary/5 hover:bg-primary/10'
                                            : 'hover:bg-muted/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className={`size-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                                                isSelected
                                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            {t.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {t.full_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                @{t.username}
                                            </p>
                                        </div>
                                    </div>

                                    <div
                                        className={`size-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                            isSelected
                                                ? 'bg-primary border-primary text-primary-foreground'
                                                : 'border-input bg-background'
                                        }`}
                                    >
                                        {isSelected && <Check size={14} className="stroke-[3]" />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2.5 p-4 border-t border-border bg-muted/30 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium rounded-xl border border-input hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                    >
                        Tutup
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Menyimpan...</span>
                            </>
                        ) : (
                            <span>Simpan Penugasan ({selectedIds.size})</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
