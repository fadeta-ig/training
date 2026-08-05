'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ClipboardCheck,
    Clock3,
    Loader2,
    MinusCircle,
    X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    normalizeOptions,
    parseIndexSet,
    parseMatchingAnswer,
    parseOptionsJson,
    type ExamQuestionType,
    type MatchingPair,
} from '@/lib/exam-answer-utils';

type AnswerReview = {
    id: string;
    question_id: string;
    question_type: ExamQuestionType;
    question_text: string;
    question_image: string | null;
    options_json: unknown;
    correct_option_index: number | null;
    correct_answer: string | null;
    points: number;
    selected_option: string;
    is_correct: boolean;
    grading_status: 'auto' | 'pending' | 'graded';
    awarded_points: number;
    answered_at: string;
    graded_at: string | null;
    grader_name: string | null;
};

type AttemptReview = {
    attempt_number: number;
    submitted_at: string;
    score: number;
    total_points: number;
    earned_points: number;
    correct_count: number;
    incorrect_count: number;
    unanswered_count: number;
    pending_count: number;
    answers: AnswerReview[];
};

type ExamReview = {
    exam_id: string;
    title: string;
    attempts: AttemptReview[];
};

type ReviewData = {
    session: { id: string; title: string };
    participant: { id: string; username: string; full_name: string };
    exams: ExamReview[];
};

function getOptionLabels(answer: AnswerReview): string[] {
    const parsed = parseOptionsJson(answer.options_json);
    if (answer.question_type === 'multiple_select' && parsed && typeof parsed === 'object') {
        return normalizeOptions((parsed as { options?: unknown }).options).map((option) => option.text);
    }
    return normalizeOptions(parsed).map((option) => option.text);
}

function getMatchingPairs(value: unknown): MatchingPair[] {
    const parsed = parseOptionsJson(value);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { pairs?: unknown }).pairs)) return [];
    return (parsed as { pairs: unknown[] }).pairs.filter((pair): pair is MatchingPair => {
        if (!pair || typeof pair !== 'object') return false;
        const candidate = pair as { left?: unknown; right?: unknown };
        return typeof candidate.left === 'string' && typeof candidate.right === 'string';
    });
}

function AnswerValue({ answer, correct }: { answer: AnswerReview; correct: boolean }) {
    const options = getOptionLabels(answer);
    let lines: string[] = [];

    if (correct) {
        if (answer.question_type === 'multiple_choice' || answer.question_type === 'true_false') {
            const index = Number(answer.correct_option_index);
            lines = Number.isInteger(index) && options[index] !== undefined ? [options[index]] : [];
        } else if (answer.question_type === 'multiple_select') {
            const parsed = parseOptionsJson(answer.options_json);
            const correctIndices = parsed && typeof parsed === 'object' && Array.isArray((parsed as { correct_indices?: unknown }).correct_indices)
                ? (parsed as { correct_indices: unknown[] }).correct_indices.filter((index): index is number => Number.isInteger(index))
                : [];
            lines = correctIndices.map((index) => options[index]).filter((option): option is string => typeof option === 'string');
        } else if (answer.question_type === 'matching') {
            lines = getMatchingPairs(answer.options_json).map((pair) => `${pair.left} -> ${pair.right}`);
        } else if (answer.question_type === 'short_answer') {
            lines = answer.correct_answer ? [answer.correct_answer] : [];
        } else {
            lines = ['Dinilai manual oleh admin'];
        }
    } else if (answer.question_type === 'multiple_choice' || answer.question_type === 'true_false') {
        const index = /^\d+$/.test(answer.selected_option) ? Number(answer.selected_option) : -1;
        lines = options[index] !== undefined ? [options[index]] : [];
    } else if (answer.question_type === 'multiple_select') {
        const indices = parseIndexSet(answer.selected_option, options.length) || [];
        lines = indices.map((index) => options[index]).filter((option): option is string => typeof option === 'string');
    } else if (answer.question_type === 'matching') {
        lines = (parseMatchingAnswer(answer.selected_option) || []).map((pair) => `${pair.left} -> ${pair.right}`);
    } else {
        lines = answer.selected_option.trim() ? [answer.selected_option] : [];
    }

    if (lines.length === 0) return <span className="italic text-muted-foreground">Tidak dijawab</span>;
    return (
        <div className="space-y-1.5">
            {lines.map((line, index) => (
                <p key={`${line}-${index}`} className="whitespace-pre-wrap break-words leading-6">{line}</p>
            ))}
        </div>
    );
}

