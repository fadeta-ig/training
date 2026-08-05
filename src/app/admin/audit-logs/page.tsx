'use client';

import { useCallback, useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import {
    Activity01Icon,
    Search01Icon,
    RefreshIcon,
    Alert02Icon,
    Clock01Icon,
    ViewIcon,
    Cancel01Icon
} from 'hugeicons-react';
import { AuditLog } from '@/types';

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchLogs = useCallback(async (targetPage: number, limit: number, search: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/audit-logs?page=${targetPage}&limit=${limit}&search=${encodeURIComponent(search)}`);
            if (!res.ok) throw new Error('Gagal memuat rekam aktivitas');
            const result = await res.json();

            if (result.success) {
                setLogs(result.data);
                if (result.pagination) {
                    setTotalPages(result.pagination.totalPages);
                    setTotalItems(result.pagination.total || result.data.length);
                }
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs(page, pageSize, searchQuery);
    }, [page, pageSize, searchQuery, fetchLogs]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setPage(1);
    };

    function getActionColorBadge(actionType: string) {
        if (actionType.includes('DELETE') || actionType.includes('REMOVE')) return 'bg-red-100 text-red-700';
        if (actionType.includes('CREATE') || actionType.includes('ADD') || actionType.includes('IMPORT')) return 'bg-emerald-100 text-emerald-700';
        if (actionType.includes('UPDATE') || actionType.includes('EDIT')) return 'bg-amber-100 text-amber-700';
        return 'bg-blue-100 text-blue-700';
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <PageHeader
                title="Sistem Audit Trail"
                description="Rekam jejak seluruh aktivitas yang dilakukan oleh level administrator pada aplikasi."
                icon={<Activity01Icon size={28} className="text-muted-foreground" />}
                onRefresh={() => fetchLogs(page, pageSize, searchQuery)}
                isRefreshing={isLoading}
            />

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Data</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Search01Icon size={18} />
                    </span>
                    <input
                        type="text"
                        placeholder="Cari berdasarkan nama, tabel, atau jenis aksi..."
                        value={searchQuery}
                        onChange={handleSearch}
                        className="w-full glass-input pl-11 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                    />
                </div>
            </div>

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/5 border-b border-black/5 text-muted-foreground font-medium uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-2xl">Waktu & Tanggal</th>
                                <th className="px-6 py-4">Tipe Aksi</th>
                                <th className="px-6 py-4">Entitas Terkait</th>
                                <th className="px-6 py-4">Dilakukan Oleh</th>
                                <th className="px-6 py-4 text-right rounded-tr-2xl">Metadata (JSON)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                                        <RefreshIcon size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                        Merekam riwayat...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10">
                                        <EmptyState
                                            icon={<Activity01Icon size={48} className="mb-4 opacity-20" />}
                                            title="Sistem Log Bersih"
                                            description="Belum ada aktivitas yang terekam dengan filter pencarian ini."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-black/5 transition-colors group">
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex items-center gap-1.5">
                                                <Clock01Icon size={14} className="opacity-70" />
                                                <span>
                                                    {new Date(log.created_at).toLocaleString('id-ID', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getActionColorBadge(log.action_type)}`}>
                                                {log.action_type.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-semibold text-slate-700">{log.entity.toUpperCase()}</span>
                                            {log.entity_id && (
                                                <p className="text-[10px] text-slate-400 font-mono mt-0.5" title={log.entity_id}>
                                                    Id: {log.entity_id.substring(0, 8)}...
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-slate-800">{log.full_name || 'SYSTEM'}</p>
                                            <p className="text-xs text-slate-500">{log.username ? `@${log.username}` : 'Auto-triggered Action'}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {log.details ? (
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-slate-600 hover:text-slate-900 transition-colors text-xs font-semibold"
                                                >
                                                    <ViewIcon size={14} />
                                                    Lihat Detail
                                                </button>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                }}
            />

            {/* JSON Payload Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
                    <div 
                        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 sm:max-h-[85dvh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-black/5 bg-slate-50/50 px-4 py-4 sm:items-center sm:px-6">
                            <div className="min-w-0">
                                <h3 className="font-bold text-lg text-slate-800">Detail Payload Aktivitas</h3>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="break-all rounded bg-black/5 px-1.5 font-mono">Action: {selectedLog.action_type}</span>
                                    <span>•</span>
                                    <span>Entity: {selectedLog.entity}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-label="Tutup detail aktivitas"
                                onClick={() => setSelectedLog(null)}
                                className="p-2 -mr-2 rounded-xl hover:bg-black/5 text-muted-foreground transition-colors"
                            >
                                <Cancel01Icon size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto bg-slate-900 p-4 sm:p-6">
                            <pre className="text-emerald-400 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                                {JSON.stringify(selectedLog.details, null, 2)}
                            </pre>
                        </div>
                        
                        <div className="flex justify-stretch border-t border-black/5 bg-slate-50 px-4 py-4 sm:justify-end sm:px-6">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5 sm:w-auto"
                            >
                                Tutup Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
