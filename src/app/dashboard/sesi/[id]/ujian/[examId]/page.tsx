'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    Clock01Icon,
    Tick01Icon,
    AlertCircleIcon,
    ArrowRight01Icon,
} from 'hugeicons-react';

type Question = {
    id: string;
    question_type: string;
    question_text: string;
    question_image: string | null;
    options_json: any;
    points: number;
};

type ExamData = {
    exam: { id: string; title: string; duration_minutes: number; passing_grade: number };
    questions: Question[];
    existingAnswers: { question_id: string; selected_option: string }[];
    serverTime: string;
    sessionEnd: string;
};

export default function UjianPage({ params }: { params: Promise<{ id: string; examId: string }> }) {
    const { id: sessionId, examId } = use(params);
    const router = useRouter();

    const [examData, setExamData] = useState<ExamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [result, setResult] = useState<{ score: number; passed: boolean; earnedPoints: number; totalPoints: number } | null>(null);

    useEffect(() => {
        fetch(`/api/participant/sessions/${sessionId}/exam/${examId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setExamData(data.data);
                    // Restore existing answers
                    const restored: Record<string, string> = {};
                    data.data.existingAnswers.forEach((a: any) => {
                        restored[a.question_id] = a.selected_option;
                    });
                    setAnswers(restored);

                    // Calculate time left
                    const durationMs = data.data.exam.duration_minutes * 60 * 1000;
                    const sessionEnd = new Date(data.data.sessionEnd).getTime();
                    const serverNow = new Date(data.data.serverTime).getTime();
                    const maxEnd = Math.min(serverNow + durationMs, sessionEnd);
                    setTimeLeft(Math.max(0, Math.floor((maxEnd - serverNow) / 1000)));
                } else {
                    setError(data.error || 'Gagal memuat ujian');
                }
            })
            .catch(() => setError('Kesalahan jaringan'))
            .finally(() => setLoading(false));
    }, [sessionId, examId]);

    // Timer
    useEffect(() => {
        if (timeLeft <= 0 || result) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, result]);

    const handleAnswerChange = useCallback((questionId: string, value: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }, []);

    const handleSubmit = async () => {
        if (!examData || submitting) return;
        setSubmitting(true);

        const payload = examData.questions.map((q) => ({
            question_id: q.id,
            selected_option: answers[q.id] || '',
        }));

        try {
            const res = await fetch(`/api/participant/sessions/${sessionId}/exam/${examId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: payload }),
            });

            const data = await res.json();
            if (data.success) {
                setResult(data.data);
            } else {
                setError(data.error || 'Gagal submit');
            }
        } catch {
            setError('Kesalahan jaringan saat submit');
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <Link href={`/dashboard/sesi/${sessionId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={16} /> Kembali
                </Link>
                <div className="glass-card p-10 text-center">
                    <AlertCircleIcon size={48} className="mx-auto text-destructive mb-4" />
                    <p className="text-destructive font-semibold">{error}</p>
                </div>
            </div>
        );
    }

    // Result Screen
    if (result) {
        return (
            <div className="max-w-lg mx-auto space-y-8 pt-10">
                <div className="glass-card p-8 text-center space-y-6">
                    <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${result.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {result.passed ? <Tick01Icon size={40} /> : <AlertCircleIcon size={40} />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{result.passed ? 'Selamat, Anda Lulus!' : 'Belum Lulus'}</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {result.passed ? 'Anda berhasil melewati batas nilai minimum.' : 'Nilai Anda belum mencapai batas minimum.'}
                        </p>
                    </div>
                    <div className="text-5xl font-bold tracking-tight">{result.score}%</div>
                    <div className="text-sm text-muted-foreground">
                        {result.earnedPoints} / {result.totalPoints} poin benar
                    </div>
                    <Link
                        href={`/dashboard/sesi/${sessionId}`}
                        className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-xl text-sm font-semibold hover:bg-foreground/90 transition-colors active:scale-95"
                    >
                        <ArrowLeft01Icon size={16} />
                        Kembali ke Sesi
                    </Link>
                </div>
            </div>
        );
    }

    if (!examData) return null;

    const questions = examData.questions;
    const currentQ = questions[currentIdx];
    const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;
    const parsedOptions = currentQ.options_json
        ? (typeof currentQ.options_json === 'string' ? JSON.parse(currentQ.options_json) : currentQ.options_json)
        : null;

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            {/* Timer Bar */}
            <div className="glass-card p-4 flex items-center justify-between sticky top-0 z-20">
                <div>
                    <h2 className="text-sm font-bold truncate">{examData.exam.title}</h2>
                    <p className="text-xs text-muted-foreground">
                        Soal {currentIdx + 1} dari {questions.length} · {answeredCount}/{questions.length} dijawab
                    </p>
                </div>
                <div className={`flex items-center gap-2 font-mono text-lg font-bold px-4 py-2 rounded-xl ${timeLeft < 300 ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-black/5 text-foreground'}`}>
                    <Clock01Icon size={18} />
                    {formatTime(timeLeft)}
                </div>
            </div>

            {/* Question Navigator */}
            <div className="glass-card p-4">
                <div className="flex flex-wrap gap-2">
                    {questions.map((q, idx) => (
                        <button
                            key={q.id}
                            onClick={() => setCurrentIdx(idx)}
                            className={`w-9 h-9 rounded-lg text-xs font-bold transition-all active:scale-90 ${idx === currentIdx
                                ? 'bg-foreground text-background shadow-sm'
                                : answers[q.id]
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-black/5 text-muted-foreground hover:bg-black/10'
                                }`}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>
            </div>

            {/* Question Content */}
            <div className="glass-card p-6 md:p-8 space-y-6">
                <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Soal {currentIdx + 1} · {currentQ.points} poin
                    </span>
                    <p className="text-base font-medium mt-2 leading-relaxed whitespace-pre-wrap">{currentQ.question_text}</p>
                    {currentQ.question_image && (
                        <img src={currentQ.question_image} alt="Gambar soal" className="mt-4 rounded-xl max-h-64 object-contain" />
                    )}
                </div>

                {/* Answer Options */}
                <div className="space-y-3">
                    {(currentQ.question_type === 'multiple_choice' || currentQ.question_type === 'true_false') && parsedOptions && (
                        (Array.isArray(parsedOptions) ? parsedOptions : parsedOptions.options || []).map((opt: any, idx: number) => {
                            // Handle both string options and object options {text, image}
                            const optText = typeof opt === 'string' ? opt : (opt?.text ?? String(opt));
                            const optImage = typeof opt === 'object' && opt?.image ? opt.image : null;

                            return (
                                <label
                                    key={idx}
                                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${answers[currentQ.id] === String(idx)
                                        ? 'border-foreground bg-foreground/5 shadow-sm'
                                        : 'border-black/10 hover:border-black/20 hover:bg-black/[0.02]'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name={`q-${currentQ.id}`}
                                        value={idx}
                                        checked={answers[currentQ.id] === String(idx)}
                                        onChange={() => handleAnswerChange(currentQ.id, String(idx))}
                                        className="w-4 h-4 text-foreground focus:ring-foreground"
                                    />
                                    <div className="flex-1">
                                        <span className="text-sm font-medium">{optText}</span>
                                        {optImage && (
                                            <img src={optImage} alt={`Opsi ${idx + 1}`} className="mt-2 rounded-lg max-h-32 object-contain" />
                                        )}
                                    </div>
                                </label>
                            );
                        })
                    )}

                    {currentQ.question_type === 'short_answer' && (
                        <input
                            type="text"
                            value={answers[currentQ.id] || ''}
                            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                            placeholder="Ketik jawaban Anda..."
                            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/50 focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm font-medium"
                        />
                    )}

                    {currentQ.question_type === 'essay' && (
                        <textarea
                            value={answers[currentQ.id] || ''}
                            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                            placeholder="Tulis jawaban Anda di sini..."
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/50 focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm font-medium resize-none"
                        />
                    )}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
                <button
                    onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                    disabled={currentIdx === 0}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl border border-black/10 hover:bg-black/5 transition-colors disabled:opacity-30 active:scale-95"
                >
                    <ArrowLeft01Icon size={16} />
                    Sebelumnya
                </button>

                {currentIdx < questions.length - 1 ? (
                    <button
                        onClick={() => setCurrentIdx(currentIdx + 1)}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors active:scale-95"
                    >
                        Selanjutnya
                        <ArrowRight01Icon size={16} />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors active:scale-95 disabled:opacity-50"
                    >
                        {submitting ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <Tick01Icon size={16} />
                        )}
                        Selesai & Kirim
                    </button>
                )}
            </div>
        </div>
    );
}