function StatusBadge({ answer }: { answer: AnswerReview }) {
    if (!answer.selected_option.trim()) {
        return <Badge variant="outline"><MinusCircle /> Kosong</Badge>;
    }
    if (answer.grading_status === 'pending') {
        return <Badge variant="secondary"><Clock3 /> Menunggu nilai</Badge>;
    }
    if (answer.is_correct) {
        return <Badge className="bg-emerald-100 text-emerald-800"><Check /> Benar</Badge>;
    }
    return <Badge variant="destructive"><X /> Salah</Badge>;
}

export default function ParticipantAnswersPage({
    params,
}: {
    params: Promise<{ id: string; participantId: string }>;
}) {
    const { id: sessionId, participantId } = use(params);
    const [data, setData] = useState<ReviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedExamId, setSelectedExamId] = useState('');
    const [selectedAttemptNumber, setSelectedAttemptNumber] = useState<number | null>(null);
    const [gradingAnswerId, setGradingAnswerId] = useState<string | null>(null);

    const loadAnswers = useCallback(async (initial = false) => {
        if (initial) setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/admin/sessions/${sessionId}/participants/${participantId}/answers`);
            const body = await response.json();
            if (!response.ok || !body.success) throw new Error(body.error || 'Gagal memuat jawaban peserta');
            const nextData = body.data as ReviewData;
            setData(nextData);
            setSelectedExamId((current) => {
                if (current && nextData.exams.some((exam) => exam.exam_id === current)) return current;
                const requested = typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('exam')
                    : null;
                return nextData.exams.find((exam) => exam.exam_id === requested)?.exam_id
                    || nextData.exams[0]?.exam_id
                    || '';
            });
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'Kesalahan jaringan');
        } finally {
            if (initial) setLoading(false);
        }
    }, [participantId, sessionId]);

    useEffect(() => {
        loadAnswers(true);
    }, [loadAnswers]);

    const selectedExam = useMemo(
        () => data?.exams.find((exam) => exam.exam_id === selectedExamId) || null,
        [data, selectedExamId],
    );

    useEffect(() => {
        if (!selectedExam) {
            setSelectedAttemptNumber(null);
            return;
        }
        setSelectedAttemptNumber((current) =>
            selectedExam.attempts.some((attempt) => attempt.attempt_number === current)
                ? current
                : selectedExam.attempts[0]?.attempt_number ?? null,
        );
    }, [selectedExam]);

    const selectedAttempt = selectedExam?.attempts.find(
        (attempt) => attempt.attempt_number === selectedAttemptNumber,
    ) || null;

    const gradeEssay = async (answer: AnswerReview, isCorrect: boolean) => {
        if (!selectedExam || !selectedAttempt || gradingAnswerId) return;
        setGradingAnswerId(answer.id);
        try {
            const response = await fetch('/api/admin/grading', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    user_id: participantId,
                    exam_id: selectedExam.exam_id,
                    question_id: answer.question_id,
                    attempt_number: selectedAttempt.attempt_number,
                    is_correct: isCorrect,
                }),
            });
            const body = await response.json();
            if (!response.ok || !body.success) throw new Error(body.error || 'Gagal menyimpan nilai');
            await loadAnswers();
            toast.success('Nilai jawaban diperbarui');
        } catch (gradeError) {
            toast.error('Gagal menyimpan nilai', {
                description: gradeError instanceof Error ? gradeError.message : 'Kesalahan jaringan',
            });
        } finally {
            setGradingAnswerId(null);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-5">
                <Skeleton className="h-8 w-44" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="mx-auto max-w-xl space-y-4">
                <Link href={`/admin/sessions/${sessionId}/participants/${participantId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="size-4" /> Kembali
                </Link>
                <Card className="rounded-lg">
                    <CardContent className="space-y-3 py-8 text-center">
                        <AlertCircle className="mx-auto size-9 text-destructive" />
                        <p className="text-sm text-destructive">{error || 'Data tidak ditemukan'}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-12">
            <Link href={`/admin/sessions/${sessionId}/participants/${participantId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" /> Kembali ke hasil peserta
            </Link>

            <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <ClipboardCheck className="size-5 text-muted-foreground" />
                        <h1 className="text-xl font-semibold sm:text-2xl">Detail Jawaban Peserta</h1>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                        {data.participant.full_name} ({data.participant.username})
                    </p>
                    <p className="text-sm text-muted-foreground">{data.session.title}</p>
                </div>

                {data.exams.length > 0 && (
                    <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                        <Select value={selectedExamId} onValueChange={(value) => setSelectedExamId(String(value))}>
                            <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Pilih ujian">
                                <SelectValue>{selectedExam?.title || 'Pilih ujian'}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {data.exams.map((exam) => (
                                    <SelectItem key={exam.exam_id} value={exam.exam_id}>{exam.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={selectedAttemptNumber === null ? null : String(selectedAttemptNumber)}
                            onValueChange={(value) => setSelectedAttemptNumber(Number(value))}
                            disabled={!selectedExam}
                        >
                            <SelectTrigger className="h-9 w-full sm:w-36" aria-label="Pilih percobaan">
                                <SelectValue>
                                    {selectedAttemptNumber === null ? 'Percobaan' : `Percobaan ${selectedAttemptNumber}`}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {selectedExam?.attempts.map((attempt) => (
                                    <SelectItem key={attempt.attempt_number} value={String(attempt.attempt_number)}>
                                        Attempt {attempt.attempt_number}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {!selectedAttempt ? (
                <Card className="rounded-lg">
                    <CardContent className="py-12 text-center">
                        <ClipboardCheck className="mx-auto size-10 text-muted-foreground/40" />
                        <h2 className="mt-3 font-medium">Belum ada jawaban ujian</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Peserta belum menyelesaikan attempt ujian pada sesi ini.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-background sm:grid-cols-5">
                        {[
                            ['Skor', `${selectedAttempt.score}%`],
                            ['Benar', selectedAttempt.correct_count],
                            ['Salah', selectedAttempt.incorrect_count],
                            ['Kosong', selectedAttempt.unanswered_count],
                            ['Pending', selectedAttempt.pending_count],
                        ].map(([label, value], index) => (
                            <div key={String(label)} className={cn('p-4', index > 0 && 'border-l', index === 4 && 'col-span-2 border-t sm:col-span-1 sm:border-t-0')}>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4">
                        {selectedAttempt.answers.map((answer, index) => (
                            <Card key={answer.id} className="rounded-lg shadow-none">
                                <CardHeader className="border-b">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">Soal {index + 1}</Badge>
                                            <span className="text-xs text-muted-foreground">{answer.awarded_points}/{answer.points} poin</span>
                                        </div>
                                        <StatusBadge answer={answer} />
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6 sm:text-base">{answer.question_text}</p>
                                    {answer.question_image && (
                                        <img src={answer.question_image} alt="Gambar soal" className="max-h-64 max-w-full rounded-lg border object-contain" />
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-5 py-5">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="min-w-0">
                                            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Jawaban peserta</p>
                                            <div className={cn(
                                                'rounded-lg border p-3 text-sm',
                                                answer.is_correct && answer.grading_status !== 'pending'
                                                    ? 'border-emerald-200 bg-emerald-50/70'
                                                    : 'bg-muted/30',
                                            )}>
                                                <AnswerValue answer={answer} correct={false} />
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                                                {answer.question_type === 'essay' ? 'Status penilaian' : 'Kunci jawaban'}
                                            </p>
                                            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                                                <AnswerValue answer={answer} correct />
                                            </div>
                                        </div>
                                    </div>

                                    {answer.question_type === 'essay' && answer.selected_option.trim() && (
                                        <div className="flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
                                            <p className="text-xs text-muted-foreground">
                                                {answer.graded_at
                                                    ? `Dinilai oleh ${answer.grader_name || 'Admin'} pada ${new Date(answer.graded_at).toLocaleString('id-ID')}`
                                                    : 'Jawaban ini memerlukan penilaian manual.'}
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant={answer.grading_status === 'graded' && !answer.is_correct ? 'destructive' : 'outline'}
                                                    disabled={gradingAnswerId !== null}
                                                    onClick={() => gradeEssay(answer, false)}
                                                >
                                                    {gradingAnswerId === answer.id ? <Loader2 className="animate-spin" /> : <X />}
                                                    Salah
                                                </Button>
                                                <Button
                                                    type="button"
                                                    className="bg-emerald-700 text-white hover:bg-emerald-800"
                                                    disabled={gradingAnswerId !== null}
                                                    onClick={() => gradeEssay(answer, true)}
                                                >
                                                    {gradingAnswerId === answer.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                                                    Benar
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
