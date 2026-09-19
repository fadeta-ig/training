'use client';

import { useState, useEffect, use, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    Time02Icon,
    SecurityLockIcon,
    UserMultipleIcon,
    Logout01Icon,
    Download01Icon,
    MailSend01Icon,
    ViewIcon,
    ViewOffIcon,
    Camera01Icon,
    PencilEdit01Icon,
    Search01Icon,
    FoldersIcon,
    Cancel01Icon
} from 'hugeicons-react';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/usePagination';
import { useIsSeb } from '@/hooks/useSeb';
import { Pagination } from '@/components/ui/Pagination';
import { GraduationVerdictModal } from '@/components/admin/GraduationVerdictModal';
import { CertificateUploadModal } from '@/components/admin/CertificateUploadModal';
import { ScoreAdjustmentModal } from '@/components/admin/ScoreAdjustmentModal';
import { BulkScoreAdjustmentModal } from '@/components/admin/BulkScoreAdjustmentModal';
import { Award, FileText, UploadCloud, Printer, CheckCircle2, AlertCircle, Sparkles, FileBadge2, Copy, ShieldCheck, FilePenLine, BookOpen, Clock3, SlidersHorizontal, Archive, ArrowDownUp, Filter, RotateCcw } from 'lucide-react';
import { formatWibDateTime } from '@/lib/timezone';

type User = {
    id: string;
    session_participant_id?: string;
    username: string;
    full_name: string;
    id_card_number?: string | null;
    nip?: string | null;
    institution?: string | null;
    batch?: number | null;
    completed_items: number;
    total_items: number;
    progress: number;
    current_activity?: {
        type: 'exam' | 'training' | 'completed' | 'in_between' | 'not_started';
        title: string | null;
        item_type: 'exam' | 'training' | null;
        label: string;
        last_activity_at: string | null;
    };
    graduation_status?: 'pending' | 'passed' | 'failed';
    graduation_decided_at?: string | null;
    graduation_notes?: string | null;
    skl_number?: string | null;
    skl_generated_at?: string | null;
    certificate_file_url?: string | null;
    certificate_number?: string | null;
    certificate_uploaded_at?: string | null;
    final_score?: number | null;
    avg_score?: number | null;
    original_score?: number | null;
    score_adjustment?: number | null;
    adjustment_reason?: string | null;
    adjusted_at?: string | null;
    exam_module_item_id?: string | null;
    evaluation_status?: 'draft' | 'grading_pending' | 'remedial_required' | 'remedial_exhausted' | 'ready_for_graduation';
    exam_results?: Array<{
        source_exam_id: string;
        exam_title: string;
        module_item_id: string | null;
        final_score: number | null;
        original_score: number | null;
        score_adjustment: number;
        adjustment_reason?: string | null;
        adjusted_at?: string | null;
        passing_grade: number;
        outcome: 'draft' | 'grading_pending' | 'passed' | 'remedial_required' | 'remedial_exhausted' | 'absent';
        remedial_session_id?: string | null;
        attempts_count: number;
        published: boolean;
    }>;
};

