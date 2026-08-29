'use client';

import React, { useState } from 'react';
import {
    Search01Icon,
    Cancel01Icon,
    Calendar03Icon,
    CloudUploadIcon,
    RefreshIcon,
    UserIcon,
} from 'hugeicons-react';
import { Filter, ArrowDownUp, RotateCcw, Building2, Layers } from 'lucide-react';
import Link from 'next/link';

export interface ParticipantFilters {
    search: string;
    institution: string;
    batch: string;
    gender: string;
    dateFrom: string;
    dateTo: string;
    sortBy: string;
}

interface ParticipantsFilterProps {
    filters: ParticipantFilters;
    onFilterChange: (newFilters: Partial<ParticipantFilters>) => void;
    onReset: () => void;
    availableInstitutions: string[];
    availableBatches: string[];
    totalItems: number;
    userRole: string;
}

export function ParticipantsFilter({
    filters,
    onFilterChange,
    onReset,
    availableInstitutions,
    availableBatches,
    totalItems,
    userRole,
}: ParticipantsFilterProps) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    // Calculate active filter count (excluding default sortBy)
    const activeFilterCount = [
        Boolean(filters.search.trim()),
        Boolean(filters.institution && filters.institution !== 'all'),
        Boolean(filters.batch && filters.batch !== 'all'),
        Boolean(filters.gender && filters.gender !== 'all'),
        Boolean(filters.dateFrom),
        Boolean(filters.dateTo),
        Boolean(filters.sortBy && filters.sortBy !== 'created_desc'),
    ].filter(Boolean).length;

    const hasActiveFilters = activeFilterCount > 0;

    return (
        <div className="space-y-3">
            {/* Primary Toolbar Row */}
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-0">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        <Search01Icon size={18} />
                    </span>
                    <input
                        type="text"
                        placeholder="Cari NIP, nama, email, instansi, atau no. HP..."
                        value={filters.search}
                        onChange={(e) => onFilterChange({ search: e.target.value })}
                        className="w-full glass-input pl-10 pr-9 py-2.5 rounded-xl text-xs sm:text-sm focus:outline-none placeholder:text-muted-foreground/70"
                    />
                    {filters.search && (
                        <button
                            type="button"
                            onClick={() => onFilterChange({ search: '' })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
                            title="Hapus pencarian"
                        >
                            <Cancel01Icon size={14} />
                        </button>
                    )}
                </div>

                {/* Quick Filters & Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Instansi Dropdown */}
                    <div className="relative min-w-[140px] sm:min-w-[160px] flex-1 sm:flex-initial">
                        <select
                            value={filters.institution}
                            onChange={(e) => onFilterChange({ institution: e.target.value })}
                            className="w-full h-10 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-black/10 text-foreground shadow-2xs hover:border-black/20 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all appearance-none pr-8"
                        >
                            <option value="all">Semua Instansi</option>
                            {availableInstitutions.map((inst) => (
                                <option key={inst} value={inst}>
                                    {inst}
                                </option>
                            ))}
                            <option value="__NONE__">Tanpa Instansi</option>
                        </select>
                        <Building2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Batch Dropdown */}
                    <div className="relative min-w-[120px] sm:min-w-[140px] flex-1 sm:flex-initial">
                        <select
                            value={filters.batch}
                            onChange={(e) => onFilterChange({ batch: e.target.value })}
                            className="w-full h-10 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-black/10 text-foreground shadow-2xs hover:border-black/20 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all appearance-none pr-8"
                        >
                            <option value="all">Semua Batch</option>
                            {availableBatches.map((b) => (
                                <option key={b} value={b}>
                                    {/^\d+$/.test(b) ? `Batch ${b}` : b}
                                </option>
                            ))}
                        </select>
                        <Layers className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Advanced Filter Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                        className={`inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-semibold border transition-all shadow-2xs cursor-pointer ${
                            isAdvancedOpen || activeFilterCount > 0
                                ? 'bg-primary/10 border-primary/30 text-primary font-bold shadow-xs'
                                : 'bg-white border-black/10 text-slate-700 hover:bg-slate-50'
                        }`}
                        title="Filter lanjutan (Gender, Tanggal, Pengurutan)"
                    >
                        <Filter className="size-3.5" />
                        <span>Filter</span>
                        {activeFilterCount > 0 && (
                            <span className="size-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center -mr-1">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {/* Import Massal Excel (Admin only) */}
                    {userRole === 'admin' && (
                        <Link
                            href="/admin/participants/import"
                            className="inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-emerald-600/30 bg-emerald-50/90 hover:bg-emerald-100 hover:border-emerald-500/50 px-3.5 text-xs font-semibold text-emerald-800 shadow-2xs hover:shadow-xs active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
                        >
                            <CloudUploadIcon size={16} className="text-emerald-700 shrink-0" />
                            <span>Import Massal Excel</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Advanced Filters Expandable Drawer */}
            {isAdvancedOpen && (
                <div className="bg-slate-900/5 backdrop-blur-md border border-slate-900/10 rounded-2xl p-4 space-y-4 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between border-b border-black/5 pb-2.5">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Filter className="size-3.5 text-primary" />
                            <span>Filter &amp; Pengurutan Lanjutan</span>
                        </h4>
                        <button
                            type="button"
                            onClick={onReset}
                            disabled={!hasActiveFilters}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground cursor-pointer"
                        >
                            <RotateCcw className="size-3" />
                            <span>Reset Semua</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Gender Filter */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-muted-foreground">
                                Jenis Kelamin
                            </label>
                            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-black/10 shadow-2xs">
                                {[
                                    { value: 'all', label: 'Semua' },
                                    { value: 'L', label: 'Laki-laki' },
                                    { value: 'P', label: 'Perempuan' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => onFilterChange({ gender: opt.value })}
                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                            filters.gender === opt.value
                                                ? 'bg-slate-900 text-white shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date From */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-muted-foreground">
                                Tgl Pendaftaran Dari
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl bg-white border border-black/10 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                                />
                            </div>
                        </div>

                        {/* Date To */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-muted-foreground">
                                Tgl Pendaftaran Sampai
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => onFilterChange({ dateTo: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl bg-white border border-black/10 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                                />
                            </div>
                        </div>

                        {/* Sort By */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-muted-foreground">
                                Urutan Data
                            </label>
                            <div className="relative">
                                <select
                                    value={filters.sortBy}
                                    onChange={(e) => onFilterChange({ sortBy: e.target.value })}
                                    className="w-full h-10 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-black/10 text-foreground shadow-2xs hover:border-black/20 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all appearance-none pr-8"
                                >
                                    <option value="created_desc">Pendaftaran Terbaru</option>
                                    <option value="created_asc">Pendaftaran Terlama</option>
                                    <option value="name_asc">Nama Lengkap (A - Z)</option>
                                    <option value="name_desc">Nama Lengkap (Z - A)</option>
                                    <option value="nip_asc">NIP Peserta (A - Z)</option>
                                    <option value="nip_desc">NIP Peserta (Z - A)</option>
                                    <option value="batch_asc">Kode Batch (A - Z)</option>
                                    <option value="batch_desc">Kode Batch (Z - A)</option>
                                </select>
                                <ArrowDownUp className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Filters Badges & Result Count Bar */}
            {hasActiveFilters && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                            Filter Aktif:
                        </span>

                        {filters.search && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-medium text-xs border border-black/5">
                                <span>Cari: &quot;{filters.search}&quot;</span>
                                <button
                                    type="button"
                                    onClick={() => onFilterChange({ search: '' })}
                                    className="hover:text-destructive"
                                >
                                    <Cancel01Icon size={12} />
                                </button>
                            </span>
                        )}

                        {filters.institution && filters.institution !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-medium text-xs border border-blue-200">
                                <span>Instansi: {filters.institution === '__NONE__' ? 'Tanpa Instansi' : filters.institution}</span>
                                <button
                                    type="button"
                                    onClick={() => onFilterChange({ institution: 'all' })}
                                    className="hover:text-destructive"
                                >
                                    <Cancel01Icon size={12} />
                                </button>
                            </span>
                        )}

                        {filters.batch && filters.batch !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-medium text-xs border border-emerald-200">
                                <span>Batch: {/^\d+$/.test(filters.batch) ? `Batch ${filters.batch}` : filters.batch}</span>
                                <button
                                    type="button"
                                    onClick={() => onFilterChange({ batch: 'all' })}
                                    className="hover:text-destructive"
                                >
                                    <Cancel01Icon size={12} />
                                </button>
                            </span>
                        )}

                        {filters.gender && filters.gender !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 font-medium text-xs border border-purple-200">
                                <span>Gender: {filters.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                                <button
                                    type="button"
                                    onClick={() => onFilterChange({ gender: 'all' })}
                                    className="hover:text-destructive"
                                >
                                    <Cancel01Icon size={12} />
                                </button>
                            </span>
                        )}

                        {(filters.dateFrom || filters.dateTo) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-medium text-xs border border-amber-200">
                                <span>
                                    Tgl: {filters.dateFrom || '...'} s/d {filters.dateTo || '...'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onFilterChange({ dateFrom: '', dateTo: '' })}
                                    className="hover:text-destructive"
                                >
                                    <Cancel01Icon size={12} />
                                </button>
                            </span>
                        )}

                        {filters.sortBy && filters.sortBy !== 'created_desc' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-medium text-xs border border-black/5">
                                <span>Urutan Khusus</span>
                                <button
                                    type="button"
                                    onClick={() => onFilterChange({ sortBy: 'created_desc' })}
                                    className="hover:text-destructive"
                                >
                                    <Cancel01Icon size={12} />
                                </button>
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={onReset}
                            className="text-[11px] font-bold text-primary hover:underline ml-1 cursor-pointer"
                        >
                            Reset
                        </button>
                    </div>

                    <div className="text-[11px] text-muted-foreground font-medium">
                        Ditemukan <strong className="text-foreground">{totalItems}</strong> peserta
                    </div>
                </div>
            )}
        </div>
    );
}
