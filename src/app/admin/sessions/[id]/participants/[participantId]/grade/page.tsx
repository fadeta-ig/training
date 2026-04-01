'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
    UserCircleIcon, 
    ArrowLeft01Icon, 
    CheckmarkBadge01Icon,
    Cancel01Icon,
    File01Icon
} from 'hugeicons-react';

interface AnswerData {
    id: string;
    question_id: string;
    question_text: string;
    question_type: string;
    points: number;
    selected_option: string;
    is_correct: boolean;
    answered_at: string;
}

export default function GradeParticipantPage({
    params,
}: {
    params: Promise<{ id: string; participantId: string }>;
}) {
    const router = useRouter();
    const resolvedParams = use(params);
    const { id: sessionId, participantId } = resolvedParams;

    const [answers, setAnswers] = useState<AnswerData[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        fetchAnswers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, participantId]);

    const fetchAnswers = async () => {
        setLoading(true);
        try {
            // Need a dedicated GET endpoint or we can fetch via participant details.
            // For now, assuming an endpoint exists at /api/admin/sessions/[id]/participants/[participantId]/answers
            const res = await fetch(`/api/admin/sessions/${sessionId}/participants/${participantId}/answers`);
            const data = await res.json();
            if (data.success) {
                setAnswers(data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleGradeEssay = async (questionId: string, isCorrect: boolean) => {
        setSavingId(questionId);
        try {
            const res = await fetch('/api/admin/grading', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    user_id: participantId,
                    question_id: questionId,
                    is_correct: isCorrect
                })
            });
            const data = await res.json();
            if (data.success) {
                // Update local state
                setAnswers(prev => prev.map(ans => 
                    ans.question_id === questionId ? { ...ans, is_correct: isCorrect } : ans
                ));
            } else {
                alert(data.error || 'Gagal menyimpan nilai');
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan sistem');
        } finally {
            setSavingId(null);
        }
    };

    // Filter only essay questions
    const essayAnswers = answers.filter(a => a.question_type === 'essay');
    const autoGradedAnswers = answers.filter(a => a.question_type !== 'essay');

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft01Icon size={16} />
                Kembali ke Detail Sesi
            </button>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <File01Icon className="text-primary" size={28} />
                        Penilaian Manual (Essay)
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Berikan penilaian (Benar/Salah) untuk jawaban essay peserta.
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
            ) : essayAnswers.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center h-48 text-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center text-muted-foreground">
                        <CheckmarkBadge01Icon size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Tidak Ada Soal Essay</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Peserta ini tidak memiliki jawaban essay yang perlu dinilai manual.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {essayAnswers.map((ans, index) => (
                        <div key={ans.id} className="glass-card p-6 border-l-4 border-l-primary space-y-4">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold px-2 py-1 rounded bg-black/5 text-muted-foreground">
                                        Soal #{index + 1}
                                    </span>
                                    <h3 className="font-semibold text-foreground mt-2">{ans.question_text}</h3>
                                    <p className="text-xs text-muted-foreground">Bobot: {ans.points} poin</p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    <button
                                        onClick={() => handleGradeEssay(ans.question_id, true)}
                                        disabled={savingId === ans.question_id}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                                            ans.is_correct 
                                                ? 'bg-green-500 text-white shadow-md' 
                                                : 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                                        } active:scale-95 disabled:opacity-50`}
                                    >
                                        <CheckmarkBadge01Icon size={18} />
                                        Benar
                                    </button>
                                    <button
                                        onClick={() => handleGradeEssay(ans.question_id, false)}
                                        disabled={savingId === ans.question_id}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                                            !ans.is_correct 
                                                ? 'bg-red-500 text-white shadow-md' 
                                                : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                                        } active:scale-95 disabled:opacity-50`}
                                    >
                                        <Cancel01Icon size={18} />
                                        Salah
                                    </button>
                                </div>
                            </div>

                            <div className="bg-black/5 rounded-xl p-4 mt-4 relative">
                                <div className="absolute top-0 left-4 -translate-y-1/2 bg-background px-2 text-[10px] uppercase font-bold text-muted-foreground rounded-full border border-black/10">
                                    Jawaban Peserta
                                </div>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed mt-2">
                                    {ans.selected_option || <span className="text-muted-foreground italic">(Kosong)</span>}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
