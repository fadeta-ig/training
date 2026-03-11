'use client';

import { useState, useEffect, use } from 'react';
import {
    HelpCircleIcon,
    ArrowLeft01Icon,
    PlusSignIcon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon,
    Search01Icon,
    FilterIcon,
    ViewIcon,
    ViewOffIcon,
    CheckmarkCircle02Icon,
    Cancel01Icon,
    Clock01Icon,
    Target01Icon,
    StarIcon,
    Tick02Icon,
} from 'hugeicons-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    multiple_choice: { label: 'Pilihan Ganda', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    multiple_select: { label: 'Multi-Jawaban', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    true_false: { label: 'Benar / Salah', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    short_answer: { label: 'Isian Singkat', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    essay: { label: 'Esai', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
    matching: { label: 'Menjodohkan', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
};

type Question = {
    id: string;
    question_type: string;
    question_text: string;
    question_image: string | null;
    options_json: any;
    correct_option_index: number | null;
    correct_answer: string | null;
    points: number;
};

type Exam = { id: string; title: string; duration_minutes: number; passing_grade: number };

export default function QuestionBankPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const examId = resolvedParams.id;

    const [questions, setQuestions] = useState<Question[]>([]);
    const [exam, setExam] = useState<Exam | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [qRes, eRes] = await Promise.all([
                fetch(`/api/questions?examId=${examId}`),
                fetch(`/api/exams/${examId}`),
            ]);
            const qData = await qRes.json();
            const eData = await eRes.json();
            if (qData.success) setQuestions(qData.data);
            if (eData.success) setExam(eData.data);
        } catch (err: any) { setError(err.message); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [examId]);
    useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(null), 3000); return () => clearTimeout(t); } }, [successMsg]);

    const deleteQuestion = async (id: string) => {
        try {
            const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus soal');
            setDeleteConfirmId(null);
            setSuccessMsg('Soal berhasil dihapus.');
            fetchData();
        } catch (err: any) { toast.error(err.message || 'Gagal menghapus soal'); }
    };

    const toggleExpand = (id: string) => setExpandedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const expandAll = () => setExpandedIds(new Set(questions.map(q => q.id)));
    const collapseAll = () => setExpandedIds(new Set());

    const filtered = questions.filter(q => {
        const s = searchQuery === '' || q.question_text.toLowerCase().includes(searchQuery.toLowerCase());
        const t = activeTypeFilter === null || q.question_type === activeTypeFilter;
        return s && t;
    });

    const totalPts = questions.reduce((s, q) => s + (q.points || 1), 0);
    const typeCounts = questions.reduce<Record<string, number>>((a, q) => { const t = q.question_type || 'multiple_choice'; a[t] = (a[t] || 0) + 1; return a; }, {});

    const renderAnswerPreview = (q: Question) => {
        const qType = q.question_type || 'multiple_choice';
        const parsed = q.options_json ? (typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json) : null;
        switch (qType) {
            case 'multiple_choice': {
                if (!Array.isArray(parsed)) return null;
                return (
                    <div className="grid grid-cols-2 gap-1.5">
                        {parsed.map((opt: any, i: number) => {
                            const text = typeof opt === 'string' ? opt : opt.text;
                            const image = typeof opt === 'object' ? opt.image : null;
                            const ok = q.correct_option_index === i;
                            return (
                                <div key={i} className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium' : 'bg-white/60 border-black/5 text-muted-foreground'}`}>
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${ok ? 'bg-emerald-500 text-white' : 'bg-black/5 text-black/25'}`}>{String.fromCharCode(65 + i)}</span>
                                    <div className="min-w-0 flex-1">
                                        <span>{text}</span>
                                        {ok && <Tick02Icon size={12} className="inline ml-1 text-emerald-600" />}
                                        {image && <img src={image} alt="" className="max-h-16 rounded mt-1 border border-black/10" />}
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
                    <div className="grid grid-cols-2 gap-1.5">
                        {parsed.options.map((opt: any, i: number) => {
                            const text = typeof opt === 'string' ? opt : opt.text;
                            const ok = ci.includes(i);
                            return (
                                <div key={i} className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium' : 'bg-white/60 border-black/5 text-muted-foreground'}`}>
                                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[8px] shrink-0 ${ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-black/15'}`}>{ok && '✓'}</span>
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
                        {[{ l: 'Benar', idx: 0 }, { l: 'Salah', idx: 1 }].map(o => (
                            <div key={o.idx} className={`flex-1 px-3 py-2 rounded-lg border text-xs text-center font-semibold ${q.correct_option_index === o.idx ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white/60 border-black/5 text-black/20'}`}>
                                {o.idx === 0 ? <Tick02Icon size={12} className="inline mr-1" /> : <Cancel01Icon size={12} className="inline mr-1" />}
                                {o.l}
                            </div>
                        ))}
                    </div>
                );
            case 'short_answer':
                return (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Kunci</span>
                        <span className="text-xs font-semibold text-amber-900 font-mono">{q.correct_answer || '-'}</span>
                    </div>
                );
            case 'essay':
                return <p className="text-xs text-purple-600 italic px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">Dinilai manual oleh penguji</p>;
            case 'matching': {
                if (!parsed?.pairs) return null;
                return (
                    <div className="space-y-1.5">
                        {parsed.pairs.map((p: { left: string; right: string }, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="flex-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-center">{p.left}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="flex-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-center">{p.right}</span>
                            </div>
                        ))}
                    </div>
                );
            }
            default: return null;
        }
    };

    return (
        <div className="space-y-5 max-w-5xl">
            {/* Header */}
            {exam && (
                <PageHeader
                    title="Bank Soal"
                    description={`Kelola soal untuk ujian: ${exam.title} (${exam.duration_minutes} mnt, KKM ${exam.passing_grade}%)`}
                    icon={<HelpCircleIcon size={28} className="text-muted-foreground shrink-0" />}
                    actionLabel="Tambah Soal"
                    actionHref={`/admin/exams/${examId}/questions/new`}
                />
            )}

            {/* Toast */}
            {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
                    <CheckmarkCircle02Icon size={16} /> {successMsg}
                </div>
            )}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                    <Alert02Icon size={18} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={fetchData} className="text-xs font-semibold underline shrink-0">Coba Lagi</button>
                </div>
            )}

            {/* Stats */}
            {!isLoading && questions.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { v: questions.length, l: 'Total Soal' },
                        { v: totalPts, l: 'Total Poin' },
                        { v: Object.keys(typeCounts).length, l: 'Tipe' },
                        { v: (totalPts / questions.length).toFixed(1), l: 'Rata-rata' },
                    ].map((s, i) => (
                        <GlassCard key={i} className="px-3 py-2.5 text-center">
                            <p className="text-lg font-bold text-foreground leading-none">{s.v}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{s.l}</p>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Search & Filter */}
            {!isLoading && questions.length > 0 && (
                <GlassCard className="p-3 space-y-2.5">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search01Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input type="text" placeholder="Cari pertanyaan..." className="w-full pl-9 pr-8 py-2 rounded-lg bg-white/50 border border-black/10 text-xs focus:outline-none focus:ring-2 focus:ring-ring" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Cancel01Icon size={12} /></button>}
                        </div>
                        <button onClick={() => expandedIds.size === questions.length ? collapseAll() : expandAll()} className="px-3 py-2 text-[11px] font-semibold rounded-lg bg-white border border-black/10 hover:bg-black/5 flex items-center gap-1.5 shrink-0 transition-colors">
                            {expandedIds.size === questions.length ? <ViewOffIcon size={13} /> : <ViewIcon size={13} />}
                            {expandedIds.size === questions.length ? 'Tutup' : 'Buka'} Semua
                        </button>
                        <button onClick={fetchData} className="p-2 rounded-lg bg-white border border-black/10 hover:bg-black/5 transition-colors shrink-0" title="Segarkan">
                            <RefreshIcon size={14} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap items-center">
                        <FilterIcon size={12} className="text-muted-foreground mr-0.5" />
                        <button onClick={() => setActiveTypeFilter(null)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${activeTypeFilter === null ? 'bg-foreground text-background' : 'bg-black/5 text-muted-foreground hover:bg-black/10'}`}>
                            Semua ({questions.length})
                        </button>
                        {Object.entries(typeCounts).map(([type, count]) => {
                            const c = TYPE_CONFIG[type];
                            if (!c) return null;
                            return (
                                <button key={type} onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${activeTypeFilter === type ? `${c.bg} ${c.color} ${c.border}` : 'bg-white border-black/10 text-muted-foreground hover:bg-black/5'}`}>
                                    {c.label} ({count})
                                </button>
                            );
                        })}
                    </div>
                </GlassCard>
            )}

            {/* List */}
            <div className="space-y-2">
                {isLoading ? (
                    <GlassCard className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                        <RefreshIcon size={22} className="animate-spin opacity-30" /> <span className="text-xs">Memuat...</span>
                    </GlassCard>
                ) : questions.length === 0 ? (
                    <EmptyState
                        icon={<HelpCircleIcon size={40} className="text-black/10" />}
                        title="Belum ada soal"
                        description="Mulai tambahkan soal untuk membuat bank soal yang lengkap."
                        actionLabel="Tambah Soal Pertama"
                        actionHref={`/admin/exams/${examId}/questions/new`}
                    />
                ) : filtered.length === 0 ? (
                    <GlassCard className="p-8 text-center text-muted-foreground">
                        <Search01Icon size={24} className="mx-auto mb-2 opacity-20" />
                        <p className="text-xs">Tidak ditemukan</p>
                        <button onClick={() => { setSearchQuery(''); setActiveTypeFilter(null); }} className="text-[11px] font-semibold text-foreground underline mt-1">Reset</button>
                    </GlassCard>
                ) : (
                    filtered.map((q) => {
                        const conf = TYPE_CONFIG[q.question_type || 'multiple_choice'] || TYPE_CONFIG.multiple_choice;
                        const isExp = expandedIds.has(q.id);
                        const num = questions.findIndex(o => o.id === q.id) + 1;

                        return (
                            <GlassCard key={q.id} className={`overflow-hidden transition-all ${isExp ? 'ring-1 ring-black/5' : ''}`}>
                                <div className="px-4 py-3 flex items-start gap-3">
                                    {/* Number */}
                                    <span className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center font-bold text-xs text-black/25 shrink-0 mt-0.5">{num}</span>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${conf.bg} ${conf.color} ${conf.border} border`}>{conf.label}</span>
                                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                                <StarIcon size={10} /> {q.points || 1} poin
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{q.question_text}</p>
                                        {q.question_image && <img src={q.question_image} alt="" className="max-h-20 rounded-lg border border-black/10 mt-1.5" />}
                                    </div>

                                    {/* Actions — ALWAYS visible */}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        <button onClick={() => toggleExpand(q.id)} className={`p-1.5 rounded-lg transition-colors ${isExp ? 'bg-black/5 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`} title={isExp ? 'Tutup jawaban' : 'Lihat jawaban'}>
                                            {isExp ? <ViewOffIcon size={15} /> : <ViewIcon size={15} />}
                                        </button>
                                        <Link href={`/admin/exams/${examId}/questions/${q.id}/edit`} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors" title="Edit">
                                            <PencilEdit02Icon size={15} />
                                        </Link>
                                        {deleteConfirmId === q.id ? (
                                            <div className="flex items-center gap-1 bg-destructive/10 rounded-lg px-1.5 py-0.5 ml-0.5">
                                                <span className="text-[10px] text-destructive font-semibold">Hapus?</span>
                                                <button onClick={() => deleteQuestion(q.id)} className="px-1.5 py-0.5 bg-destructive text-white rounded text-[10px] font-bold">Ya</button>
                                                <button onClick={() => setDeleteConfirmId(null)} className="px-1.5 py-0.5 bg-black/10 rounded text-[10px] font-bold">Batal</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setDeleteConfirmId(q.id)} className="p-1.5 rounded-lg text-destructive/30 hover:text-destructive hover:bg-destructive/10 transition-colors" title="Hapus">
                                                <Delete02Icon size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {/* Expanded answer */}
                                {isExp && (
                                    <div className="px-4 pb-3 pt-0 ml-11">
                                        <div className="border-t border-black/5 pt-3">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Jawaban</p>
                                            {renderAnswerPreview(q)}
                                        </div>
                                    </div>
                                )}
                            </GlassCard>
                        );
                    })
                )}
            </div>

            {/* Mobile FAB */}
            {!isLoading && (
                <Link href={`/admin/exams/${examId}/questions/new`} className="fixed bottom-6 right-6 w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg hover:scale-105 transition-transform md:hidden z-50">
                    <PlusSignIcon size={22} />
                </Link>
            )}
        </div>
    );
}
