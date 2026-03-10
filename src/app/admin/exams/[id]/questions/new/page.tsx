'use client';

import { useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft01Icon,
    FloppyDiskIcon,
    PlusSignIcon,
    Delete02Icon,
    ImageAdd01Icon,
    HelpCircleIcon,
    CheckmarkCircle02Icon,
    StarIcon,
    Tick02Icon,
} from 'hugeicons-react';
import Link from 'next/link';

const QUESTION_TYPES = [
    { value: 'multiple_choice', label: 'Pilihan Ganda', description: 'Satu jawaban benar dari beberapa opsi', hint: 'Cocok untuk menguji pemahaman konsep dan fakta dasar' },
    { value: 'multiple_select', label: 'Multi-Jawaban', description: 'Beberapa jawaban benar sekaligus', hint: 'Peserta harus memilih semua jawaban benar untuk poin penuh' },
    { value: 'true_false', label: 'Benar / Salah', description: 'Dua pilihan: Benar atau Salah', hint: 'Soal cepat untuk menguji pernyataan faktual' },
    { value: 'short_answer', label: 'Isian Singkat', description: 'Jawaban teks pendek', hint: 'Jawaban dicocokkan otomatis (case-insensitive)' },
    { value: 'essay', label: 'Esai', description: 'Jawaban panjang, dinilai manual', hint: 'Untuk analisis mendalam, dinilai manual oleh penguji' },
    { value: 'matching', label: 'Menjodohkan', description: 'Mencocokkan pasangan item', hint: 'Saat ujian, urutan kolom kanan diacak otomatis' },
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number]['value'];
type OptionItem = { text: string; image: string | null };
type MatchingPair = { left: string; right: string };

