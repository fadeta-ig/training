'use client';

import { useCallback, useState, useEffect, use, useRef } from 'react';
import {
    HelpCircleIcon,
    PlusSignIcon,
    Search01Icon,
    StarIcon,
    Tick02Icon,
    Cancel01Icon,
} from 'hugeicons-react';
import {
    Shuffle,
    ArrowDownUp,
    Undo2,
    Save,
    MoveVertical,
    Check,
    AlertCircle,
    Info,
    RotateCcw,
    FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';
import { useUndoStack } from '@/hooks/useUndoStack';
import { useConfirm } from '@/hooks/useConfirm';
import { SortableQuestionItem, type QuestionItemData } from '@/components/admin/SortableQuestionItem';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    multiple_choice: { label: 'Pilihan Ganda', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    multiple_select: { label: 'Multi-Jawaban', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    true_false: { label: 'Benar / Salah', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    short_answer: { label: 'Isian Singkat', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    essay: { label: 'Esai', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
    matching: { label: 'Menjodohkan', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
};

type Exam = {
    id: string;
    title: string;
    duration_minutes: number;
    passing_grade: number;
};

export default function QuestionBankPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const examId = resolvedParams.id;

    const [questions, setQuestions] = useState<QuestionItemData[]>([]);
    const [localOrder, setLocalOrder] = useState<string[]>([]);
    const [exam, setExam] = useState<Exam | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string>('');

    // Reorder & Action states
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isShuffling, setIsShuffling] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isUndoing, setIsUndoing] = useState(false);

    // Undo stack with max 5 levels
    const undoStack = useUndoStack<string[]>(5);
    const { confirm, ConfirmComponent } = useConfirm();

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [qRes, eRes] = await Promise.all([
                fetch(`/api/questions?examId=${examId}`),
                fetch(`/api/exams/${examId}`),
            ]);
            const qData = await qRes.json();
            const eData = await eRes.json();

            if (qData.success) {
                const fetchedQuestions: QuestionItemData[] = qData.data;
                setQuestions(fetchedQuestions);
                setLocalOrder(fetchedQuestions.map((q) => q.id));
                setIsDirty(false);
            }
            if (eData.success) setExam(eData.data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal memuat data';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [examId]);

    useEffect(() => {
        fetchData();
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setUserRole(data.data.role);
                }
            })
            .catch(() => {});
    }, [fetchData]);

    // Navigation guard when there are unsaved reordering changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Drag and Drop global monitor
    useEffect(() => {
        if (!isReorderMode) return;

        return monitorForElements({
            onDrop: ({ source, location }) => {
                const destination = location.current.dropTargets[0];
                if (!destination) return;

                const sourceId = source.data.questionId as string;
                const destId = destination.data.questionId as string;
                if (!sourceId || !destId || sourceId === destId) return;

                const edge = extractClosestEdge(destination.data);

                setLocalOrder((prev) => {
                    const sourceIndex = prev.indexOf(sourceId);
                    const destIndex = prev.indexOf(destId);
                    if (sourceIndex === -1 || destIndex === -1) return prev;

                    const updated = [...prev];
                    updated.splice(sourceIndex, 1);
                    const targetIndex = edge === 'top' ? destIndex : destIndex + 1;
                    const finalIndex = sourceIndex < destIndex ? targetIndex - 1 : targetIndex;
                    updated.splice(finalIndex, 0, sourceId);
                    return updated;
                });

                setIsDirty(true);
            },
        });
    }, [isReorderMode]);

    // Automatically disable reorder mode if user applies search/filter to avoid ambiguity
    const isFilterActive = searchQuery.trim() !== '' || activeTypeFilter !== null;
    useEffect(() => {
        if (isFilterActive && isReorderMode) {
            setIsReorderMode(false);
        }
    }, [isFilterActive, isReorderMode]);

    // Sort questions according to localOrder
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions: QuestionItemData[] = localOrder
        .map((id) => questionMap.get(id))
        .filter((q): q is QuestionItemData => q !== undefined);

    // Filter questions by search text and question type
    const filtered = orderedQuestions.filter((q) => {
        const matchesSearch = searchQuery === '' || q.question_text.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = activeTypeFilter === null || q.question_type === activeTypeFilter;
        return matchesSearch && matchesType;
    });

    const isVirtual = filtered.length > 50;

    const {
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        paginatedItems: paginatedQuestions,
        setPage,
        setPageSize,
    } = usePagination({ items: filtered, initialPageSize: 10 });

    const virtualizer = useVirtualizer({
        count: isVirtual ? filtered.length : 0,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => 100,
        useFlushSync: false,
        overscan: 5,
    });

    const totalPts = questions.reduce((s, q) => s + (q.points || 1), 0);
    const typeCounts = questions.reduce<Record<string, number>>((a, q) => {
        const t = q.question_type || 'multiple_choice';
        a[t] = (a[t] || 0) + 1;
        return a;
    }, {});

    // Save Reordered Questions
    const handleSaveOrder = async () => {
        if (!isDirty || isSaving) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/questions/reorder', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examId,
                    orderedIds: localOrder,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menyimpan urutan soal');

            setIsDirty(false);
            toast.success('Urutan soal berhasil disimpan');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan urutan soal';
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    // Toggle Reorder Mode with safety check
    const handleToggleReorderMode = async () => {
        if (isFilterActive) {
            toast.info('Nonaktifkan filter atau pencarian terlebih dahulu untuk menyusun urutan');
            return;
        }
        if (isVirtual) {
            toast.info('Exam memiliki lebih dari 50 soal. Gunakan fitur Acak Semua atau Urut Nomor untuk pengaturan massal');
            return;
        }

        if (isReorderMode && isDirty) {
            const shouldSave = await confirm({
                title: 'Simpan Perubahan Urutan?',
                message: 'Ada perubahan urutan soal yang belum disimpan. Apakah Anda ingin menyimpannya sekarang sebelum keluar?',
                isDestructive: false,
                confirmLabel: 'Ya, Simpan',
                cancelLabel: 'Buang Perubahan',
            });

            if (shouldSave) {
                await handleSaveOrder();
            } else {
                // Restore to original order
                setLocalOrder(questions.map((q) => q.id));
                setIsDirty(false);
            }
        }

        setIsReorderMode(!isReorderMode);
    };

    // Shuffle Questions with confirmation
    const handleShuffle = async () => {
        if (isShuffling) return;

        const isConfirmed = await confirm({
            title: 'Acak Nomor Soal?',
            message: 'Urutan seluruh soal dalam ujian ini akan diacak secara otomatis. Anda dapat menggunakan fitur Undo (maksimal 5 kali) jika ingin membatalkan.',
            isDestructive: false,
            confirmLabel: 'Ya, Acak Soal',
            cancelLabel: 'Batal',
        });
        if (!isConfirmed) return;

        setIsShuffling(true);
        try {
            const res = await fetch('/api/questions/shuffle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengacak soal');

            if (data.data?.previousOrder) {
                undoStack.push(data.data.previousOrder);
            }
            if (data.data?.newOrder) {
                setLocalOrder(data.data.newOrder);
            }
            setIsDirty(false);
            toast.success('Soal berhasil diacak secara otomatis');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal mengacak soal';
            toast.error(message);
        } finally {
            setIsShuffling(false);
        }
    };

    // Sequential Reset with confirmation
    const handleSequential = async () => {
        if (isResetting) return;

        const isConfirmed = await confirm({
            title: 'Atur Nomor Berurutan?',
            message: 'Urutan nomor soal akan diatur ulang secara berurutan. Anda dapat menggunakan fitur Undo jika ingin mengembalikannya.',
            isDestructive: false,
            confirmLabel: 'Ya, Urutkan',
            cancelLabel: 'Batal',
        });
        if (!isConfirmed) return;

        setIsResetting(true);
        try {
            const res = await fetch('/api/questions/sequential', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengatur urutan nomor');

            if (data.data?.previousOrder) {
                undoStack.push(data.data.previousOrder);
            }
            if (data.data?.newOrder) {
                setLocalOrder(data.data.newOrder);
            }
            setIsDirty(false);
            toast.success('Urutan nomor soal berhasil diatur berurutan');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal mengatur urutan nomor';
            toast.error(message);
        } finally {
            setIsResetting(false);
        }
    };

    // Undo Action
    const handleUndo = async () => {
        if (!undoStack.canUndo || isUndoing) return;
        const targetOrder = undoStack.pop();
        if (!targetOrder) return;

        setIsUndoing(true);
        try {
            const res = await fetch('/api/questions/reorder', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examId,
                    orderedIds: targetOrder,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengembalikan urutan');

            setLocalOrder(targetOrder);
            setIsDirty(false);
            toast.success('Urutan soal berhasil dikembalikan (Undo)');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal mengembalikan urutan';
            toast.error(message);
        } finally {
            setIsUndoing(false);
        }
    };

    // Delete Question
    const deleteQuestion = async (id: string) => {
        try {
            const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus soal');
            setDeleteConfirmId(null);
            toast.success('Soal berhasil dihapus');
            setQuestions((prev) => prev.filter((item) => item.id !== id));
            setLocalOrder((prev) => prev.filter((item) => item !== id));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus soal';
            toast.error(message);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const renderAnswerPreview = (q: QuestionItemData) => {
        const qType = q.question_type || 'multiple_choice';
        const parsed = q.options_json
            ? typeof q.options_json === 'string'
                ? JSON.parse(q.options_json)
                : q.options_json
            : null;

        switch (qType) {
            case 'multiple_choice': {
                if (!Array.isArray(parsed)) return null;
                return (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {parsed.map((opt: any, i: number) => {
                            const text = typeof opt === 'string' ? opt : opt.text;
                            const image = typeof opt === 'object' ? opt.image : null;
                            const ok = q.correct_option_index === i;
                            return (
                                <div
                                    key={i}
                                    className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${
                                        ok
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                                            : 'bg-white/60 border-black/5 text-muted-foreground'
                                    }`}
                                >
                                    <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                            ok ? 'bg-emerald-500 text-white' : 'bg-black/5 text-black/25'
                                        }`}
                                    >
                                        {String.fromCharCode(65 + i)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <span>{text}</span>
                                        {ok && <Tick02Icon size={12} className="inline ml-1 text-emerald-600" />}
                                        {image && (
                                            <img
                                                src={image}
                                                alt=""
                                                className="max-h-16 rounded mt-1 border border-black/10"
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            }
            case 'multiple_select': {
                if (!parsed?.options) return null;
                const ci: number[] = parsed.correct_indices || [];
                return (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {parsed.options.map((opt: any, i: number) => {
                            const text = typeof opt === 'string' ? opt : opt.text;
                            const ok = ci.includes(i);
                            return (
                                <div
                                    key={i}
                                    className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                                        ok
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                                            : 'bg-white/60 border-black/5 text-muted-foreground'
                                    }`}
                                >
                                    <span
                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[8px] shrink-0 ${
                                            ok
                                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                                : 'border-black/15'
                                        }`}
                                    >
                                        {ok && '✓'}
                                    </span>
                                    <span>{text}</span>
                                </div>
                            );
                        })}
                    </div>
                );
            }
            case 'true_false':
                return (
                    <div className="flex gap-2">
                        {[
                            { l: 'Benar', idx: 0 },
                            { l: 'Salah', idx: 1 },
                        ].map((o) => (
                            <div
                                key={o.idx}
                                className={`flex-1 px-3 py-2 rounded-lg border text-xs text-center font-semibold ${
                                    q.correct_option_index === o.idx
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        : 'bg-white/60 border-black/5 text-black/20'
                                }`}
                            >
                                {o.idx === 0 ? (
                                    <Tick02Icon size={12} className="inline mr-1" />
                                ) : (
                                    <Cancel01Icon size={12} className="inline mr-1" />
                                )}
                                {o.l}
                            </div>
                        ))}
                    </div>
                );
            case 'short_answer':
                return (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Kunci</span>
                        <span className="text-xs font-semibold text-amber-900 font-mono">
                            {q.correct_answer || '-'}
                        </span>
                    </div>
                );
            case 'essay':
                return (
                    <p className="text-xs text-purple-600 italic px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                        Dinilai manual oleh penguji
                    </p>
                );
            case 'matching': {
                if (!parsed?.pairs || !Array.isArray(parsed.pairs)) return null;
                return (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {parsed.pairs.map((pair: any, i: number) => (
                            <div key={i} className="px-3 py-2 rounded-lg border border-pink-200 bg-pink-50 text-xs flex items-center justify-between">
                                <span className="font-medium text-pink-900">{pair.left}</span>
                                <span className="text-pink-400">→</span>
                                <span className="font-semibold text-pink-800">{pair.right}</span>
                            </div>
                        ))}
                    </div>
                );
            }
            default:
                return null;
        }
    };

    const renderQuestionItem = (q: QuestionItemData, index: number) => {
        const displayIndex = localOrder.indexOf(q.id) + 1 || index + 1;
        return (
            <SortableQuestionItem
                key={q.id}
                question={q}
                displayIndex={displayIndex}
                examId={examId}
                isReorderMode={isReorderMode}
                isExpanded={expandedIds.has(q.id)}
                userRole={userRole}
                deleteConfirmId={deleteConfirmId}
                onToggleExpand={toggleExpand}
                onSetDeleteConfirm={setDeleteConfirmId}
                onDelete={deleteQuestion}
                renderAnswerPreview={renderAnswerPreview}
            />
        );
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <ConfirmComponent />

            <PageHeader
                title={exam ? `Bank Soal: ${exam.title}` : 'Bank Soal'}
                description={`Total ${questions.length} soal • Bobot total ${totalPts} poin`}
                icon={<HelpCircleIcon size={28} className="text-muted-foreground" />}
                actions={userRole === 'admin' ? (
                    <Link
                        href={`/admin/exams/${examId}/questions/import`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700/30 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100 sm:w-auto sm:text-sm"
                    >
                        <FileSpreadsheet className="size-4" />
                        <span>Import Excel</span>
                    </Link>
                ) : undefined}
                actionLabel={userRole === 'admin' ? 'Tambah Soal Baru' : undefined}
                actionHref={userRole === 'admin' ? `/admin/exams/${examId}/questions/new` : undefined}
                onRefresh={fetchData}
                isRefreshing={isLoading}
            />

            {/* Admin Management Toolbar */}
            {userRole === 'admin' && questions.length > 0 && (
                <div className="space-y-3">
                    <div className="bg-slate-900/5 backdrop-blur-md border border-slate-900/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Shuffle Button */}
                            <button
                                type="button"
                                onClick={handleShuffle}
                                disabled={isShuffling || isSaving}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-black/10 text-foreground hover:bg-slate-100 transition-all shadow-2xs disabled:opacity-50"
                                title="Acak nomor soal secara otomatis"
                            >
                                <Shuffle className={`size-3.5 ${isShuffling ? 'animate-spin' : 'text-blue-600'}`} />
                                {isShuffling ? 'Mengacak...' : 'Acak Semua Soal'}
                            </button>

                            {/* Sequential Reset Button */}
                            <button
                                type="button"
                                onClick={handleSequential}
                                disabled={isResetting || isSaving}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-black/10 text-foreground hover:bg-slate-100 transition-all shadow-2xs disabled:opacity-50"
                                title="Atur ulang urutan nomor soal berurutan"
                            >
                                <ArrowDownUp className={`size-3.5 ${isResetting ? 'animate-spin' : 'text-emerald-600'}`} />
                                {isResetting ? 'Mengurutkan...' : 'Urut Nomor'}
                            </button>

                            {/* Undo Button */}
                            {undoStack.canUndo && (
                                <button
                                    type="button"
                                    onClick={handleUndo}
                                    disabled={isUndoing}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-all shadow-2xs disabled:opacity-50 animate-in fade-in"
                                    title={`Kembalikan urutan sebelumnya (${undoStack.undoCount} kali tersedia)`}
                                >
                                    <Undo2 className={`size-3.5 ${isUndoing ? 'animate-spin' : 'text-amber-700'}`} />
                                    <span>Undo</span>
                                    <span className="bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                                        {undoStack.undoCount}x
                                    </span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Save Order Button when dirty */}
                            {isDirty && (
                                <button
                                    type="button"
                                    onClick={handleSaveOrder}
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 animate-in fade-in"
                                >
                                    <Save className={`size-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                                    {isSaving ? 'Menyimpan...' : 'Simpan Urutan'}
                                </button>
                            )}

                            {/* Reorder Mode Toggle */}
                            <button
                                type="button"
                                onClick={handleToggleReorderMode}
                                disabled={isFilterActive || isVirtual}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs ${
                                    isReorderMode
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-white border border-black/10 text-foreground hover:bg-slate-100'
                                } ${isFilterActive || isVirtual ? 'opacity-40 cursor-not-allowed' : ''}`}
                                title={
                                    isVirtual
                                        ? 'Mode susun dinonaktifkan untuk exam > 50 soal'
                                        : isFilterActive
                                        ? 'Nonaktifkan filter untuk mode susun'
                                        : 'Aktifkan mode drag & drop'
                                }
                            >
                                <MoveVertical className="size-3.5" />
                                {isReorderMode ? 'Selesai Menyusun' : 'Mode Susun (Drag & Drop)'}
                            </button>
                        </div>
                    </div>

                    {/* Active Mode Susun Status Banner */}
                    {isReorderMode && (
                        <div className="bg-blue-50/90 border border-blue-200 text-blue-900 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
                            <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                                    <MoveVertical className="size-4 animate-pulse" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-blue-950">Mode Susun Aktif</p>
                                    <p className="text-[11px] text-blue-800 leading-snug">
                                        Tahan dan geser ikon grip (≡) pada soal untuk memindahkan posisi. Klik &quot;Simpan Urutan&quot; setelah selesai.
                                    </p>
                                </div>
                            </div>
                            {isDirty && (
                                <button
                                    type="button"
                                    onClick={handleSaveOrder}
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xs shrink-0 disabled:opacity-50"
                                >
                                    <Save className={`size-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Banner when filter prevents reordering */}
            {isFilterActive && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-800 text-xs">
                    <Info className="size-4 shrink-0 text-blue-600" />
                    <span>
                        Mode susun dinonaktifkan saat pencarian atau filter aktif. Hapus filter untuk mengatur urutan drag-and-drop.
                    </span>
                </div>
            )}

            {/* Banner when virtual list exceeds 50 items */}
            {isVirtual && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
                    <AlertCircle className="size-4 shrink-0 text-amber-700" />
                    <span>
                        Exam memiliki total {filtered.length} soal. Virtual scrolling aktif untuk performa responsif. Gunakan tombol <strong>Acak Semua Soal</strong> atau <strong>Urut Nomor</strong> untuk mengelola urutan massal.
                    </span>
                </div>
            )}

            {/* Filter controls & Search */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Search01Icon size={16} />
                    </span>
                    <input
                        type="text"
                        placeholder="Cari teks soal..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        className="w-full glass-input pl-10 pr-4 py-2 rounded-xl text-xs focus:outline-none"
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <button
                        onClick={() => {
                            setActiveTypeFilter(null);
                            setPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                            activeTypeFilter === null
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'bg-white border border-black/10 text-muted-foreground hover:bg-slate-100'
                        }`}
                    >
                        Semua ({questions.length})
                    </button>
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                        const count = typeCounts[key] || 0;
                        if (count === 0) return null;
                        return (
                            <button
                                key={key}
                                onClick={() => {
                                    setActiveTypeFilter(key);
                                    setPage(1);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                                    activeTypeFilter === key
                                        ? 'bg-slate-900 text-white shadow-2xs'
                                        : 'bg-white border border-black/10 text-muted-foreground hover:bg-slate-100'
                                }`}
                            >
                                {cfg.label} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Questions List */}
            {isLoading ? (
                <div className="p-12 text-center text-xs text-muted-foreground animate-pulse">
                    Memuat daftar soal...
                </div>
            ) : filtered.length === 0 ? (
                <GlassCard className="p-8 text-center text-muted-foreground">
                    <Search01Icon size={24} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Tidak ada soal yang cocok.</p>
                    <button
                        onClick={() => {
                            setSearchQuery('');
                            setActiveTypeFilter(null);
                            setPage(1);
                        }}
                        className="text-[11px] font-semibold text-foreground underline mt-1"
                    >
                        Reset Filter
                    </button>
                </GlassCard>
            ) : isVirtual ? (
                // Virtual Scrolling Container (> 50 items)
                <div
                    ref={scrollContainerRef}
                    className="max-h-[700px] overflow-y-auto space-y-3 pr-1 border border-black/5 rounded-2xl p-2 bg-slate-50/50"
                >
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const q = filtered[virtualRow.index];
                            return (
                                <div
                                    key={q.id}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                    className="pb-3"
                                >
                                    {renderQuestionItem(q, virtualRow.index)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                // Standard Pagination Container (<= 50 items)
                <div className="space-y-3">
                    {paginatedQuestions.map((q, idx) => renderQuestionItem(q, idx))}
                </div>
            )}

            {/* Pagination Controls when not in virtualized mode */}
            {!isVirtual && filtered.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                />
            )}

            {/* Mobile Floating Action Button */}
            {!isLoading && userRole === 'admin' && (
                <Link
                    href={`/admin/exams/${examId}/questions/new`}
                    className="fixed bottom-6 right-6 w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg hover:scale-105 transition-transform md:hidden z-50"
                    aria-label="Tambah Soal Baru"
                >
                    <PlusSignIcon size={22} />
                </Link>
            )}
        </div>
    );
}
