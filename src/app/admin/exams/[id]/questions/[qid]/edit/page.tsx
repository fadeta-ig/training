'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft01Icon,
    FloppyDiskIcon,
    PlusSignIcon,
    Delete02Icon,
    ImageAdd01Icon,
    RefreshIcon,
    HelpCircleIcon,
    StarIcon,
    Tick02Icon,
} from 'hugeicons-react';
import Link from 'next/link';

const QUESTION_TYPES = [
    { value: 'multiple_choice', label: 'Pilihan Ganda', description: 'Satu jawaban benar dari beberapa opsi' },
    { value: 'multiple_select', label: 'Multi-Jawaban', description: 'Beberapa jawaban benar sekaligus' },
    { value: 'true_false', label: 'Benar / Salah', description: 'Dua pilihan: Benar atau Salah' },
    { value: 'short_answer', label: 'Isian Singkat', description: 'Jawaban teks pendek' },
    { value: 'essay', label: 'Esai', description: 'Jawaban panjang, dinilai manual' },
    { value: 'matching', label: 'Menjodohkan', description: 'Mencocokkan pasangan item' },
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number]['value'];
type OptionItem = { text: string; image: string | null };
type MatchingPair = { left: string; right: string };

export default function EditQuestionPage({ params }: { params: Promise<{ id: string; qid: string }> }) {
    const resolvedParams = use(params);
    const examId = resolvedParams.id;
    const questionId = resolvedParams.qid;
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
    const [questionText, setQuestionText] = useState('');
    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [points, setPoints] = useState(1);

    const [options, setOptions] = useState<OptionItem[]>([]);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [correctIndices, setCorrectIndices] = useState<number[]>([]);
    const [trueFalseAnswer, setTrueFalseAnswer] = useState(0);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([]);
    const questionImageRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/questions/${questionId}`);
                const result = await res.json();
                if (!result.success) throw new Error(result.error);
                const q = result.data;
                const qType = (q.question_type || 'multiple_choice') as QuestionType;
                setQuestionType(qType); setQuestionText(q.question_text); setQuestionImage(q.question_image || null); setPoints(q.points || 1);
                const parsed = q.options_json ? (typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json) : null;
                switch (qType) {
                    case 'multiple_choice': if (Array.isArray(parsed)) setOptions(parsed.map((o: any) => typeof o === 'string' ? { text: o, image: null } : o)); setCorrectIndex(q.correct_option_index ?? 0); break;
                    case 'multiple_select': if (parsed?.options) { setOptions(parsed.options.map((o: any) => typeof o === 'string' ? { text: o, image: null } : o)); setCorrectIndices(parsed.correct_indices || []); } break;
                    case 'true_false': setTrueFalseAnswer(q.correct_option_index ?? 0); break;
                    case 'short_answer': setCorrectAnswer(q.correct_answer || ''); break;
                    case 'matching': if (parsed?.pairs) setMatchingPairs(parsed.pairs); break;
                }
            } catch (err: any) { setError(err.message); }
            finally { setIsLoading(false); }
        })();
    }, [questionId]);

    const uploadImage = async (file: File): Promise<string | null> => {
        const fd = new FormData(); fd.append('file', file);
        try { const r = await fetch('/api/upload', { method: 'POST', body: fd }); const d = await r.json(); if (d.success) return d.url; alert(d.error); return null; }
        catch { alert('Gagal mengunggah gambar.'); return null; }
    };
    const handleQuestionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const u = await uploadImage(f); if (u) setQuestionImage(u); e.target.value = ''; };
    const handleOptionImageUpload = async (idx: number, file: File) => { const u = await uploadImage(file); if (u) { const n = [...options]; n[idx] = { ...n[idx], image: u }; setOptions(n); } };

    const addOption = () => { if (options.length >= 10) return; setOptions([...options, { text: '', image: null }]); };
    const removeOption = (idx: number) => { if (options.length <= 2) return; const n = options.filter((_, i) => i !== idx); setOptions(n); if (correctIndex >= n.length) setCorrectIndex(0); setCorrectIndices(correctIndices.filter(i => i < n.length)); };
    const addMatchingPair = () => setMatchingPairs([...matchingPairs, { left: '', right: '' }]);
    const removeMatchingPair = (idx: number) => { if (matchingPairs.length <= 2) return; setMatchingPairs(matchingPairs.filter((_, i) => i !== idx)); };
    const toggleCorrectIndex = (idx: number) => setCorrectIndices(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setIsSaving(true); setError(null);
        const payload: Record<string, unknown> = { question_type: questionType, question_text: questionText, question_image: questionImage, points };
        switch (questionType) {
            case 'multiple_choice': payload.options = options; payload.correct_option_index = correctIndex; break;
            case 'multiple_select': payload.options = options; payload.correct_option_indices = correctIndices; break;
            case 'true_false': payload.correct_option_index = trueFalseAnswer; break;
            case 'short_answer': payload.correct_answer = correctAnswer; break;
            case 'matching': payload.matching_pairs = matchingPairs; break;
        }
        try {
            const res = await fetch(`/api/questions/${questionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await res.json();
            if (result.success) { router.push(`/admin/exams/${examId}/questions`); router.refresh(); }
            else throw new Error(result.error || 'Gagal menyimpan');
        } catch (err: any) { setError(err.message); } finally { setIsSaving(false); }
    };

    if (isLoading) return <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2"><RefreshIcon size={22} className="animate-spin opacity-30" /><span className="text-xs">Memuat...</span></div>;

    const currentType = QUESTION_TYPES.find(t => t.value === questionType)!;

    return (
        <div className="space-y-5 max-w-4xl">
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href="/admin/exams" className="hover:text-foreground transition-colors">Ujian</Link>
                <span className="text-black/15">/</span>
                <Link href={`/admin/exams/${examId}/questions`} className="hover:text-foreground transition-colors">Bank Soal</Link>
                <span className="text-black/15">/</span>
                <span className="text-foreground font-semibold">Edit Soal</span>
            </nav>

            <div className="flex items-center gap-3 pb-5 border-b border-black/5">
                <Link href={`/admin/exams/${examId}/questions`} className="p-2 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm shrink-0">
                    <ArrowLeft01Icon size={18} />
                </Link>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <HelpCircleIcon size={22} className="text-muted-foreground" /> Edit Soal
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Perbarui pertanyaan, tipe, dan jawaban.</p>
                </div>
            </div>

            {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2.5 rounded-xl text-xs font-medium">⚠ {error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type */}
                <div className="glass-card p-5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                        <span className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center text-[11px] font-bold">1</span>
                        <h2 className="text-sm font-bold">Tipe Soal</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {QUESTION_TYPES.map(qt => (
                            <button key={qt.value} type="button" onClick={() => setQuestionType(qt.value)}
                                className={`p-3 rounded-xl border-2 text-left transition-all ${questionType === qt.value ? 'border-foreground bg-foreground/5 shadow-sm' : 'border-black/6 hover:border-black/15 bg-white/50'}`}>
                                <h4 className="font-bold text-xs">{qt.label}</h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{qt.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Question */}
                <div className="glass-card p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                        <span className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center text-[11px] font-bold">2</span>
                        <h2 className="text-sm font-bold">Pertanyaan</h2>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold">Teks Pertanyaan <span className="text-destructive">*</span></label>
                        <textarea required rows={3} className="w-full glass-input px-3 py-2.5 rounded-xl text-sm resize-y focus:outline-none" value={questionText} onChange={e => setQuestionText(e.target.value)} />
                    </div>
                    <div className="flex gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold">Gambar <span className="text-muted-foreground font-normal">(Opsional)</span></label>
                            {questionImage ? (
                                <div className="relative inline-block"><img src={questionImage} alt="" className="max-h-28 rounded-xl border border-black/10 shadow-sm" /><button type="button" onClick={() => setQuestionImage(null)} className="absolute -top-1.5 -right-1.5 p-1 bg-destructive text-white rounded-full shadow-md"><Delete02Icon size={10} /></button></div>
                            ) : (
                                <button type="button" onClick={() => questionImageRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-black/10 text-xs text-muted-foreground hover:border-black/20 hover:text-foreground transition-colors"><ImageAdd01Icon size={14} /> Unggah</button>
                            )}
                            <input ref={questionImageRef} type="file" accept="image/*" className="hidden" onChange={handleQuestionImageUpload} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold flex items-center gap-1"><StarIcon size={12} /> Bobot Poin</label>
                            <input type="number" min={1} max={100} className="w-20 glass-input px-3 py-2 rounded-lg text-sm focus:outline-none" value={points} onChange={e => setPoints(Number(e.target.value))} />
                        </div>
                    </div>
                </div>

                {/* Answer */}
                <div className="glass-card p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                        <span className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center text-[11px] font-bold">3</span>
                        <h2 className="text-sm font-bold">Jawaban</h2>
                        <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-black/5 text-muted-foreground">{currentType.label}</span>
                    </div>

                    {questionType === 'multiple_choice' && (
                        <div className="space-y-2">
                            {options.map((opt, idx) => (
                                <div key={idx} className={`flex items-start gap-2.5 p-2.5 rounded-xl border-2 transition-all ${correctIndex === idx ? 'border-emerald-300 bg-emerald-50/50' : 'border-black/5 bg-white hover:border-black/10'}`}>
                                    <input type="radio" name="correct_mc" checked={correctIndex === idx} onChange={() => setCorrectIndex(idx)} className="w-4 h-4 accent-emerald-600 mt-1" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-6 h-6 rounded-md bg-black/5 flex items-center justify-center text-[10px] font-bold text-black/25 shrink-0">{String.fromCharCode(65 + idx)}</span>
                                            <input type="text" required placeholder={`Opsi ${String.fromCharCode(65 + idx)}`} className="flex-1 glass-input px-2.5 py-1.5 rounded-lg text-xs focus:outline-none" value={opt.text} onChange={e => { const n = [...options]; n[idx] = { ...n[idx], text: e.target.value }; setOptions(n); }} />
                                        </div>
                                        {opt.image && <div className="relative inline-block ml-7"><img src={opt.image} alt="" className="max-h-20 rounded-lg border border-black/10" /><button type="button" onClick={() => { const n = [...options]; n[idx] = { ...n[idx], image: null }; setOptions(n); }} className="absolute -top-1 -right-1 p-0.5 bg-destructive text-white rounded-full"><Delete02Icon size={10} /></button></div>}
                                        <label className="ml-7 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 w-fit"><ImageAdd01Icon size={10} /> Gambar <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleOptionImageUpload(idx, f); e.target.value = ''; }} /></label>
                                    </div>
                                    <button type="button" onClick={() => removeOption(idx)} disabled={options.length <= 2} className="p-1 text-destructive/20 hover:text-destructive disabled:opacity-0 rounded mt-0.5"><Delete02Icon size={13} /></button>
                                </div>
                            ))}
                            {options.length < 10 && <button type="button" onClick={addOption} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-xl border-2 border-dashed border-black/8 hover:border-black/15 w-full justify-center"><PlusSignIcon size={14} /> Tambah Opsi</button>}
                        </div>
                    )}

                    {questionType === 'multiple_select' && (
                        <div className="space-y-2">
                            {options.map((opt, idx) => (
                                <div key={idx} className={`flex items-start gap-2.5 p-2.5 rounded-xl border-2 transition-all ${correctIndices.includes(idx) ? 'border-emerald-300 bg-emerald-50/50' : 'border-black/5 bg-white hover:border-black/10'}`}>
                                    <input type="checkbox" checked={correctIndices.includes(idx)} onChange={() => toggleCorrectIndex(idx)} className="w-4 h-4 accent-emerald-600 rounded mt-1" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-6 h-6 rounded-md bg-black/5 flex items-center justify-center text-[10px] font-bold text-black/25 shrink-0">{String.fromCharCode(65 + idx)}</span>
                                            <input type="text" required placeholder={`Opsi ${String.fromCharCode(65 + idx)}`} className="flex-1 glass-input px-2.5 py-1.5 rounded-lg text-xs focus:outline-none" value={opt.text} onChange={e => { const n = [...options]; n[idx] = { ...n[idx], text: e.target.value }; setOptions(n); }} />
                                        </div>
                                        {opt.image && <div className="relative inline-block ml-7"><img src={opt.image} alt="" className="max-h-20 rounded-lg border border-black/10" /><button type="button" onClick={() => { const n = [...options]; n[idx] = { ...n[idx], image: null }; setOptions(n); }} className="absolute -top-1 -right-1 p-0.5 bg-destructive text-white rounded-full"><Delete02Icon size={10} /></button></div>}
                                        <label className="ml-7 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 w-fit"><ImageAdd01Icon size={10} /> Gambar <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleOptionImageUpload(idx, f); e.target.value = ''; }} /></label>
                                    </div>
                                    <button type="button" onClick={() => removeOption(idx)} disabled={options.length <= 2} className="p-1 text-destructive/20 hover:text-destructive disabled:opacity-0 rounded mt-0.5"><Delete02Icon size={13} /></button>
                                </div>
                            ))}
                            {options.length < 10 && <button type="button" onClick={addOption} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-xl border-2 border-dashed border-black/8 hover:border-black/15 w-full justify-center"><PlusSignIcon size={14} /> Tambah Opsi</button>}
                        </div>
                    )}

                    {questionType === 'true_false' && (
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setTrueFalseAnswer(0)} className={`p-6 rounded-xl border-2 text-center transition-all ${trueFalseAnswer === 0 ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-black/6 hover:border-black/12'}`}>
                                <Tick02Icon size={24} className={trueFalseAnswer === 0 ? 'mx-auto mb-1 text-emerald-600' : 'mx-auto mb-1 text-black/15'} />
                                <span className={`font-bold ${trueFalseAnswer === 0 ? 'text-emerald-700' : 'text-black/25'}`}>Benar</span>
                            </button>
                            <button type="button" onClick={() => setTrueFalseAnswer(1)} className={`p-6 rounded-xl border-2 text-center transition-all ${trueFalseAnswer === 1 ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-black/6 hover:border-black/12'}`}>
                                <Delete02Icon size={24} className={trueFalseAnswer === 1 ? 'mx-auto mb-1 text-emerald-600' : 'mx-auto mb-1 text-black/15'} />
                                <span className={`font-bold ${trueFalseAnswer === 1 ? 'text-emerald-700' : 'text-black/25'}`}>Salah</span>
                            </button>
                        </div>
                    )}

                    {questionType === 'short_answer' && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold">Kunci Jawaban <span className="text-destructive">*</span></label>
                            <input type="text" required className="w-full glass-input px-3 py-2.5 rounded-xl text-sm focus:outline-none" value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} />
                        </div>
                    )}

                    {questionType === 'essay' && (
                        <div className="p-6 bg-purple-50/50 rounded-xl border border-purple-100 text-center">
                            <HelpCircleIcon size={28} className="mx-auto mb-2 text-purple-400" />
                            <h3 className="font-bold text-sm text-purple-900">Soal Tipe Esai</h3>
                            <p className="text-xs text-purple-700 mt-1">Dinilai manual oleh penguji.</p>
                        </div>
                    )}

                    {questionType === 'matching' && (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <div className="grid grid-cols-[1fr_24px_1fr_28px] gap-2 items-center">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground text-center">Item</span><span /><span className="text-[10px] font-bold uppercase text-muted-foreground text-center">Pasangan</span><span />
                                </div>
                                {matchingPairs.map((pair, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_24px_1fr_28px] gap-2 items-center">
                                        <input type="text" required placeholder={`Item ${idx + 1}`} className="glass-input px-3 py-2 rounded-lg text-xs" value={pair.left} onChange={e => { const n = [...matchingPairs]; n[idx] = { ...n[idx], left: e.target.value }; setMatchingPairs(n); }} />
                                        <span className="text-muted-foreground text-center text-sm font-bold">→</span>
                                        <input type="text" required placeholder={`Pasangan ${idx + 1}`} className="glass-input px-3 py-2 rounded-lg text-xs" value={pair.right} onChange={e => { const n = [...matchingPairs]; n[idx] = { ...n[idx], right: e.target.value }; setMatchingPairs(n); }} />
                                        <button type="button" onClick={() => removeMatchingPair(idx)} disabled={matchingPairs.length <= 2} className="p-1 text-destructive/20 hover:text-destructive disabled:opacity-0 rounded"><Delete02Icon size={13} /></button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addMatchingPair} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-xl border-2 border-dashed border-black/8 hover:border-black/15 w-full justify-center"><PlusSignIcon size={14} /> Tambah Pasangan</button>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-black/5 flex justify-between gap-3">
                    <Link href={`/admin/exams/${examId}/questions`} className="px-4 py-2.5 text-xs font-semibold rounded-xl hover:bg-black/5 transition-colors flex items-center gap-1.5">
                        <ArrowLeft01Icon size={14} /> Kembali
                    </Link>
                    <button type="submit" disabled={isSaving} className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50 transition-all">
                        <FloppyDiskIcon size={14} /> {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </form>
        </div>
    );
}
