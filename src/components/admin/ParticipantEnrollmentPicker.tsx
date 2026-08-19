'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
    Search01Icon,
    FilterIcon,
    Building02Icon,
    UserGroupIcon,
    Sorting01Icon,
    Tick02Icon,
    Cancel01Icon,
    CheckmarkCircle02Icon,
    Delete02Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Mail01Icon,
    UserIcon,
    AlertCircleIcon,
    CheckListIcon,
    FileAttachmentIcon
} from 'hugeicons-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';

export type ParticipantItem = {
    id: string;
    username: string; // email or username
    full_name: string;
    email?: string;
    phone_number?: string | null;
    address?: string | null;
    gender?: 'L' | 'P' | null;
    institution?: string | null;
    created_at?: string;
};

interface ParticipantEnrollmentPickerProps {
    participants: ParticipantItem[];
    selectedUserIds: string[];
    onSelectionChange: (selectedIds: string[]) => void;
    isLoading?: boolean;
    stepNumber?: number;
    title?: string;
    description?: string;
    className?: string;
}

type SelectionScope = 'all' | 'selected' | 'unselected';
type SortOption = 'name-asc' | 'name-desc' | 'username-asc' | 'institution-asc' | 'newest';

export function ParticipantEnrollmentPicker({
    participants,
    selectedUserIds,
    onSelectionChange,
    isLoading = false,
    stepNumber = 2,
    title = 'Enrollment Peserta',
    description = 'Tandai peserta yang berhak mengikuti sesi pelatihan/ujian ini.',
    className = '',
}: ParticipantEnrollmentPickerProps) {
    // --- Filter & Search State ---
    const [searchQuery, setSearchQuery] = useState('');
    const [scope, setScope] = useState<SelectionScope>('all');
    const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
    const [selectedGender, setSelectedGender] = useState<string>('all');
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');
    const [showFilters, setShowFilters] = useState(false);

    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // --- Quick Paste Modal State ---
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [pasteResult, setPasteResult] = useState<{
        matchedCount: number;
        newlyAddedCount: number;
        unmatched: string[];
    } | null>(null);

    // --- Set of Selected IDs for O(1) Lookups ---
    const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

    // --- Distinct Institutions with Counts ---
    const institutionStats = useMemo(() => {
        const counts: Record<string, number> = {};
        let noInstitutionCount = 0;

        participants.forEach((p) => {
            const inst = p.institution?.trim();
            if (inst) {
                counts[inst] = (counts[inst] || 0) + 1;
            } else {
                noInstitutionCount += 1;
            }
        });

        const sortedInstitutions = Object.keys(counts).sort((a, b) => a.localeCompare(b));
        return {
            list: sortedInstitutions,
            counts,
            noInstitutionCount,
        };
    }, [participants]);

    // --- Filter & Sort Logic ---
    const filteredParticipants = useMemo(() => {
        let result = participants;

        // 1. Scope Filter (Semua / Terpilih / Belum Terpilih)
        if (scope === 'selected') {
            result = result.filter((p) => selectedSet.has(p.id));
        } else if (scope === 'unselected') {
            result = result.filter((p) => !selectedSet.has(p.id));
        }

        // 2. Institution Filter
        if (selectedInstitution !== 'all') {
            if (selectedInstitution === '__NONE__') {
                result = result.filter((p) => !p.institution || p.institution.trim() === '');
            } else {
                result = result.filter((p) => p.institution?.trim() === selectedInstitution);
            }
        }

        // 3. Gender Filter
        if (selectedGender !== 'all') {
            result = result.filter((p) => p.gender === selectedGender);
        }

        // 4. Search Query (Name, Username/Email, Institution, Phone)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter((p) => {
                const name = (p.full_name || '').toLowerCase();
                const username = (p.username || '').toLowerCase();
                const email = (p.email || '').toLowerCase();
                const institution = (p.institution || '').toLowerCase();
                const phone = (p.phone_number || '').toLowerCase();

                return (
                    name.includes(query) ||
                    username.includes(query) ||
                    email.includes(query) ||
                    institution.includes(query) ||
                    phone.includes(query)
                );
            });
        }

        // 5. Sorting
        const sorted = [...result];
        sorted.sort((a, b) => {
            if (sortBy === 'name-asc') {
                return (a.full_name || '').localeCompare(b.full_name || '');
            }
            if (sortBy === 'name-desc') {
                return (b.full_name || '').localeCompare(a.full_name || '');
            }
            if (sortBy === 'username-asc') {
                return (a.username || a.email || '').localeCompare(b.username || b.email || '');
            }
            if (sortBy === 'institution-asc') {
                const instA = a.institution || '';
                const instB = b.institution || '';
                return instA.localeCompare(instB);
            }
            if (sortBy === 'newest') {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA;
            }
            return 0;
        });

        return sorted;
    }, [
        participants,
        selectedSet,
        scope,
        selectedInstitution,
        selectedGender,
        searchQuery,
        sortBy,
    ]);

    // --- Pagination Calculation ---
    const totalFiltered = filteredParticipants.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedParticipants = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return filteredParticipants.slice(start, start + pageSize);
    }, [filteredParticipants, safeCurrentPage, pageSize]);

    // --- Active Filters Count for Badge ---
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedInstitution !== 'all') count++;
        if (selectedGender !== 'all') count++;
        if (sortBy !== 'name-asc') count++;
        return count;
    }, [selectedInstitution, selectedGender, sortBy]);

    // --- Handlers: Individual Toggle ---
    const handleToggleUser = useCallback(
        (userId: string) => {
            const next = new Set(selectedSet);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            onSelectionChange(Array.from(next));
        },
        [selectedSet, onSelectionChange]
    );

    // --- Handlers: Current Page Master Toggle ---
    const isAllPageSelected =
        paginatedParticipants.length > 0 &&
        paginatedParticipants.every((p) => selectedSet.has(p.id));

    const isSomePageSelected =
        paginatedParticipants.some((p) => selectedSet.has(p.id)) && !isAllPageSelected;

    const handleToggleCurrentPage = () => {
        const next = new Set(selectedSet);
        if (isAllPageSelected) {
            paginatedParticipants.forEach((p) => next.delete(p.id));
        } else {
            paginatedParticipants.forEach((p) => next.add(p.id));
        }
        onSelectionChange(Array.from(next));
    };

    // --- Handlers: Bulk Select / Deselect Filtered Results ---
    const handleSelectAllFiltered = () => {
        if (filteredParticipants.length === 0) return;
        const next = new Set(selectedSet);
        filteredParticipants.forEach((p) => next.add(p.id));
        onSelectionChange(Array.from(next));
        toast.success(`Berhasil menandai ${filteredParticipants.length} peserta yang difilter`);
    };

    const handleDeselectFiltered = () => {
        if (filteredParticipants.length === 0) return;
        const next = new Set(selectedSet);
        filteredParticipants.forEach((p) => next.delete(p.id));
        onSelectionChange(Array.from(next));
        toast.info(`Batal memilih ${filteredParticipants.length} peserta dari filter`);
    };

    const handleClearAllSelections = () => {
        if (selectedUserIds.length === 0) return;
        onSelectionChange([]);
        toast.info('Semua pilihan peserta telah dikosongkan');
    };

    // --- Handlers: Reset All Filters ---
    const handleResetFilters = () => {
        setSearchQuery('');
        setScope('all');
        setSelectedInstitution('all');
        setSelectedGender('all');
        setSortBy('name-asc');
        setCurrentPage(1);
    };

    // --- Quick Paste Text Parser & Matcher ---
    const handleProcessPaste = () => {
        if (!pasteText.trim()) return;

        // Split text by commas, newlines, semicolons, tabs, spaces
        const rawTokens = pasteText
            .split(/[\r\n,;\t]+/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0);

        if (rawTokens.length === 0) {
            toast.error('Tidak ada data teks yang dapat diproses');
            return;
        }

        const next = new Set(selectedSet);
        let newlyAddedCount = 0;
        let matchedCount = 0;
        const unmatched: string[] = [];

        // Build lookup map for participants by username, email, ID, and phone
        const participantLookup = new Map<string, ParticipantItem>();
        participants.forEach((p) => {
            if (p.username) participantLookup.set(p.username.toLowerCase(), p);
            if (p.email) participantLookup.set(p.email.toLowerCase(), p);
            if (p.id) participantLookup.set(p.id.toLowerCase(), p);
            if (p.phone_number) participantLookup.set(p.phone_number.toLowerCase(), p);
        });

        // Deduplicate input tokens
        const uniqueTokens = Array.from(new Set(rawTokens));

        uniqueTokens.forEach((token) => {
            const found = participantLookup.get(token);
            if (found) {
                matchedCount++;
                if (!next.has(found.id)) {
                    next.add(found.id);
                    newlyAddedCount++;
                }
            } else {
                unmatched.push(token);
            }
        });

        onSelectionChange(Array.from(next));

        setPasteResult({
            matchedCount,
            newlyAddedCount,
            unmatched,
        });

        if (matchedCount > 0) {
            toast.success(
                `Berhasil mencocokkan ${matchedCount} peserta (${newlyAddedCount} baru ditambahkan)`
            );
        } else {
            toast.error('Tidak ada peserta yang cocok dengan data yang ditempel');
        }
    };

    // Helper for Avatar colors
    const getAvatarColor = (name: string) => {
        const colors = [
            'bg-blue-100 text-blue-700 border-blue-200',
            'bg-emerald-100 text-emerald-700 border-emerald-200',
            'bg-violet-100 text-violet-700 border-violet-200',
            'bg-amber-100 text-amber-700 border-amber-200',
            'bg-rose-100 text-rose-700 border-rose-200',
            'bg-cyan-100 text-cyan-700 border-cyan-200',
            'bg-indigo-100 text-indigo-700 border-indigo-200',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    // Helper for initials
    const getInitials = (name: string) => {
        if (!name) return 'P';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <GlassCard className={`p-6 md:p-8 space-y-6 ${className}`}>
            {/* ── Section Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.08] pb-5">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold flex items-center gap-2.5 text-foreground">
                        <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-xs">
                            {stepNumber}
                        </span>
                        {title}
                    </h2>
                    {description && (
                        <p className="text-xs text-muted-foreground ml-8.5">{description}</p>
                    )}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary shadow-xs">
                        <CheckmarkCircle02Icon size={15} />
                        <span>
                            Terpilih: <strong>{selectedUserIds.length}</strong> dari{' '}
                            <strong>{participants.length}</strong> Peserta
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setPasteResult(null);
                            setPasteText('');
                            setIsPasteModalOpen(true);
                        }}
                        title="Tempel daftar email atau username untuk menandai massal"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 bg-white hover:bg-black/5 text-xs font-medium text-foreground transition-all shadow-xs"
                    >
                        <FileAttachmentIcon size={14} className="text-muted-foreground" />
                        <span className="hidden sm:inline">Tempel Daftar Massal</span>
                        <span className="sm:hidden">Tempel</span>
                    </button>
                </div>
            </div>

            {/* ── Scope Filter Tabs (Semua / Terpilih / Belum Terpilih) ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center p-1 bg-black/[0.04] rounded-xl border border-black/[0.06] text-xs font-medium w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => {
                            setScope('all');
                            setCurrentPage(1);
                        }}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            scope === 'all'
                                ? 'bg-white text-foreground shadow-xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <UserGroupIcon size={14} />
                        <span>Semua Peserta</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 font-mono">
                            {participants.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setScope('selected');
                            setCurrentPage(1);
                        }}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            scope === 'selected'
                                ? 'bg-white text-primary shadow-xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Tick02Icon size={14} />
                        <span>Terpilih</span>
                        <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                                selectedUserIds.length > 0
                                    ? 'bg-primary/10 text-primary font-bold'
                                    : 'bg-black/5'
                            }`}
                        >
                            {selectedUserIds.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setScope('unselected');
                            setCurrentPage(1);
                        }}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            scope === 'unselected'
                                ? 'bg-white text-foreground shadow-xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <UserIcon size={14} />
                        <span>Belum Terpilih</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 font-mono">
                            {Math.max(0, participants.length - selectedUserIds.length)}
                        </span>
                    </button>
                </div>

                {/* Filter Toggle & Clear Selection Action */}
                <div className="flex items-center gap-2 self-end lg:self-auto">
                    {selectedUserIds.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAllSelections}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            <Delete02Icon size={14} />
                            <span>Kosongkan Pilihan</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                            showFilters || activeFiltersCount > 0
                                ? 'bg-primary/10 border-primary/30 text-primary shadow-xs'
                                : 'border-black/10 bg-white hover:bg-black/5 text-foreground'
                        }`}
                    >
                        <FilterIcon size={14} />
                        <span>Filter Lanjutan</span>
                        {activeFiltersCount > 0 && (
                            <span className="bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Search Bar & Filter Options ── */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Search input with clear button */}
                    <div className="relative w-full">
                        <Search01Icon
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                        />
                        <input
                            type="text"
                            placeholder="Cari berdasarkan nama, email/username, institusi, atau no HP..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-black/10 bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs sm:text-sm font-medium shadow-xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setCurrentPage(1);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
                            >
                                <Cancel01Icon size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Collapsible Advanced Filters Tray */}
                {showFilters && (
                    <div className="p-4 rounded-xl bg-black/[0.02] border border-black/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Filter Institusi */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                                <Building02Icon size={12} />
                                Filter Institusi
                            </label>
                            <select
                                value={selectedInstitution}
                                onChange={(e) => {
                                    setSelectedInstitution(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            >
                                <option value="all">Semua Institusi ({participants.length})</option>
                                {institutionStats.list.map((inst) => (
                                    <option key={inst} value={inst}>
                                        {inst} ({institutionStats.counts[inst]})
                                    </option>
                                ))}
                                {institutionStats.noInstitutionCount > 0 && (
                                    <option value="__NONE__">
                                        Tanpa Institusi ({institutionStats.noInstitutionCount})
                                    </option>
                                )}
                            </select>
                        </div>

                        {/* Filter Jenis Kelamin */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                                <UserIcon size={12} />
                                Jenis Kelamin
                            </label>
                            <select
                                value={selectedGender}
                                onChange={(e) => {
                                    setSelectedGender(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            >
                                <option value="all">Semua Gender</option>
                                <option value="L">Laki-laki (L)</option>
                                <option value="P">Perempuan (P)</option>
                            </select>
                        </div>

                        {/* Sort By */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                                <Sorting01Icon size={12} />
                                Urutkan Berdasarkan
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => {
                                    setSortBy(e.target.value as SortOption);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            >
                                <option value="name-asc">Nama Lengkap (A → Z)</option>
                                <option value="name-desc">Nama Lengkap (Z → A)</option>
                                <option value="username-asc">Email / Username (A → Z)</option>
                                <option value="institution-asc">Institusi (A → Z)</option>
                                <option value="newest">Peserta Terbaru</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bulk Actions on Filtered Items ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-black/[0.02] border border-black/[0.06] text-xs">
                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                    <span>
                        Menampilkan <strong>{paginatedParticipants.length}</strong> dari{' '}
                        <strong>{totalFiltered}</strong> peserta yang sesuai filter
                    </span>
                    {(searchQuery ||
                        selectedInstitution !== 'all' ||
                        selectedGender !== 'all' ||
                        scope !== 'all') && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="text-primary hover:underline text-xs font-semibold ml-1 cursor-pointer"
                        >
                            Reset Filter
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {totalFiltered > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={handleSelectAllFiltered}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs transition-colors cursor-pointer"
                            >
                                <CheckListIcon size={14} />
                                <span>Pilih Semua Hasil Filter ({totalFiltered})</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleDeselectFiltered}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-muted-foreground hover:text-foreground font-medium text-xs transition-colors cursor-pointer"
                            >
                                <Cancel01Icon size={14} />
                                <span>Batal Pilih Filter</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Participants Table ── */}
            <div className="relative rounded-xl border border-black/[0.08] bg-white/60 backdrop-blur-xs overflow-hidden shadow-xs">
                <div className="max-h-[440px] overflow-y-auto">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                        <thead className="text-[11px] text-muted-foreground uppercase bg-black/[0.04] sticky top-0 z-10 backdrop-blur-md border-b border-black/[0.08]">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        aria-label="Pilih semua di halaman ini"
                                        checked={isAllPageSelected}
                                        ref={(input) => {
                                            if (input) {
                                                input.indeterminate = isSomePageSelected;
                                            }
                                        }}
                                        onChange={handleToggleCurrentPage}
                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                                    />
                                </th>
                                <th className="px-4 py-3 font-semibold tracking-wider">
                                    Peserta
                                </th>
                                <th className="px-4 py-3 font-semibold tracking-wider hidden md:table-cell">
                                    Institusi / Organisasi
                                </th>
                                <th className="px-4 py-3 font-semibold tracking-wider text-center w-20 hidden sm:table-cell">
                                    Gender
                                </th>
                                <th className="px-4 py-3 font-semibold tracking-wider text-center w-24">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                            <span className="text-xs font-medium">
                                                Memuat data peserta...
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedParticipants.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground max-w-sm mx-auto">
                                            <AlertCircleIcon size={32} className="text-muted-foreground/50" />
                                            <p className="text-sm font-medium text-foreground">
                                                Tidak ada peserta yang ditemukan
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Kriteria filter atau pencarian Anda tidak cocok dengan peserta mana pun.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleResetFilters}
                                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-semibold text-foreground transition-colors"
                                            >
                                                <Cancel01Icon size={13} />
                                                Reset Semua Filter
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedParticipants.map((user) => {
                                    const isSelected = selectedSet.has(user.id);
                                    return (
                                        <tr
                                            key={user.id}
                                            onClick={() => handleToggleUser(user.id)}
                                            className={`transition-colors cursor-pointer select-none ${
                                                isSelected
                                                    ? 'bg-primary/[0.05] hover:bg-primary/[0.09]'
                                                    : 'hover:bg-black/[0.02]'
                                            }`}
                                        >
                                            {/* Checkbox Column */}
                                            <td
                                                className="px-4 py-3 text-center"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Pilih ${user.full_name}`}
                                                    checked={isSelected}
                                                    onChange={() => handleToggleUser(user.id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                                                />
                                            </td>

                                            {/* Participant Info Column */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${getAvatarColor(
                                                            user.full_name || user.username
                                                        )}`}
                                                    >
                                                        {getInitials(user.full_name || user.username)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                                                            {user.full_name || 'Tanpa Nama'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                            <Mail01Icon size={12} />
                                                            {user.email || user.username}
                                                            {user.phone_number && (
                                                                <span className="hidden md:inline text-muted-foreground/60">
                                                                    • {user.phone_number}
                                                                </span>
                                                            )}
                                                        </p>
                                                        {/* Mobile-only institution preview */}
                                                        {user.institution && (
                                                            <p className="text-[11px] text-primary/80 md:hidden mt-0.5 truncate flex items-center gap-1">
                                                                <Building02Icon size={11} />
                                                                {user.institution}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Institution Column */}
                                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                                                {user.institution ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/[0.04] text-xs font-medium text-foreground/80">
                                                        <Building02Icon size={13} className="text-muted-foreground" />
                                                        <span className="truncate max-w-[200px]">
                                                            {user.institution}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/50 text-xs italic">
                                                        -
                                                    </span>
                                                )}
                                            </td>

                                            {/* Gender Column */}
                                            <td className="px-4 py-3 text-center hidden sm:table-cell">
                                                {user.gender === 'L' ? (
                                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                                        L
                                                    </span>
                                                ) : user.gender === 'P' ? (
                                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                        P
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/50 text-xs">-</span>
                                                )}
                                            </td>

                                            {/* Selection Status Badge */}
                                            <td className="px-4 py-3 text-center">
                                                {isSelected ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                                                        <Tick02Icon size={12} />
                                                        Terdaftar
                                                    </span>
                                                ) : (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground/60 bg-black/[0.02]">
                                                        Belum
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Table Footer & Pagination ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span>Baris per halaman:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="px-2 py-1 rounded-md border border-black/10 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span>
                        Halaman <strong>{safeCurrentPage}</strong> dari <strong>{totalPages}</strong>
                    </span>
                </div>

                <div className="flex items-center gap-1.5 self-center sm:self-auto">
                    <button
                        type="button"
                        disabled={safeCurrentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="p-1.5 rounded-lg border border-black/10 bg-white hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Halaman Sebelumnya"
                    >
                        <ArrowLeft01Icon size={16} />
                    </button>

                    {/* Simple Pagination Numbers (Showing nearby pages) */}
                    <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(
                                (pageNum) =>
                                    pageNum === 1 ||
                                    pageNum === totalPages ||
                                    Math.abs(pageNum - safeCurrentPage) <= 1
                            )
                            .map((pageNum, idx, arr) => {
                                const isGap = idx > 0 && pageNum - arr[idx - 1] > 1;
                                return (
                                    <React.Fragment key={pageNum}>
                                        {isGap && <span className="px-1 text-muted-foreground">...</span>}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                                                safeCurrentPage === pageNum
                                                    ? 'bg-primary text-white shadow-xs'
                                                    : 'hover:bg-black/5 text-foreground'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                    </div>

                    <button
                        type="button"
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="p-1.5 rounded-lg border border-black/10 bg-white hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Halaman Berikutnya"
                    >
                        <ArrowRight01Icon size={16} />
                    </button>
                </div>
            </div>

            {/* ── Quick Paste Dialog / Modal ── */}
            {isPasteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-black/10 space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-black/[0.08] pb-3">
                            <div className="flex items-center gap-2">
                                <FileAttachmentIcon size={20} className="text-primary" />
                                <h3 className="font-semibold text-foreground text-sm sm:text-base">
                                    Tempel Daftar Email / Username Massal
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPasteModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                            >
                                <Cancel01Icon size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Salin daftar email, username, atau ID peserta dari Excel / teks memo, lalu
                            tempelkan di bawah ini. Anda dapat memisahkannya dengan baris baru, koma, atau titik koma.
                        </p>

                        <div className="space-y-2">
                            <textarea
                                rows={6}
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                placeholder="Contoh:&#10;peserta1@gmail.com&#10;peserta2@gmail.com, peserta3@nusamitra.com&#10;user.alpha"
                                className="w-full p-3 rounded-xl border border-black/10 bg-black/[0.02] focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs font-mono transition-all"
                            />
                        </div>

                        {pasteResult && (
                            <div className="p-3 rounded-xl bg-black/[0.03] border border-black/[0.06] text-xs space-y-1.5">
                                <div className="flex items-center justify-between font-semibold">
                                    <span className="text-emerald-700 flex items-center gap-1">
                                        <Tick02Icon size={14} /> {pasteResult.matchedCount} peserta ditemukan & ditandai
                                    </span>
                                    {pasteResult.newlyAddedCount > 0 && (
                                        <span className="text-muted-foreground">
                                            (+{pasteResult.newlyAddedCount} baru ditambahkan)
                                        </span>
                                    )}
                                </div>
                                {pasteResult.unmatched.length > 0 && (
                                    <div className="text-destructive pt-1 border-t border-black/5">
                                        <p className="font-medium">
                                            {pasteResult.unmatched.length} email/username tidak terdaftar di sistem:
                                        </p>
                                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                                            {pasteResult.unmatched.slice(0, 5).join(', ')}
                                            {pasteResult.unmatched.length > 5 && ` (+${pasteResult.unmatched.length - 5} lainnya)`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsPasteModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-black/5 transition-colors"
                            >
                                Tutup
                            </button>
                            <button
                                type="button"
                                onClick={handleProcessPaste}
                                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all flex items-center gap-1.5"
                            >
                                <CheckmarkCircle02Icon size={15} />
                                Tandai Otomatis
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </GlassCard>
    );
}