type SessionDetail = {
    id: string;
    module_id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    show_score: boolean;
    session_type?: 'regular' | 'remedial';
    parent_session_id?: string | null;
    remedial_cycle?: number;
    result_state?: 'draft' | 'published';
    result_publication_version?: number;
    publication?: { id: string; version: number; session_id: string; published_at: string } | null;
    enable_proctoring: boolean;
    seb_config_key: string | null;
    created_at: string;
    participants: User[];
};

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isSeb = useIsSeb();
    const [isSendingBlast, setIsSendingBlast] = useState(false);
    const [showBlastConfirm, setShowBlastConfirm] = useState(false);
    const [userRole, setUserRole] = useState<string>('');
    const [searchParticipant, setSearchParticipant] = useState('');
    const [selectedExamId, setSelectedExamId] = useState('');
    const [scoreMin, setScoreMin] = useState('');
    const [scoreMax, setScoreMax] = useState('');
    const [scoreSort, setScoreSort] = useState<'default' | 'desc' | 'asc'>('default');
    const [evaluationFilter, setEvaluationFilter] = useState<'all' | User['evaluation_status']>('all');
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishPreview, setPublishPreview] = useState<any>(null);
    const [isLoadingPublishPreview, setIsLoadingPublishPreview] = useState(false);
    const [markMissingAbsent, setMarkMissingAbsent] = useState(false);
    const [forfeitIncompleteRemedial, setForfeitIncompleteRemedial] = useState(false);

    // Modal state for verdict & certificate
    const [selectedParticipantForVerdict, setSelectedParticipantForVerdict] = useState<User | null>(null);
    const [selectedParticipantForCert, setSelectedParticipantForCert] = useState<User | null>(null);

    // Modal state for score adjustment
    const [selectedParticipantForScoreAdjust, setSelectedParticipantForScoreAdjust] = useState<User | null>(null);
    const [showBulkScoreModal, setShowBulkScoreModal] = useState(false);
    const [isTogglingScoreVisibility, setIsTogglingScoreVisibility] = useState(false);
    const [isDownloadingBulkSheets, setIsDownloadingBulkSheets] = useState(false);
    const [sebOverrideParticipantId, setSebOverrideParticipantId] = useState<string | null>(null);

    // Bulk Actions State
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
    const [showBulkTimeModal, setShowBulkTimeModal] = useState(false);
    const [bulkExtraMinutes, setBulkExtraMinutes] = useState<number>(15);
    const [bulkReason, setBulkReason] = useState<string>('');
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

    const [showBulkVerdictModal, setShowBulkVerdictModal] = useState(false);
    const [bulkVerdictStatus, setBulkVerdictStatus] = useState<'passed' | 'failed'>('passed');
    const [bulkVerdictNotes, setBulkVerdictNotes] = useState('');
    const [isSubmittingBulkVerdict, setIsSubmittingBulkVerdict] = useState(false);

    const fetchSession = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/sessions/${resolvedParams.id}`);
            const data = await res.json();
            if (data.success) {
                setSession(data.data);
            } else {
                setError(data.error || 'Terjadi kesalahan saat memuat data sesi.');
            }
        } catch {
            setError('Masalah koneksi jaringan.');
        } finally {
            setLoading(false);
        }
    }, [resolvedParams.id]);

    const fetchRole = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.success) {
                setUserRole(data.data.role);
            }
        } catch {}
    }, []);

    useEffect(() => {
        fetchSession();
        fetchRole();
    }, [fetchRole, fetchSession]);

    useEffect(() => {
        if (selectedExamId || !session?.participants) return;
        const firstExam = session.participants.flatMap((participant) => participant.exam_results || [])[0];
        if (firstExam) setSelectedExamId(firstExam.source_exam_id);
    }, [selectedExamId, session?.participants]);

    const formatDate = (dateString: string) => {
        return formatWibDateTime(dateString, { withDayName: true });
    };

    const handleBlastEmail = async () => {
        setShowBlastConfirm(false);
        setIsSendingBlast(true);
        try {
            const res = await fetch(`/api/admin/sessions/${session?.id}/remind`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success('Broadcast Terkirim!', { description: data.message });
            } else {
                toast.error('Gagal Broadcast', { description: data.error });
            }
        } catch (err: any) {
            toast.error('Galat Eksekusi', { description: err.message });
        } finally {
            setIsSendingBlast(false);
        }
    };

    const handleSebOverride = async (participant: User) => {
        const reason = window.prompt(
            `Alasan override SEB untuk ${participant.full_name || participant.username}:`,
            'Security key SEB tidak terbaca saat ujian berlangsung',
        );
        if (!reason) return;

        setSebOverrideParticipantId(participant.id);
        try {
            const response = await fetch(`/api/admin/sessions/${resolvedParams.id}/seb-override`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: participant.id,
                    reason,
                    duration_minutes: 15,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Gagal mengaktifkan override SEB');
            }
            toast.success('Override SEB aktif', {
                description: `${data.message} Override hanya berlaku untuk peserta dan sesi ini.`,
            });
        } catch (overrideError) {
            toast.error('Override SEB gagal', {
                description: overrideError instanceof Error ? overrideError.message : 'Terjadi kesalahan sistem.',
            });
        } finally {
            setSebOverrideParticipantId(null);
        }
    };

    const getSessionState = (start: string, end: string): 'upcoming' | 'active' | 'ended' => {
        const now = new Date();
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (now < startDate) return 'upcoming';
        if (now >= startDate && now <= endDate) return 'active';
        return 'ended';
    };

    const filteredParticipants = useMemo(() => {
        if (!session?.participants) return [];
        const minimum = scoreMin === '' ? null : Number(scoreMin);
        const maximum = scoreMax === '' ? null : Number(scoreMax);
        const values = session.participants.filter((p) => {
            const matchesSearch = p.full_name.toLowerCase().includes(searchParticipant.toLowerCase())
                || p.username.toLowerCase().includes(searchParticipant.toLowerCase());
            const matchesStatus = evaluationFilter === 'all' || p.evaluation_status === evaluationFilter;
            const examResult = p.exam_results?.find((result) => result.source_exam_id === selectedExamId);
            const score = examResult?.final_score;
            const matchesMinimum = minimum === null || (score !== null && score !== undefined && score >= minimum);
            const matchesMaximum = maximum === null || (score !== null && score !== undefined && score <= maximum);
            return matchesSearch && matchesStatus && matchesMinimum && matchesMaximum;
        });
        if (scoreSort === 'default') return values;
        return [...values].sort((a, b) => {
            const aScore = a.exam_results?.find((result) => result.source_exam_id === selectedExamId)?.final_score;
            const bScore = b.exam_results?.find((result) => result.source_exam_id === selectedExamId)?.final_score;
            if ((aScore === null || aScore === undefined) && (bScore === null || bScore === undefined)) return 0;
            if (aScore === null || aScore === undefined) return 1;
            if (bScore === null || bScore === undefined) return -1;
            return scoreSort === 'desc' ? bScore - aScore : aScore - bScore;
        });
    }, [session?.participants, searchParticipant, selectedExamId, scoreMin, scoreMax, scoreSort, evaluationFilter]);

    const selectedExamModuleItemId = useMemo(() => {
        if (!selectedExamId) return null;
        return session?.participants
            .flatMap((participant) => participant.exam_results || [])
            .find((result) => result.source_exam_id === selectedExamId)?.module_item_id || null;
    }, [selectedExamId, session?.participants]);

    const examOptions = useMemo(() => {
        const byId = new Map<string, string>();
        for (const participant of session?.participants || []) {
            for (const result of participant.exam_results || []) byId.set(result.source_exam_id, result.exam_title);
        }
        return [...byId.entries()].map(([id, title]) => ({ id, title }));
    }, [session?.participants]);

    const {
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        startIndex,
        paginatedItems: paginatedParticipants,
        setPage,
        setPageSize,
    } = usePagination({ items: filteredParticipants, initialPageSize: 10 });

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20 text-xs text-muted-foreground font-medium animate-pulse">
                Memuat detail sesi...
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200/60 max-w-2xl mx-auto mt-12 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <AlertCircle size={20} />
                </div>
                <div className="space-y-1">
                    <h3 className="font-semibold text-foreground text-sm">Gagal Memuat Detail Sesi</h3>
                    <p className="text-xs text-red-600 max-w-md">{error || 'Sesi tidak ditemukan atau terjadi kesalahan pada server.'}</p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <Link
                        href="/admin/sessions"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-2xs transition-all"
                    >
                        <ArrowLeft01Icon size={14} />
                        Daftar Sesi
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            fetchSession();
                            fetchRole();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg shadow-2xs transition-all cursor-pointer"
                    >
                        Coba Lagi
                    </button>
                </div>
            </div>
        );
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedParticipantIds(filteredParticipants.map((p) => p.id));
        } else {
            setSelectedParticipantIds([]);
        }
    };

    const handleToggleParticipant = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedParticipantIds((prev) => [...prev, id]);
        } else {
            setSelectedParticipantIds((prev) => prev.filter((item) => item !== id));
        }
    };

    const handleExecuteBulkExtension = async () => {
        if (selectedParticipantIds.length === 0 || !session) return;
        setIsSubmittingBulk(true);
        try {
            const res = await fetch(`/api/admin/sessions/${session.id}/participants/override-bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participant_ids: selectedParticipantIds,
                    extra_minutes: Number(bulkExtraMinutes) || 15,
                    reason: bulkReason.trim() || 'Perpanjangan Waktu Massal oleh Admin',
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Perpanjangan Waktu Berhasil!', {
                    description: data.message,
                });
                setShowBulkTimeModal(false);
                setSelectedParticipantIds([]);
                setBulkReason('');
                fetchSession();
            } else {
                toast.error('Gagal Memperpanjang Waktu', {
                    description: data.error || 'Terjadi kesalahan sistem',
                });
            }
        } catch (err: any) {
            toast.error('Kesalahan Jaringan', { description: err.message });
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    const handleExecuteBulkVerdict = async (status: 'passed' | 'failed') => {
        if (selectedParticipantIds.length === 0 || !session) return;
        setIsSubmittingBulkVerdict(true);
        try {
            const res = await fetch(`/api/admin/sessions/${session.id}/participants/graduation-bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participant_ids: selectedParticipantIds,
                    graduation_status: status,
                    graduation_notes: bulkVerdictNotes.trim() || `Penetapan ${status === 'passed' ? 'LULUS' : 'TIDAK LULUS'} Massal oleh Admin`,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Penetapan Kelulusan Massal Berhasil!', {
                    description: data.message,
                });
                setShowBulkVerdictModal(false);
                setSelectedParticipantIds([]);
                setBulkVerdictNotes('');
                fetchSession();
            } else {
                toast.error('Gagal Menetapkan Kelulusan', {
                    description: data.error || 'Terjadi kesalahan sistem',
                });
            }
        } catch (err: any) {
            toast.error('Kesalahan Jaringan', { description: err.message });
        } finally {
            setIsSubmittingBulkVerdict(false);
        }
    };

    const openPublishPreview = async () => {
        if (!session) return;
        setShowPublishModal(true);
        setIsLoadingPublishPreview(true);
        setPublishPreview(null);
        setMarkMissingAbsent(false);
        setForfeitIncompleteRemedial(false);
        try {
            const response = await fetch(`/api/admin/sessions/${session.id}/publish-results`);
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Gagal memuat preview publikasi');
            setPublishPreview(data.data);
        } catch (error) {
            toast.error('Preview Publikasi Gagal', {
                description: error instanceof Error ? error.message : 'Terjadi kesalahan sistem',
            });
            setShowPublishModal(false);
        } finally {
            setIsLoadingPublishPreview(false);
        }
    };

    const handlePublishResults = async () => {
        if (!session) return;
        setIsTogglingScoreVisibility(true);
        try {
            const res = await fetch(`/api/admin/sessions/${session.id}/publish-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true, mark_missing_absent: markMissingAbsent, forfeit_incomplete_remedial: forfeitIncompleteRemedial }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Hasil Sesi Dipublikasikan', { description: data.message });
                setShowPublishModal(false);
                setMarkMissingAbsent(false);
                setForfeitIncompleteRemedial(false);
                fetchSession();
            } else {
                toast.error('Publikasi Hasil Gagal', {
                    description: data.error || 'Terjadi kesalahan sistem',
                });
                if (data.counts || data.blockers) {
                    setPublishPreview((previous: any) => ({
                        ...(previous || {}), counts: data.counts || previous?.counts,
                        blockers: data.blockers || previous?.blockers,
                        can_publish: false,
                    }));
                }
            }
        } catch (err: any) {
            toast.error('Kesalahan Jaringan', { description: err.message });
        } finally {
            setIsTogglingScoreVisibility(false);
        }
    };

    const handleReopenRevision = async () => {
        if (!session) return;
        setIsTogglingScoreVisibility(true);
        try {
            const res = await fetch(`/api/admin/sessions/${session.id}/toggle-score-visibility`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ show_score: false }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Gagal membuka revisi hasil');
            toast.success('Mode Revisi Dibuka', { description: data.message });
            fetchSession();
        } catch (error) {
            toast.error('Gagal Membuka Revisi', {
                description: error instanceof Error ? error.message : 'Terjadi kesalahan sistem',
            });
        } finally {
            setIsTogglingScoreVisibility(false);
        }
    };

    const handleToggleScoreVisibility = () => {
        if (session?.show_score || session?.result_state === 'published') handleReopenRevision();
        else openPublishPreview();
    };

    const handleDownloadBulkSheets = async (targetIds?: string[]) => {
        const idsToDownload = targetIds || selectedParticipantIds;
        if (idsToDownload.length === 0 || !session) {
            toast.error('Pilih setidaknya satu peserta untuk mengunduh lembar jawaban.');
            return;
        }
        setIsDownloadingBulkSheets(true);
        const toastId = toast.loading('Mengemas lembar jawaban peserta ke berkas ZIP...');
        try {
            const res = await fetch(`/api/admin/sessions/${session.id}/bulk-answer-sheets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participant_ids: idsToDownload }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Gagal mengunduh berkas ZIP lembar jawaban.');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeTitle = session.title.replace(/[^a-zA-Z0-9_-]/g, '_');
            a.download = `Lembar_Jawaban_${safeTitle}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Unduh Berhasil!', {
                id: toastId,
                description: `${idsToDownload.length} lembar jawaban berhasil diunduh.`,
            });
        } catch (err: any) {
            toast.error('Gagal Mengunduh ZIP', {
                id: toastId,
                description: err.message,
            });
        } finally {
            setIsDownloadingBulkSheets(false);
        }
    };

    const isAllSelected =
        filteredParticipants.length > 0 &&
        filteredParticipants.every((p) => selectedParticipantIds.includes(p.id));

    const state = getSessionState(session.start_time, session.end_time);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Navigation & SEB Badge */}
            <div className="flex items-center justify-between gap-4">
                <Link
                    href="/admin/sessions"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                    <ArrowLeft01Icon size={15} />
                    Kembali ke Daftar Sesi
                </Link>

                {isSeb && (
                    <a
                        href="/quit-seb"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 px-3 py-1 rounded-lg border border-red-200/60 transition-all active:scale-98"
                    >
                        <Logout01Icon size={14} />
                        Keluar SEB
                    </a>
                )}
            </div>

            {/* Header Title Section */}
            <div className="bg-white rounded-xl border border-black/5 p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                                {session.title}
                            </h1>

                            {state === 'active' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Berlangsung
                                </span>
                            ) : state === 'upcoming' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Akan Datang
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Selesai
                                </span>
                            )}
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                session.session_type === 'remedial'
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-sky-200 bg-sky-50 text-sky-800'
                            }`}>
                                {session.session_type === 'remedial'
                                    ? `Remedial siklus ${session.remedial_cycle || 1}`
                                    : 'Sesi reguler'}
                            </span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">ID Sesi: {session.id}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {userRole === 'admin' && (
                            <Link
                                href={`/admin/sessions/${session.id}/edit`}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-950 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 hover:border-slate-400 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                            >
                                <PencilEdit01Icon size={16} className="text-slate-600" />
                                <span>Edit Sesi</span>
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => handleDownloadBulkSheets(session.participants.map((p) => p.id))}
                            disabled={isDownloadingBulkSheets || session.participants.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow-sm border border-blue-700/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                            title="Unduh seluruh lembar jawaban peserta sesi ini dalam format berkas arsip ZIP"
                        >
                            {isDownloadingBulkSheets ? (
                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Archive size={16} />
                            )}
                            <span>Unduh ZIP Jawaban</span>
                        </button>
                        <a
                            href={`/api/admin/sessions/${session.id}/export`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow-sm border border-emerald-700/30 active:scale-95 transition-all cursor-pointer"
                        >
                            <Download01Icon size={16} />
                            <span>Export Excel</span>
                        </a>
                    </div>
                </div>
            </div>

            {session.session_type === 'remedial' && session.parent_session_id && (
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-xs font-semibold text-blue-950">Sesi ini hanya untuk pengerjaan remedial</p>
                        <p className="mt-0.5 text-[11px] text-blue-800">Keputusan lulus/tidak lulus dan penerbitan SKL tetap dilakukan dari sesi reguler induk setelah hasil remedial dipublikasikan.</p>
                    </div>
                    <Link href={`/admin/sessions/${session.parent_session_id}`} className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100">
                        Buka sesi induk
                    </Link>
                </div>
            )}

            {/* Information Grid: 3 Clean Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Jadwal */}
                <div className="bg-white rounded-xl border border-black/5 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b border-black/5 pb-2.5">
                        <Time02Icon size={16} className="text-slate-500" />
                        Jadwal Pelaksanaan
                    </div>
                    <div className="space-y-2.5 text-xs">
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Waktu Mulai</span>
                            <span className="font-medium text-foreground">{formatDate(session.start_time)}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Waktu Selesai</span>
                            <span className="font-medium text-foreground">{formatDate(session.end_time)}</span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Keamanan */}
                <div className="bg-white rounded-xl border border-black/5 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b border-black/5 pb-2.5">
                        <SecurityLockIcon size={16} className="text-slate-500" />
                        Pengaturan Keamanan
                    </div>
                    <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-[11px]">Safe Exam Browser (SEB)</span>
                            {session.require_seb ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900 text-white">
                                    <SecurityLockIcon size={11} /> SEB Wajib
                                </span>
                            ) : (
                                <span className="text-muted-foreground font-normal">Tidak Diwajibkan</span>
                            )}
                        </div>

                        {Boolean(session.require_seb && session.seb_config_key) && (
                            <div>
                                <span className="text-muted-foreground block text-[11px]">SEB Config Hash</span>
                                <span className="font-mono text-[10px] bg-slate-50 border border-black/5 p-1 rounded block truncate text-slate-700 mt-0.5">
                                    {session.seb_config_key}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-[11px]">Kamera Proctoring</span>
                            {session.enable_proctoring ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    <Camera01Icon size={11} /> Aktif
                                </span>
                            ) : (
                                <span className="text-muted-foreground font-normal">Non-aktif</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Card 3: Visibilitas & Modul */}
                <div className="bg-white rounded-xl border border-black/5 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b border-black/5 pb-2.5">
                        <FoldersIcon size={16} className="text-slate-500" />
                        Modul & Fitur
                    </div>
                    <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-muted-foreground text-[11px]">Visibilitas Nilai</span>
                            <div className="flex items-center gap-1.5">
                                {session.show_score ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                        <ViewIcon size={11} /> Ditampilkan
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                                        <ViewOffIcon size={11} /> Draft (Disembunyikan)
                                    </span>
                                )}
                                {userRole === 'admin' && (
                                    <button
                                        type="button"
                                        onClick={handleToggleScoreVisibility}
                                        disabled={isTogglingScoreVisibility}
                                        className="text-[10px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-all border border-black/5 cursor-pointer disabled:opacity-50"
                                        title={session.show_score ? 'Buka revisi hasil dan sembunyikan versi aktif' : 'Validasi dan publikasikan hasil sesi'}
                                    >
                                        {isTogglingScoreVisibility ? '...' : session.show_score ? 'Buka Revisi' : 'Publikasikan'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <span className="text-muted-foreground block text-[11px]">ID Modul Ujian</span>
                            <div className="flex items-center justify-between mt-0.5">
                                <span className="font-mono text-[10px] text-foreground truncate max-w-[140px]">
                                    {session.module_id}
                                </span>
                                <Link
                                    href="/admin/modules"
                                    className="text-[11px] font-medium text-slate-700 hover:text-slate-900 underline"
                                >
                                    Master Data &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Evaluation / Draft Score Banner */}
            {!session.show_score && (
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                            <SlidersHorizontal className="size-4" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-amber-950">Mode Evaluasi & Penyesuaian Nilai (Draft)</p>
                            <p className="text-[11px] text-amber-800 leading-snug">
                                Hasil sesi masih draft. Selesaikan penilaian dan adjustment sebelum publikasi atomik ke seluruh peserta.
                            </p>
                        </div>
                    </div>
                    {userRole === 'admin' && (
                        <button
                            type="button"
                            onClick={handleToggleScoreVisibility}
                            disabled={isTogglingScoreVisibility}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                            <ViewIcon size={13} />
                            <span>{isTogglingScoreVisibility ? 'Memproses...' : 'Preview & Publikasikan Hasil Sesi'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Participants Section */}
            <div className="bg-white rounded-xl border border-black/5 shadow-2xs overflow-hidden relative">
                {/* Participant Section Header */}
                <div className="p-4 sm:p-5 border-b border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <UserMultipleIcon size={18} className="text-slate-600" />
                        <h2 className="text-sm font-semibold text-foreground">Daftar Peserta Terdaftar</h2>
                        <span className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
                            {session.participants.length} Peserta
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                            <Search01Icon
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                type="text"
                                placeholder="Cari peserta..."
                                value={searchParticipant}
                                onChange={(e) => setSearchParticipant(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition-all"
                            />
                        </div>

                        <button
                            onClick={() => setShowBlastConfirm(true)}
                            disabled={isSendingBlast || session.participants.length === 0}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs disabled:opacity-50 shrink-0"
                        >
                            {isSendingBlast ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                                <MailSend01Icon size={14} />
                            )}
                            <span>Blast Pengingat</span>
                        </button>
                    </div>
                </div>

                <div className="border-b border-black/5 bg-slate-50/60 p-4" aria-label="Filter dan pengurutan hasil peserta">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <label className="space-y-1 lg:col-span-2">
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                <FilePenLine className="size-3" /> Ujian
                            </span>
                            <select
                                value={selectedExamId}
                                onChange={(event) => setSelectedExamId(event.target.value)}
                                className="h-9 w-full rounded-lg border border-black/10 bg-white px-3 text-xs font-medium"
                            >
                                {examOptions.length === 0 && <option value="">Belum ada ujian</option>}
                                {examOptions.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
                            </select>
                        </label>
                        <label className="space-y-1">
                            <span className="text-[11px] font-semibold text-muted-foreground">Nilai minimum</span>
                            <input
                                type="number" min={0} max={100} step="0.01" value={scoreMin}
                                onChange={(event) => setScoreMin(event.target.value)}
                                className="h-9 w-full rounded-lg border border-black/10 bg-white px-3 text-xs tabular-nums"
                                placeholder="0"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[11px] font-semibold text-muted-foreground">Nilai maksimum</span>
                            <input
                                type="number" min={0} max={100} step="0.01" value={scoreMax}
                                onChange={(event) => setScoreMax(event.target.value)}
                                className="h-9 w-full rounded-lg border border-black/10 bg-white px-3 text-xs tabular-nums"
                                placeholder="100"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                <Filter className="size-3" /> Status evaluasi
                            </span>
                            <select
                                value={evaluationFilter || 'all'}
                                onChange={(event) => setEvaluationFilter(event.target.value as typeof evaluationFilter)}
                                className="h-9 w-full rounded-lg border border-black/10 bg-white px-3 text-xs font-medium"
                            >
                                <option value="all">Semua status</option>
                                <option value="draft">Draft</option>
                                <option value="grading_pending">Menunggu penilaian</option>
                                <option value="remedial_required">Perlu remedial</option>
                                <option value="remedial_exhausted">Remedial habis</option>
                                <option value="ready_for_graduation">Siap keputusan</option>
                            </select>
                        </label>
                        <label className="space-y-1">
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                <ArrowDownUp className="size-3" /> Urutan nilai
                            </span>
                            <select
                                value={scoreSort}
                                onChange={(event) => setScoreSort(event.target.value as typeof scoreSort)}
                                className="h-9 w-full rounded-lg border border-black/10 bg-white px-3 text-xs font-medium"
                            >
                                <option value="default">Urutan default</option>
                                <option value="desc">Tertinggi ke terendah</option>
                                <option value="asc">Terendah ke tertinggi</option>
                            </select>
                        </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-muted-foreground" role="status">
                            Menampilkan <strong className="text-foreground">{filteredParticipants.length}</strong> dari {session.participants.length} peserta
                        </span>
                        {(scoreMin || scoreMax || scoreSort !== 'default' || evaluationFilter !== 'all') && (
                            <button
                                type="button"
                                onClick={() => { setScoreMin(''); setScoreMax(''); setScoreSort('default'); setEvaluationFilter('all'); }}
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-100"
                            >
                                <RotateCcw className="size-3" /> Reset filter nilai
                            </button>
                        )}
                    </div>
                    {scoreMin !== '' && scoreMax !== '' && Number(scoreMin) > Number(scoreMax) && (
                        <p className="mt-2 text-xs font-medium text-red-600" role="alert">Nilai minimum tidak boleh lebih besar dari nilai maksimum.</p>
                    )}
                </div>

                {/* Batch Actions Bar (when >= 1 participant selected) */}
                {selectedParticipantIds.length > 0 && (
                    <div className="p-3 bg-slate-50 border-b border-black/5 flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-150">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-mono">
                                {selectedParticipantIds.length} Peserta Dipilih
                            </span>
                            <span className="text-muted-foreground text-xs hidden sm:inline">
                                Aksi massal untuk penetapan kelulusan & waktu
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {userRole === 'admin' && (
                                <>
                                    {session.session_type !== 'remedial' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setBulkVerdictStatus('passed');
                                                    setShowBulkVerdictModal(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-sm border border-emerald-700/30 active:scale-95 cursor-pointer"
                                            >
                                                <CheckCircle2 className="size-3.5" />
                                                <span>Luluskan Massal</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setBulkVerdictStatus('failed');
                                                    setShowBulkVerdictModal(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-sm border border-rose-700/30 active:scale-95 cursor-pointer"
                                            >
                                                <AlertCircle className="size-3.5" />
                                                <span>Tidak Luluskan Massal</span>
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkScoreModal(true)}
                                        disabled={!selectedExamModuleItemId}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-sm border border-indigo-700/30 active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                        title={selectedExamModuleItemId ? 'Sesuaikan nilai ujian seluruh peserta terpilih sekaligus' : 'Exam ini tidak tersedia pada modul sesi remedial'}
                                    >
                                        <SlidersHorizontal className="size-3.5" />
                                        <span>Adjust Nilai Massal</span>
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => handleDownloadBulkSheets()}
                                disabled={isDownloadingBulkSheets}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-sm border border-blue-700/30 active:scale-95 cursor-pointer disabled:opacity-50"
                                title="Unduh lembar jawaban peserta terpilih dalam berkas ZIP"
                            >
                                {isDownloadingBulkSheets ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Download01Icon size={14} />
                                )}
                                <span>Unduh Jawaban (ZIP)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBulkTimeModal(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs hover:shadow-sm border border-slate-950/20 active:scale-95 cursor-pointer"
                            >
                                <Time02Icon size={14} />
                                <span>Tambah Waktu</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedParticipantIds([])}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs transition-all active:scale-95 cursor-pointer"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                )}

                {/* Participant Table */}
                {filteredParticipants.length === 0 ? (
                    <div className="p-10 text-center text-xs text-muted-foreground">
                        {searchParticipant
                            ? 'Tidak ada peserta yang cocok dengan kata kunci pencarian.'
                            : 'Belum ada peserta yang didaftarkan pada sesi ini.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-xs">
                            <thead className="bg-slate-50/80 border-b border-black/5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-slate-900 focus:ring-slate-400 cursor-pointer accent-slate-900"
                                            aria-label="Pilih semua peserta"
                                        />
                                    </th>
                                    <th className="px-3 py-3 w-12 text-center">No</th>
                                    <th className="px-4 py-3">Peserta & NIP</th>
                                    <th className="px-4 py-3">Instansi & Batch</th>
                                    <th className="px-4 py-3 w-40">Progres & Nilai</th>
                                    <th className="px-4 py-3 text-center w-44">Evaluasi / Kelulusan</th>
                                    <th className="px-4 py-3 text-center w-40">SKL & Sertifikat</th>
                                    <th className="px-4 py-3 text-center w-28">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {paginatedParticipants.map((p, idx) => {
                                    const isSelected = selectedParticipantIds.includes(p.id);
                                    const isPassed = p.graduation_status === 'passed';
                                    const isFailed = p.graduation_status === 'failed';
                                    const selectedExamResult = p.exam_results?.find((result) => result.source_exam_id === selectedExamId) || null;
                                    const participantForSelectedExam: User = selectedExamResult ? {
                                        ...p,
                                        final_score: selectedExamResult.final_score,
                                        original_score: selectedExamResult.original_score,
                                        score_adjustment: selectedExamResult.score_adjustment,
                                        adjustment_reason: selectedExamResult.adjustment_reason,
                                        adjusted_at: selectedExamResult.adjusted_at,
                                        exam_module_item_id: selectedExamResult.module_item_id,
                                    } : p;
                                    const canSetVerdict = session.result_state === 'published'
                                        && session.session_type !== 'remedial' && (
                                        p.evaluation_status === 'ready_for_graduation'
                                        || p.evaluation_status === 'remedial_exhausted'
                                    );

                                    return (
                                        <tr
                                            key={p.id}
                                            className={`hover:bg-slate-50/60 transition-colors ${
                                                isSelected ? 'bg-slate-100/70' : ''
                                            }`}
                                        >
                                            <td className="px-4 py-3.5 text-center align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleToggleParticipant(p.id, e.target.checked)}
                                                    className="w-4 h-4 rounded border-gray-300 text-slate-900 focus:ring-slate-400 cursor-pointer accent-slate-900"
                                                    aria-label={`Pilih ${p.full_name}`}
                                                />
                                            </td>
                                            <td className="px-3 py-3.5 text-center text-muted-foreground font-mono">
                                                {startIndex + idx + 1}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-foreground">{p.full_name || p.username}</span>
                                                        {p.nip && (
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                                                                {p.nip}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                                                        <span>{p.username}</span>
                                                        {p.id_card_number && (
                                                            <>
                                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                                <span className="text-slate-600 dark:text-slate-300 font-medium">NIK: {p.id_card_number}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-muted-foreground">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-medium text-foreground">{p.institution || '-'}</span>
                                                    {p.batch && (
                                                        <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            {/^\d+$/.test(String(p.batch)) ? `Batch ${p.batch}` : p.batch}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 align-middle">
                                                <div className="space-y-1.5 min-w-[210px]">
                                                    {/* Real-time Activity Indicator */}
                                                    {p.current_activity?.type === 'exam' ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="relative flex h-2 w-2 flex-shrink-0">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                                                <FilePenLine size={12} className="text-blue-600 flex-shrink-0" />
                                                                <span className="max-w-[170px] truncate" title={p.current_activity.title || 'Ujian'}>
                                                                    {p.current_activity.title || 'Ujian'}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ) : p.current_activity?.type === 'training' ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="relative flex h-2 w-2 flex-shrink-0">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800">
                                                                <BookOpen size={12} className="text-teal-600 flex-shrink-0" />
                                                                <span className="max-w-[170px] truncate" title={p.current_activity.title || 'Materi'}>
                                                                    {p.current_activity.title || 'Materi'}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ) : p.current_activity?.type === 'completed' || p.progress === 100 ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                                                <CheckCircle2 size={12} className="text-emerald-600 flex-shrink-0" />
                                                                <span>Semua Selesai</span>
                                                            </span>
                                                        </div>
                                                    ) : p.current_activity?.type === 'in_between' ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                                                <Clock3 size={12} className="text-amber-600 flex-shrink-0" />
                                                                <span className="max-w-[170px] truncate" title={p.current_activity.title || 'Langkah Berikutnya'}>
                                                                    Next: {p.current_activity.title || 'Langkah Berikutnya'}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                                                <span>Belum Memulai</span>
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Progress Bar & Details */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${
                                                                    p.progress === 100 ? 'bg-emerald-500' : 'bg-slate-800 dark:bg-slate-200'
                                                                }`}
                                                                style={{ width: `${p.progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-mono font-medium text-muted-foreground w-8 text-right">
                                                            {p.progress}%
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                                                        <span>{p.completed_items}/{p.total_items} item</span>
                                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                            <span>Nilai:</span>
                                                            <span className={`font-semibold ${
                                                                selectedExamResult?.final_score !== null && selectedExamResult?.final_score !== undefined
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : 'text-slate-400'
                                                            }`}>
                                                                {selectedExamResult?.final_score !== null && selectedExamResult?.final_score !== undefined
                                                                    ? Number(selectedExamResult.final_score).toFixed(1)
                                                                    : '-'}
                                                            </span>
                                                            {selectedExamResult?.score_adjustment !== null && selectedExamResult?.score_adjustment !== undefined && Number(selectedExamResult.score_adjustment) !== 0 && (
                                                                <span
                                                                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                                                        Number(selectedExamResult.score_adjustment) > 0
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                                                    }`}
                                                                    title={`Nilai Asli: ${selectedExamResult.original_score ?? '-'} | Penyesuaian: ${Number(selectedExamResult.score_adjustment) > 0 ? '+' : ''}${selectedExamResult.score_adjustment} | Alasan: ${selectedExamResult.adjustment_reason || '-'}`}
                                                                >
                                                                    {Number(selectedExamResult.score_adjustment) > 0 ? `+${Number(selectedExamResult.score_adjustment).toFixed(1)}` : Number(selectedExamResult.score_adjustment).toFixed(1)}
                                                                </span>
                                                            )}
                                                            {userRole === 'admin' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedParticipantForScoreAdjust(participantForSelectedExam)}
                                                                    disabled={!selectedExamResult?.module_item_id || session.result_state === 'published'}
                                                                    className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
                                                                    title={session.result_state === 'published' ? 'Buka revisi hasil sebelum adjustment' : 'Sesuaikan nilai ujian terpilih'}
                                                                >
                                                                    <SlidersHorizontal className="size-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-center align-middle">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                                                        p.evaluation_status === 'ready_for_graduation'
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            : p.evaluation_status === 'remedial_required'
                                                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                                : p.evaluation_status === 'remedial_exhausted'
                                                                    ? 'border-red-200 bg-red-50 text-red-700'
                                                                    : 'border-slate-200 bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {p.evaluation_status === 'ready_for_graduation' ? 'Tidak perlu remedial'
                                                            : p.evaluation_status === 'remedial_required' ? 'Perlu remedial'
                                                                : p.evaluation_status === 'remedial_exhausted' ? 'Remedial habis'
                                                                    : p.evaluation_status === 'grading_pending' ? 'Menunggu penilaian' : 'Draft'}
                                                    </span>
                                                <button
                                                    type="button"
                                                    onClick={() => canSetVerdict && setSelectedParticipantForVerdict(p)}
                                                    disabled={!canSetVerdict && !isPassed && !isFailed}
                                                    className="inline-flex items-center gap-1.5 rounded-full text-xs font-bold transition-all enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                                    title={canSetVerdict || isPassed || isFailed ? 'Tetapkan / ubah keputusan kelulusan' : 'Selesaikan publikasi dan remedial terlebih dahulu'}
                                                >
                                                    {isPassed ? (
                                                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full shadow-2xs">
                                                            <CheckCircle2 size={13} className="text-emerald-600" /> LULUS
                                                        </span>
                                                    ) : isFailed ? (
                                                        <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-300 px-3 py-1 rounded-full shadow-2xs">
                                                            <AlertCircle size={13} className="text-rose-600" /> TIDAK LULUS
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-300 px-3 py-1 rounded-full shadow-2xs">
                                                            <Sparkles size={13} className="text-amber-600" /> MENUNGGU
                                                        </span>
                                                    )}
                                                </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 align-middle">
                                                {isPassed ? (
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {/* SKL Status Pill */}
                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                            <a
                                                                href={`/api/participant/sessions/${session.id}/skl?userId=${p.id}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors border border-black/5 shadow-2xs"
                                                                title="Buka / Cetak Surat Keterangan Lulus (SKL)"
                                                            >
                                                                <Printer className="size-3 text-slate-700" /> Cetak SKL
                                                            </a>

                                                            {p.session_participant_id && (
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        const url = `${window.location.origin}/verify/skl/${p.session_participant_id}`;
                                                                        await navigator.clipboard.writeText(url);
                                                                        toast.success('Tautan Verifikasi SKL Berhasil Disalin!');
                                                                    }}
                                                                    className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
                                                                    title="Salin Link Verifikasi Publik SKL"
                                                                >
                                                                    <Copy className="size-3.5" />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Official Certificate Status */}
                                                        {p.certificate_file_url ? (
                                                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-lg">
                                                                <a
                                                                    href={p.certificate_file_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                                                                    title="Lihat Berkas Sertifikat Resmi"
                                                                >
                                                                    <FileBadge2 className="size-3.5 text-emerald-600" /> Sertifikat Terbit
                                                                </a>
                                                                {userRole === 'admin' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedParticipantForCert(p)}
                                                                        className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 underline pl-1 border-l border-emerald-300"
                                                                        title="Ganti / Perbarui Berkas Sertifikat"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : userRole === 'admin' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedParticipantForCert(p)}
                                                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer active:scale-95"
                                                                title="Unggah Berkas Sertifikat Resmi untuk Peserta Ini"
                                                            >
                                                                <UploadCloud className="size-3.5 text-amber-700" /> + Upload Sertifikat
                                                            </button>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic">Belum Diterbitkan</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-[11px] text-slate-400 italic">
                                                        Belum Lulus
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-center align-middle">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {userRole === 'admin' && (
                                                        <>
                                                            {session.require_seb && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSebOverride(p)}
                                                                    disabled={sebOverrideParticipantId === p.id}
                                                                    className="inline-flex items-center justify-center p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200 disabled:opacity-50"
                                                                    title="Berikan override SEB selama 15 menit"
                                                                >
                                                                    {sebOverrideParticipantId === p.id ? (
                                                                        <span className="size-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" />
                                                                    ) : (
                                                                        <ShieldCheck className="size-4" />
                                                                    )}
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => canSetVerdict && setSelectedParticipantForVerdict(p)}
                                                                disabled={!canSetVerdict}
                                                                className="inline-flex items-center justify-center p-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors border border-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                                                                title={canSetVerdict ? 'Tetapkan / Ubah Keputusan Kelulusan' : 'Peserta belum siap memasuki keputusan kelulusan'}
                                                            >
                                                                <Award className="size-4 text-slate-700" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <a
                                                        href={`/api/admin/sessions/${session.id}/participants/${p.id}/answer-sheet`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center justify-center p-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors border border-black/5"
                                                        title="Buka / Cetak Lembar Pengerjaan & Jawaban Resmi Peserta"
                                                    >
                                                        <FileText className="size-4 text-slate-700" />
                                                    </a>
                                                    <Link
                                                        href={`/admin/sessions/${session.id}/participants/${p.id}`}
                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors border border-black/5"
                                                    >
                                                        Detail
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="p-4 border-t border-black/5">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            </div>

            {/* Individual Graduation Verdict Modal */}
            <GraduationVerdictModal
                isOpen={!!selectedParticipantForVerdict}
                onClose={() => setSelectedParticipantForVerdict(null)}
                onSuccess={fetchSession}
                sessionId={session.id}
                participant={selectedParticipantForVerdict}
            />

            {/* Official Certificate Upload Modal */}
            <CertificateUploadModal
                isOpen={!!selectedParticipantForCert}
                onClose={() => setSelectedParticipantForCert(null)}
                onSuccess={fetchSession}
                sessionId={session.id}
                participant={selectedParticipantForCert}
            />

            {/* Individual Score Adjustment Modal */}
            <ScoreAdjustmentModal
                isOpen={!!selectedParticipantForScoreAdjust}
                onClose={() => setSelectedParticipantForScoreAdjust(null)}
                onSuccess={fetchSession}
                sessionId={session.id}
                participant={selectedParticipantForScoreAdjust}
            />

            {/* Bulk Score Adjustment Modal */}
            <BulkScoreAdjustmentModal
                isOpen={showBulkScoreModal}
                onClose={() => setShowBulkScoreModal(false)}
                onSuccess={() => {
                    fetchSession();
                    setSelectedParticipantIds([]);
                }}
                sessionId={session.id}
                participantIds={selectedParticipantIds}
                moduleItemId={selectedExamModuleItemId}
                participantCount={selectedParticipantIds.length}
            />

            {showPublishModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" onClick={() => !isTogglingScoreVisibility && setShowPublishModal(false)}>
                    <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="publish-results-title" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between border-b p-5">
                            <div>
                                <h2 id="publish-results-title" className="text-base font-bold">Publikasikan Hasil Sesi</h2>
                                <p className="mt-1 text-xs text-muted-foreground">Nilai tertinggi, passing grade, status remedial, dan notifikasi akan disimpan sebagai satu versi.</p>
                            </div>
                            <button type="button" onClick={() => setShowPublishModal(false)} className="min-h-8 min-w-8 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Tutup preview publikasi">×</button>
                        </div>
                        <div className="space-y-5 p-5">
                            {isLoadingPublishPreview ? (
                                <div className="py-12 text-center text-sm text-muted-foreground">Memeriksa kesiapan seluruh hasil...</div>
                            ) : publishPreview ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {[
                                            ['Peserta', publishPreview.counts?.participants || 0],
                                            ['Siap keputusan', publishPreview.counts?.ready_for_graduation || 0],
                                            ['Peserta remedial', publishPreview.counts?.remedial_participants || 0],
                                            ['Tidak tuntas', publishPreview.counts?.remedial_exhausted_participants || 0],
                                        ].map(([label, value]) => (
                                            <div key={String(label)} className="rounded-xl border bg-slate-50 p-3">
                                                <p className="text-[11px] text-muted-foreground">{label}</p>
                                                <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {(publishPreview.counts?.grading_pending > 0 || publishPreview.counts?.absent > 0 || publishPreview.counts?.current_cycle_incomplete > 0) && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950" role="alert">
                                            <p className="font-bold">Ditemukan blocker publikasi</p>
                                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                                 {publishPreview.counts.grading_pending > 0 && <li>{publishPreview.counts.grading_pending} hasil masih menunggu penilaian esai.</li>}
                                                 {publishPreview.counts.current_cycle_incomplete > 0 && <li>{publishPreview.counts.current_cycle_incomplete} pengerjaan pada siklus remedial ini belum selesai.</li>}
                                                {publishPreview.counts.absent > 0 && <li>{publishPreview.counts.absent} hasil belum mempunyai nilai.</li>}
                                            </ul>
                                        </div>
                                    )}
                                    {publishPreview.counts?.absent > 0 && publishPreview.counts?.grading_pending === 0 && (
                                        <label className="flex items-start gap-3 rounded-xl border p-3 text-xs">
                                            <input type="checkbox" checked={markMissingAbsent} onChange={(event) => setMarkMissingAbsent(event.target.checked)} className="mt-0.5 size-4" />
                                            <span><strong>Tandai hasil tanpa nilai sebagai Tidak Mengikuti.</strong><br /><span className="text-muted-foreground">Peserta tersebut tidak dapat diluluskan dan hasil ini tercatat pada snapshot publikasi.</span></span>
                                        </label>
                                    )}
                                    {publishPreview.counts?.current_cycle_incomplete > 0 && publishPreview.counts?.grading_pending === 0 && (
                                        <label className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs">
                                            <input type="checkbox" checked={forfeitIncompleteRemedial} onChange={(event) => setForfeitIncompleteRemedial(event.target.checked)} className="mt-0.5 size-4" />
                                            <span><strong>Tutup siklus bagi peserta yang tidak mengerjakan remedial.</strong><br /><span className="text-muted-foreground">Nilai terbaik sebelumnya tetap digunakan. Peserta tersebut tidak mendapatkan kesempatan remedial tambahan pada siklus ini.</span></span>
                                        </label>
                                    )}
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
                                        Setelah dipublikasikan, adjustment dikunci. Gunakan <strong>Buka Revisi</strong> untuk membuat versi hasil baru.
                                    </div>
                                </>
                            ) : null}
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t bg-slate-50 p-4 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => setShowPublishModal(false)} disabled={isTogglingScoreVisibility} className="min-h-10 rounded-xl border bg-white px-4 text-xs font-semibold">Batal</button>
                            <button
                                type="button"
                                onClick={handlePublishResults}
                                disabled={isTogglingScoreVisibility || isLoadingPublishPreview || !publishPreview || (publishPreview.counts?.grading_pending > 0) || (publishPreview.counts?.current_cycle_incomplete > 0 && !forfeitIncompleteRemedial) || (publishPreview.counts?.absent > 0 && !markMissingAbsent)}
                                className="min-h-10 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isTogglingScoreVisibility ? 'Mempublikasikan...' : `Publikasikan Versi ${(publishPreview?.current_version || 0) + 1}`}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {/* Bulk Verdict Confirmation Modal */}
            {showBulkVerdictModal &&
                typeof window !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
                        onClick={() => setShowBulkVerdictModal(false)}
                    >
                        <div
                            className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-black/5 p-6 space-y-4 animate-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                                    bulkVerdictStatus === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {bulkVerdictStatus === 'passed' ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkVerdictModal(false)}
                                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <Cancel01Icon size={16} />
                                </button>
                            </div>

                            <div className="space-y-1">
                                <h3 className="font-semibold text-base text-foreground">
                                    Tetapkan {bulkVerdictStatus === 'passed' ? 'LULUS' : 'TIDAK LULUS'} Massal
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Anda akan menetapkan status{' '}
                                    <strong className="text-foreground">{bulkVerdictStatus === 'passed' ? 'LULUS' : 'TIDAK LULUS'}</strong>{' '}
                                    untuk <strong className="text-foreground">{selectedParticipantIds.length} peserta</strong> yang dipilih.
                                </p>
                            </div>

                            <div className="space-y-1.5 pt-1">
                                <label className="block text-xs font-medium text-foreground">
                                    Catatan Keputusan Kelulusan:
                                </label>
                                <textarea
                                    value={bulkVerdictNotes}
                                    onChange={(e) => setBulkVerdictNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition-all resize-none"
                                    placeholder={bulkVerdictStatus === 'passed' ? 'Memenuhi seluruh kriteria kelulusan pelatihan.' : 'Belum memenuhi nilai batas kelulusan.'}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkVerdictModal(false)}
                                    disabled={isSubmittingBulkVerdict}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleExecuteBulkVerdict(bulkVerdictStatus)}
                                    disabled={isSubmittingBulkVerdict || selectedParticipantIds.length === 0}
                                    className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors shadow-2xs disabled:opacity-50 inline-flex items-center gap-1.5 ${
                                        bulkVerdictStatus === 'passed' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {isSubmittingBulkVerdict ? 'Memproses...' : `Ya, Tetapkan ${bulkVerdictStatus === 'passed' ? 'Lulus' : 'Tidak Lulus'}`}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Bulk Time Extension Modal */}
            {showBulkTimeModal &&
                typeof window !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
                        onClick={() => setShowBulkTimeModal(false)}
                    >
                        <div
                            className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-black/5 p-6 space-y-4 animate-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <div className="w-11 h-11 bg-slate-100 text-slate-800 rounded-lg flex items-center justify-center">
                                    <Time02Icon size={22} />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkTimeModal(false)}
                                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <Cancel01Icon size={16} />
                                </button>
                            </div>

                            <div className="space-y-1">
                                <h3 className="font-semibold text-base text-foreground">
                                    Tambah Waktu Massal
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Tambahkan durasi pengerjaan ujian untuk{' '}
                                    <strong className="text-foreground">{selectedParticipantIds.length} peserta</strong> yang dipilih.
                                </p>
                            </div>

                            <div className="space-y-3 pt-1">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1.5">
                                        Pilihan Tambahan Waktu (Menit):
                                    </label>
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {[10, 15, 30, 60].map((mins) => (
                                            <button
                                                key={mins}
                                                type="button"
                                                onClick={() => setBulkExtraMinutes(mins)}
                                                className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                                    bulkExtraMinutes === mins
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                +{mins} mnt
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="number"
                                        min="1"
                                        max="180"
                                        value={bulkExtraMinutes}
                                        onChange={(e) => setBulkExtraMinutes(Number(e.target.value))}
                                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition-all font-mono"
                                        placeholder="Atau masukkan menit manual (contoh: 15)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">
                                        Alasan Tambahan Waktu (Audit Log):
                                    </label>
                                    <textarea
                                        value={bulkReason}
                                        onChange={(e) => setBulkReason(e.target.value)}
                                        rows={2}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition-all resize-none"
                                        placeholder="Contoh: Gangguan koneksi di lab komputer"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkTimeModal(false)}
                                    disabled={isSubmittingBulk}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteBulkExtension}
                                    disabled={isSubmittingBulk || selectedParticipantIds.length === 0}
                                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50 inline-flex items-center gap-1.5"
                                >
                                    {isSubmittingBulk ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Time02Icon size={14} />
                                    )}
                                    <span>Terapkan Tambahan</span>
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Blast Confirmation Modal */}
            {showBlastConfirm &&
                typeof window !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
                        onClick={() => setShowBlastConfirm(false)}
                    >
                        <div
                            className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-black/5 p-6 space-y-4 animate-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-11 h-11 bg-slate-100 text-slate-800 rounded-lg flex items-center justify-center">
                                <MailSend01Icon size={22} />
                            </div>

                            <div className="space-y-1">
                                <h3 className="font-semibold text-base text-foreground">Kirim Broadcast Email?</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Anda akan mengirimkan email pemberitahuan jadwal sesi pelatihan ini ke{' '}
                                    <strong className="text-foreground">{session.participants.length} peserta</strong>{' '}
                                    terdaftar.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
                                <button
                                    onClick={() => setShowBlastConfirm(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleBlastEmail}
                                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
                                >
                                    Ya, Kirim Email
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