export default function NewQuestionPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const examId = resolvedParams.id;
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [savedCount, setSavedCount] = useState(0);

    const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
    const [questionText, setQuestionText] = useState('');
    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [points, setPoints] = useState(1);

    const [options, setOptions] = useState<OptionItem[]>([
        { text: '', image: null }, { text: '', image: null },
        { text: '', image: null }, { text: '', image: null },
    ]);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [correctIndices, setCorrectIndices] = useState<number[]>([]);
    const [trueFalseAnswer, setTrueFalseAnswer] = useState(0);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([{ left: '', right: '' }, { left: '', right: '' }]);
    const questionImageRef = useRef<HTMLInputElement>(null);

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

    const resetForm = () => {
        setQuestionText(''); setQuestionImage(null); setPoints(1);
        setOptions([{ text: '', image: null }, { text: '', image: null }, { text: '', image: null }, { text: '', image: null }]);
        setCorrectIndex(0); setCorrectIndices([]); setTrueFalseAnswer(0); setCorrectAnswer('');
        setMatchingPairs([{ left: '', right: '' }, { left: '', right: '' }]); setError(null);
    };

    const buildPayload = () => {
        const p: Record<string, unknown> = { exam_id: examId, question_type: questionType, question_text: questionText, question_image: questionImage, points };
        switch (questionType) {
            case 'multiple_choice': p.options = options; p.correct_option_index = correctIndex; break;
            case 'multiple_select': p.options = options; p.correct_option_indices = correctIndices; break;
            case 'true_false': p.correct_option_index = trueFalseAnswer; break;
            case 'short_answer': p.correct_answer = correctAnswer; break;
            case 'matching': p.matching_pairs = matchingPairs; break;
        }
        return p;
    };

    const handleSubmit = async (e: React.FormEvent, addAnother = false) => {
        e.preventDefault(); setIsSaving(true); setError(null);
        try {
            const res = await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()) });
            const result = await res.json();
            if (result.success) {
                if (addAnother) {
                    setSavedCount(p => p + 1); setSuccessMsg(`Soal berhasil disimpan! (${savedCount + 1} soal ditambahkan)`);
                    resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => setSuccessMsg(null), 3000);
                } else { router.push(`/admin/exams/${examId}/questions`); router.refresh(); }
            } else { throw new Error(result.details ? Object.values(result.details).flat().join('; ') : result.error || 'Gagal menyimpan soal'); }
        } catch (err: any) { setError(err.message); } finally { setIsSaving(false); }
    };

    const currentType = QUESTION_TYPES.find(t => t.value === questionType)!;

    return (
        <div className="space-y-5 max-w-4xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href="/admin/exams" className="hover:text-foreground transition-colors">Ujian</Link>
                <span className="text-black/15">/</span>
                <Link href={`/admin/exams/${examId}/questions`} className="hover:text-foreground transition-colors">Bank Soal</Link>
                <span className="text-black/15">/</span>
                <span className="text-foreground font-semibold">Tambah Soal</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-3 pb-5 border-b border-black/5">
                <Link href={`/admin/exams/${examId}/questions`} className="p-2 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm shrink-0">
                    <ArrowLeft01Icon size={18} />
                </Link>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <HelpCircleIcon size={22} className="text-muted-foreground" /> Tambah Soal Baru
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Pilih tipe, tulis pertanyaan, dan tentukan jawaban.</p>
                </div>
            </div>

            {/* Toasts */}
            {successMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2"><CheckmarkCircle02Icon size={16} /> {successMsg}</div>}
            {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2.5 rounded-xl text-xs font-medium">⚠ {error}</div>}

            <form onSubmit={e => handleSubmit(e, false)} className="space-y-4">
                {/* Step 1: Type */}
                <div className="glass-card p-5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                        <span className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center text-[11px] font-bold">1</span>
                        <h2 className="text-sm font-bold">Pilih Tipe Soal</h2>
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
                    <div className="flex items-start gap-2 bg-black/3 rounded-lg p-2.5">
                        <HelpCircleIcon size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-[11px] text-muted-foreground">{currentType.hint}</p>
                    </div>
                </div>

                {/* Step 2: Question */}
                <div className="glass-card p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                        <span className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center text-[11px] font-bold">2</span>
                        <h2 className="text-sm font-bold">Tulis Pertanyaan</h2>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold">Teks Pertanyaan <span className="text-destructive">*</span></label>
                        <textarea required rows={3} className="w-full glass-input px-3 py-2.5 rounded-xl text-sm resize-y focus:outline-none" placeholder="Tulis pertanyaan di sini..." value={questionText} onChange={e => setQuestionText(e.target.value)} />
                    </div>
                    <div className="flex gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold">Gambar <span className="text-muted-foreground font-normal">(Opsional)</span></label>
                            {questionImage ? (
                                <div className="relative inline-block">
                                    <img src={questionImage} alt="" className="max-h-28 rounded-xl border border-black/10 shadow-sm" />
                                    <button type="button" onClick={() => setQuestionImage(null)} className="absolute -top-1.5 -right-1.5 p-1 bg-destructive text-white rounded-full shadow-md"><Delete02Icon size={10} /></button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => questionImageRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-black/10 text-xs text-muted-foreground hover:border-black/20 hover:text-foreground transition-colors">
                                    <ImageAdd01Icon size={14} /> Unggah
                                </button>
                            )}
                            <input ref={questionImageRef} type="file" accept="image/*" className="hidden" onChange={handleQuestionImageUpload} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold flex items-center gap-1"><StarIcon size={12} /> Bobot Poin</label>
                            <input type="number" min={1} max={100} className="w-20 glass-input px-3 py-2 rounded-lg text-sm focus:outline-none" value={points} onChange={e => setPoints(Number(e.target.value))} />
                        </div>
                    </div>
                </div>

                {/* Step 3: Answer */}
                <div className="glass-card p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                        <span className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center text-[11px] font-bold">3</span>
                        <h2 className="text-sm font-bold">Tentukan Jawaban</h2>
                        <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-black/5 text-muted-foreground">{currentType.label}</span>
                    </div>

                    {/* Multiple Choice */}
                    {questionType === 'multiple_choice' && (
                        <div className="space-y-2">
                            <p className="text-[11px] text-muted-foreground bg-black/3 p-2 rounded-lg">Klik radio untuk menandai jawaban benar. Opsi terpilih ditandai hijau.</p>
                            {options.map((opt, idx) => (
                                <div key={idx} className={`flex items-start gap-2.5 p-2.5 rounded-xl border-2 transition-all ${correctIndex === idx ? 'border-emerald-300 bg-emerald-50/50' : 'border-black/5 bg-white hover:border-black/10'}`}>
                                    <input type="radio" name="correct_mc" checked={correctIndex === idx} onChange={() => setCorrectIndex(idx)} className="w-4 h-4 accent-emerald-600 mt-1" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-6 h-6 rounded-md bg-black/5 flex items-center justify-center text-[10px] font-bold text-black/25 shrink-0">{String.fromCharCode(65 + idx)}</span>
                                            <input type="text" required placeholder={`Ketik opsi ${String.fromCharCode(65 + idx)}...`} className="flex-1 glass-input px-2.5 py-1.5 rounded-lg text-xs focus:outline-none" value={opt.text} onChange={e => { const n = [...options]; n[idx] = { ...n[idx], text: e.target.value }; setOptions(n); }} />
                                        </div>
                                        {opt.image && <div className="relative inline-block ml-7"><img src={opt.image} alt="" className="max-h-20 rounded-lg border border-black/10" /><button type="button" onClick={() => { const n = [...options]; n[idx] = { ...n[idx], image: null }; setOptions(n); }} className="absolute -top-1 -right-1 p-0.5 bg-destructive text-white rounded-full"><Delete02Icon size={10} /></button></div>}
                                        <label className="ml-7 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 w-fit"><ImageAdd01Icon size={10} /> Gambar <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleOptionImageUpload(idx, f); e.target.value = ''; }} /></label>
                                    </div>
                                    <button type="button" onClick={() => removeOption(idx)} disabled={options.length <= 2} className="p-1 text-destructive/20 hover:text-destructive disabled:opacity-0 rounded mt-0.5"><Delete02Icon size={13} /></button>
                                </div>
                            ))}
                            {options.length < 10 && <button type="button" onClick={addOption} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-xl border-2 border-dashed border-black/8 hover:border-black/15 w-full justify-center"><PlusSignIcon size={14} /> Tambah Opsi ({options.length}/10)</button>}
                        </div>
                    )}

                    {/* Multiple Select */}
                    {questionType === 'multiple_select' && (
                        <div className="space-y-2">
                            <p className="text-[11px] text-muted-foreground bg-black/3 p-2 rounded-lg">Centang semua jawaban yang benar.</p>
                            {options.map((opt, idx) => (
                                <div key={idx} className={`flex items-start gap-2.5 p-2.5 rounded-xl border-2 transition-all ${correctIndices.includes(idx) ? 'border-emerald-300 bg-emerald-50/50' : 'border-black/5 bg-white hover:border-black/10'}`}>
                                    <input type="checkbox" checked={correctIndices.includes(idx)} onChange={() => toggleCorrectIndex(idx)} className="w-4 h-4 accent-emerald-600 rounded mt-1" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-6 h-6 rounded-md bg-black/5 flex items-center justify-center text-[10px] font-bold text-black/25 shrink-0">{String.fromCharCode(65 + idx)}</span>
                                            <input type="text" required placeholder={`Ketik opsi ${String.fromCharCode(65 + idx)}...`} className="flex-1 glass-input px-2.5 py-1.5 rounded-lg text-xs focus:outline-none" value={opt.text} onChange={e => { const n = [...options]; n[idx] = { ...n[idx], text: e.target.value }; setOptions(n); }} />
                                        </div>
                                        {opt.image && <div className="relative inline-block ml-7"><img src={opt.image} alt="" className="max-h-20 rounded-lg border border-black/10" /><button type="button" onClick={() => { const n = [...options]; n[idx] = { ...n[idx], image: null }; setOptions(n); }} className="absolute -top-1 -right-1 p-0.5 bg-destructive text-white rounded-full"><Delete02Icon size={10} /></button></div>}
                                        <label className="ml-7 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 w-fit"><ImageAdd01Icon size={10} /> Gambar <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleOptionImageUpload(idx, f); e.target.value = ''; }} /></label>
                                    </div>
                                    <button type="button" onClick={() => removeOption(idx)} disabled={options.length <= 2} className="p-1 text-destructive/20 hover:text-destructive disabled:opacity-0 rounded mt-0.5"><Delete02Icon size={13} /></button>
                                </div>
                            ))}
                            {options.length < 10 && <button type="button" onClick={addOption} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-xl border-2 border-dashed border-black/8 hover:border-black/15 w-full justify-center"><PlusSignIcon size={14} /> Tambah Opsi ({options.length}/10)</button>}
                        </div>
                    )}

                    {/* True/False */}
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

                    {/* Short Answer */}
                    {questionType === 'short_answer' && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold">Kunci Jawaban <span className="text-destructive">*</span></label>
                            <input type="text" required className="w-full glass-input px-3 py-2.5 rounded-xl text-sm focus:outline-none" placeholder="Ketik kunci jawaban yang benar..." value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} />
                        </div>
                    )}

                    {/* Essay */}
                    {questionType === 'essay' && (
                        <div className="p-6 bg-purple-50/50 rounded-xl border border-purple-100 text-center">
                            <HelpCircleIcon size={28} className="mx-auto mb-2 text-purple-400" />
                            <h3 className="font-bold text-sm text-purple-900">Soal Tipe Esai</h3>
                            <p className="text-xs text-purple-700 mt-1">Tidak memerlukan kunci jawaban. Dinilai manual oleh penguji.</p>
                        </div>
                    )}

                    {/* Matching */}
                    {questionType === 'matching' && (
                        <div className="space-y-3">
                            <p className="text-[11px] text-muted-foreground bg-black/3 p-2 rounded-lg">Buat pasangan item. Urutan kolom kanan akan diacak otomatis saat ujian.</p>
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
                            <button type="button" onClick={addMatchingPair} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-xl border-2 border-dashed border-black/8 hover:border-black/15 w-full justify-center">
                                <PlusSignIcon size={14} /> Tambah Pasangan ({matchingPairs.length})
                            </button>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-black/5 flex flex-col sm:flex-row justify-between gap-3">
                    <Link href={`/admin/exams/${examId}/questions`} className="px-4 py-2.5 text-xs font-semibold rounded-xl hover:bg-black/5 transition-colors flex items-center gap-1.5">
                        <ArrowLeft01Icon size={14} /> Kembali
                    </Link>
                    <div className="flex gap-2">
                        <button type="button" disabled={isSaving} onClick={e => handleSubmit(e, true)} className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-black/10 bg-white hover:bg-black/5 flex items-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50 transition-all">
                            <PlusSignIcon size={14} /> Simpan & Tambah Lagi
                        </button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50 transition-all">
                            <FloppyDiskIcon size={14} /> {isSaving ? 'Menyimpan...' : 'Simpan Soal'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
