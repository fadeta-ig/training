'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    Clock3,
    Cloud,
    CloudAlert,
    CloudUpload,
    LogOut,
    Send,
} from 'lucide-react';
import WebcamProctor from '@/components/proctor/WebcamProctor';
import { useAntiCheat } from '@/hooks/useAntiCheat';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
    isAnswerComplete,
    normalizeOptions,
    parseIndexSet,
    parseMatchingAnswer,
    parseOptionsJson,
    serializeIndexSet,
    type ExamQuestionType,
    type MatchingPair,
} from '@/lib/exam-answer-utils';

type Question = {
    id: string;
    question_type: ExamQuestionType;
    question_text: string;
    question_image: string | null;
    options_json: unknown;
    points: number;
};

type ExamData = {
    exam: { id: string; title: string; duration_minutes: number; passing_grade: number };
    questions: Question[];
    existingAnswers: { question_id: string; selected_option: string }[];
    serverTime: string;
    sessionEnd: string;
    enableProctoring: boolean;
    attemptStart: string;
    attemptNumber: number;
};

type ExamResult = {
    score?: number;
    passed: boolean;
    earnedPoints?: number;
    totalPoints?: number;
    show_score?: boolean;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function getOptions(question: Question) {
    const parsed = parseOptionsJson(question.options_json);
    if (question.question_type === 'multiple_select' && parsed && typeof parsed === 'object') {
        return normalizeOptions((parsed as { options?: unknown }).options);
    }
    return normalizeOptions(parsed);
}

function getMatchingShape(question: Question): { lefts: string[]; rights: string[] } {
    const parsed = parseOptionsJson(question.options_json);
    if (!parsed || typeof parsed !== 'object') return { lefts: [], rights: [] };
    const shape = parsed as { lefts?: unknown; rights?: unknown };
    return {
        lefts: Array.isArray(shape.lefts)
            ? shape.lefts.filter((item): item is string => typeof item === 'string')
            : [],
        rights: Array.isArray(shape.rights)
            ? shape.rights.filter((item): item is string => typeof item === 'string')
            : [],
    };
}

function AnswerEditor({
    question,
    value,
    onChange,
}: {
    question: Question;
    value: string;
    onChange: (value: string) => void;
}) {
    const options = getOptions(question);

    if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
        return (
            <RadioGroup value={value} onValueChange={(nextValue) => onChange(String(nextValue))} className="gap-3">
                {options.map((option, index) => {
                    const optionValue = String(index);
                    const selected = value === optionValue;
                    return (
                        <Label
                            key={optionValue}
                            htmlFor={`${question.id}-${optionValue}`}
                            className={cn(
                                'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                                selected
                                    ? 'border-foreground bg-muted/70'
                                    : 'border-border bg-background hover:bg-muted/40',
                            )}
                        >
                            <RadioGroupItem id={`${question.id}-${optionValue}`} value={optionValue} className="mt-0.5" />
                            <span className="min-w-0 flex-1 text-sm font-normal leading-6">
                                <span className="break-words">{option.text || `Pilihan ${index + 1}`}</span>
                                {option.image && (
                                    <img
                                        src={option.image}
                                        alt={`Gambar pilihan ${index + 1}`}
                                        className="mt-3 max-h-40 max-w-full rounded-md border object-contain"
                                    />
                                )}
                            </span>
                        </Label>
                    );
                })}
            </RadioGroup>
        );
    }

    if (question.question_type === 'multiple_select') {
        const selected = parseIndexSet(value, options.length) || [];
        return (
            <fieldset className="space-y-3">
                <legend className="mb-3 text-sm text-muted-foreground">Pilih semua jawaban yang benar.</legend>
                {options.map((option, index) => {
                    const checked = selected.includes(index);
                    return (
                        <Label
                            key={index}
                            htmlFor={`${question.id}-multi-${index}`}
                            className={cn(
                                'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                                checked ? 'border-foreground bg-muted/70' : 'border-border hover:bg-muted/40',
                            )}
                        >
                            <Checkbox
                                id={`${question.id}-multi-${index}`}
                                checked={checked}
                                onCheckedChange={(nextChecked) => {
                                    const next = nextChecked
                                        ? [...selected, index]
                                        : selected.filter((item) => item !== index);
                                    onChange(serializeIndexSet(next));
                                }}
                                className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1 text-sm font-normal leading-6">
                                <span className="break-words">{option.text || `Pilihan ${index + 1}`}</span>
                                {option.image && (
                                    <img
                                        src={option.image}
                                        alt={`Gambar pilihan ${index + 1}`}
                                        className="mt-3 max-h-40 max-w-full rounded-md border object-contain"
                                    />
                                )}
                            </span>
                        </Label>
                    );
                })}
            </fieldset>
        );
    }

    if (question.question_type === 'matching') {
        const { lefts, rights } = getMatchingShape(question);
        const pairMap = new Map((parseMatchingAnswer(value) || []).map((pair) => [pair.left, pair.right]));
        const selectedRights = new Set(pairMap.values());

        const updatePair = (left: string, right: string | null) => {
            const nextPairs: MatchingPair[] = lefts.flatMap((leftItem) => {
                const selectedRight = leftItem === left ? right : pairMap.get(leftItem);
                return selectedRight ? [{ left: leftItem, right: selectedRight }] : [];
            });
            onChange(JSON.stringify(nextPairs));
        };

        return (
            <fieldset className="space-y-3">
                <legend className="mb-3 text-sm text-muted-foreground">Pilih pasangan yang sesuai untuk setiap pernyataan.</legend>
                {lefts.map((left, index) => {
                    const selectedRight = pairMap.get(left) || null;
                    return (
                        <div key={`${left}-${index}`} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.9fr)] sm:items-center sm:gap-4">
                            <Label htmlFor={`${question.id}-match-${index}`} className="break-words text-sm font-medium leading-5">
                                {left}
                            </Label>
                            <Select value={selectedRight} onValueChange={(nextValue) => updatePair(left, nextValue)}>
                                <SelectTrigger id={`${question.id}-match-${index}`} className="h-10 w-full">
                                    <SelectValue placeholder="Pilih pasangan" />
                                </SelectTrigger>
                                <SelectContent align="start">
                                    {rights.map((right, rightIndex) => (
                                        <SelectItem
                                            key={`${right}-${rightIndex}`}
                                            value={right}
                                            disabled={selectedRights.has(right) && selectedRight !== right}
                                        >
                                            {right}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    );
                })}
            </fieldset>
        );
    }

    if (question.question_type === 'short_answer') {
        return (
            <div className="space-y-2">
                <Label htmlFor={`${question.id}-short`}>Jawaban singkat</Label>
                <Input
                    id={`${question.id}-short`}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Ketik jawaban Anda"
                    className="h-11"
                    maxLength={20_000}
                />
            </div>
        );
    }

    if (question.question_type === 'essay') {
        return (
            <div className="space-y-2">
                <Label htmlFor={`${question.id}-essay`}>Jawaban esai</Label>
                <Textarea
                    id={`${question.id}-essay`}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Tulis jawaban Anda secara jelas"
                    className="min-h-44 resize-y leading-6"
                    maxLength={20_000}
                />
                <p className="text-right text-xs tabular-nums text-muted-foreground">{value.length.toLocaleString('id-ID')} / 20.000</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Tipe soal ini tidak didukung. Hubungi administrator.
        </div>
    );
}

export default function UjianPage({ params }: { params: Promise<{ id: string; examId: string }> }) {
    const { id: sessionId, examId } = use(params);
    const [examData, setExamData] = useState<ExamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [result, setResult] = useState<ExamResult | null>(null);
    const [isSeb, setIsSeb] = useState(false);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const answersRef = useRef(answers);
    const dirtyQuestionIdsRef = useRef(new Set<string>());
    const autosaveTimerRef = useRef<number | null>(null);
    const deadlineRef = useRef<number | null>(null);
    const serverClockOffsetRef = useRef(0);

    useAntiCheat(!!examData && !result && !error);

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    const handleAnswerChange = useCallback((questionId: string, value: string) => {
        if (answersRef.current[questionId] === value) return;
        dirtyQuestionIdsRef.current.add(questionId);
        setSaveState('idle');
        setAnswers((previous) => ({ ...previous, [questionId]: value }));
    }, []);

    const saveDraft = useCallback(async () => {
        if (!examData || dirtyQuestionIdsRef.current.size === 0 || submitting || result) return;
        const questionIds = [...dirtyQuestionIdsRef.current];
        const payload = questionIds.map((questionId) => ({
            question_id: questionId,
            selected_option: answersRef.current[questionId] || '',
        }));

        setSaveState('saving');
        try {
            const response = await fetch(`/api/participant/sessions/${sessionId}/exam/${examId}/answers`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attempt_number: examData.attemptNumber, answers: payload }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Draft gagal disimpan');

            for (const item of payload) {
                if ((answersRef.current[item.question_id] || '') === item.selected_option) {
                    dirtyQuestionIdsRef.current.delete(item.question_id);
                }
            }
            setSaveState(dirtyQuestionIdsRef.current.size === 0 ? 'saved' : 'idle');
        } catch {
            setSaveState('error');
        }
    }, [examData, examId, result, sessionId, submitting]);

    useEffect(() => {
        if (!examData || dirtyQuestionIdsRef.current.size === 0) return;
        if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = window.setTimeout(saveDraft, 800);
        return () => {
            if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
        };
    }, [answers, examData, saveDraft]);

    const handleProctorError = useCallback((message: string) => {
        toast.error('Kamera proctoring tidak aktif', { description: message });
    }, []);

    const submitExam = useCallback(async () => {
        if (!examData || submitting) return;
        if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
        setConfirmOpen(false);
        setSubmitting(true);

        const payload = examData.questions.map((question) => ({
            question_id: question.id,
            selected_option: answersRef.current[question.id] || '',
        }));

        try {
            const response = await fetch(`/api/participant/sessions/${sessionId}/exam/${examId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: payload }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Gagal mengirim jawaban ujian');
            dirtyQuestionIdsRef.current.clear();
            setResult(data.data);
            toast.success('Jawaban ujian berhasil dikirim');
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'Kesalahan jaringan saat mengirim jawaban';
            setError(message);
            toast.error('Gagal mengirim ujian', { description: message });
        } finally {
            setSubmitting(false);
        }
    }, [examData, examId, sessionId, submitting]);

    useEffect(() => {
        if (typeof window !== 'undefined' && (
            navigator.userAgent.includes('SafeExamBrowser') ||
            'SafeExamBrowser' in window
        )) {
            setIsSeb(true);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/participant/sessions/${sessionId}/exam/${examId}`)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'Gagal memuat ujian');
                return data.data as ExamData;
            })
            .then((data) => {
                if (cancelled) return;
                const restored = Object.fromEntries(
                    data.existingAnswers.map((answer) => [answer.question_id, answer.selected_option]),
                );
                setAnswers(restored);

                const durationMs = Number(data.exam.duration_minutes) * 60 * 1000;
                const serverNow = new Date(data.serverTime).getTime();
                const attemptStart = new Date(data.attemptStart).getTime();
                const deadline = attemptStart + durationMs;
                if (![durationMs, serverNow, attemptStart, deadline].every(Number.isFinite) || durationMs <= 0) {
                    throw new Error('Konfigurasi waktu ujian tidak valid. Hubungi administrator.');
                }

                deadlineRef.current = deadline;
                serverClockOffsetRef.current = serverNow - Date.now();
                setTimeLeft(Math.max(0, Math.ceil((deadline - serverNow) / 1000)));
                setExamData(data);
            })
            .catch((fetchError) => {
                if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'Kesalahan jaringan');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [examId, sessionId]);

    useEffect(() => {
        if (result || error || !examData || deadlineRef.current === null) return;
        const syncTimer = () => {
            const serverAdjustedNow = Date.now() + serverClockOffsetRef.current;
            setTimeLeft(Math.max(0, Math.ceil((deadlineRef.current! - serverAdjustedNow) / 1000)));
        };
        syncTimer();
        const timer = window.setInterval(syncTimer, 1000);
        document.addEventListener('visibilitychange', syncTimer);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', syncTimer);
        };
    }, [error, examData, result]);

    useEffect(() => {
        if (examData && deadlineRef.current !== null && timeLeft <= 0 && !result && !error && !submitting) {
            submitExam();
        }
    }, [error, examData, result, submitExam, submitting, timeLeft]);

    const questions = useMemo(() => examData?.questions || [], [examData]);
    const answeredCount = useMemo(
        () => questions.filter((question) => isAnswerComplete(question, answers[question.id] || '')).length,
        [answers, questions],
    );
    const unansweredCount = questions.length - answeredCount;
    const progressValue = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="grid min-h-dvh place-items-center bg-muted/30">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                    Menyiapkan ujian...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <main className="grid min-h-dvh place-items-center bg-muted/30 p-4">
                <Card className="w-full max-w-lg rounded-lg">
                    <CardContent className="space-y-5 py-8 text-center">
                        <AlertCircle className="mx-auto size-10 text-destructive" />
                        <div className="space-y-1">
                            <h1 className="text-lg font-semibold">Ujian tidak dapat dilanjutkan</h1>
                            <p className="text-sm text-muted-foreground">{error}</p>
                        </div>
                        <Link href={`/dashboard/sesi/${sessionId}`} className={buttonVariants({ variant: 'outline' })}>
                            <ArrowLeft /> Kembali ke sesi
                        </Link>
                    </CardContent>
                </Card>
            </main>
        );
    }

    if (result) {
        return (
            <main className="grid min-h-dvh place-items-center bg-muted/30 p-4">
                <Card className="w-full max-w-lg rounded-lg">
                    <CardContent className="space-y-6 py-8 text-center">
                        <div className={cn(
                            'mx-auto grid size-14 place-items-center rounded-full',
                            result.show_score === false || result.passed
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700',
                        )}>
                            {result.show_score === false || result.passed ? <Check className="size-7" /> : <AlertCircle className="size-7" />}
                        </div>
                        {result.show_score !== false ? (
                            <div className="space-y-3">
                                <div>
                                    <h1 className="text-xl font-semibold">{result.passed ? 'Ujian selesai dan lulus' : 'Ujian selesai'}</h1>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {result.passed ? 'Nilai Anda memenuhi batas kelulusan.' : 'Nilai Anda belum memenuhi batas kelulusan.'}
                                    </p>
                                </div>
                                <p className="text-4xl font-semibold tabular-nums">{result.score}%</p>
                                <p className="text-sm text-muted-foreground">{result.earnedPoints} dari {result.totalPoints} poin</p>
                            </div>
                        ) : (
                            <div>
                                <h1 className="text-xl font-semibold">Ujian selesai</h1>
                                <p className="mt-1 text-sm text-muted-foreground">Jawaban Anda telah disimpan.</p>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Link href={`/dashboard/sesi/${sessionId}`} className={buttonVariants({ size: 'lg' })}>
                                <ArrowLeft /> Kembali ke sesi
                            </Link>
                            {isSeb && (
                                <Link href="/quit-seb" className={buttonVariants({ variant: 'destructive', size: 'lg' })}>
                                    <LogOut /> Keluar aplikasi SEB
                                </Link>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        );
    }

    if (!examData) return null;

    if (questions.length === 0) {
        return (
            <main className="grid min-h-dvh place-items-center bg-muted/30 p-4">
                <Card className="w-full max-w-lg rounded-lg">
                    <CardContent className="space-y-4 py-8 text-center">
                        <AlertCircle className="mx-auto size-10 text-amber-600" />
                        <div>
                            <h1 className="text-lg font-semibold">Belum ada soal</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Hubungi administrator atau trainer untuk memeriksa ujian ini.</p>
                        </div>
                        <Link href={`/dashboard/sesi/${sessionId}`} className={buttonVariants({ variant: 'outline' })}>
                            <ArrowLeft /> Kembali ke sesi
                        </Link>
                    </CardContent>
                </Card>
            </main>
        );
    }

    const currentQuestion = questions[currentIdx];
    const lowTime = timeLeft <= 5 * 60;
    const saveLabel = saveState === 'saving'
        ? 'Menyimpan'
        : saveState === 'error'
            ? 'Belum tersimpan'
            : saveState === 'saved'
                ? 'Tersimpan'
                : 'Autosave aktif';
    const SaveIcon = saveState === 'saving' ? CloudUpload : saveState === 'error' ? CloudAlert : Cloud;

    return (
        <div className="min-h-dvh bg-muted/30 text-foreground">
            {examData.enableProctoring && (
                <WebcamProctor
                    sessionId={sessionId}
                    isActive
                    onError={handleProctorError}
                />
            )}

            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 xl:pr-44">
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-sm font-semibold sm:text-base">{examData.exam.title}</h1>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Soal {currentIdx + 1} / {questions.length}</span>
                            <span aria-hidden="true">|</span>
                            <span>{answeredCount} dijawab</span>
                        </div>
                    </div>
                    <div className={cn(
                        'flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 font-mono text-base font-semibold tabular-nums',
                        lowTime ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'bg-muted/50',
                    )} aria-label={`Sisa waktu ${formatTime(timeLeft)}`}>
                        <Clock3 className="size-4" />
                        {formatTime(timeLeft)}
                    </div>
                </div>
                <Progress value={progressValue} className="gap-0 [&_[data-slot=progress-track]]:h-1 [&_[data-slot=progress-track]]:rounded-none" aria-label={`${answeredCount} dari ${questions.length} soal dijawab`} />
            </header>

            <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:py-7 xl:pr-44">
                <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                    <div className="rounded-lg border bg-background p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Daftar soal</span>
                            <Badge variant="secondary">{answeredCount}/{questions.length}</Badge>
                        </div>
                        <nav aria-label="Navigasi soal" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
                            {questions.map((question, index) => {
                                const complete = isAnswerComplete(question, answers[question.id] || '');
                                const active = index === currentIdx;
                                return (
                                    <Button
                                        key={question.id}
                                        type="button"
                                        variant={active ? 'default' : complete ? 'secondary' : 'outline'}
                                        size="icon"
                                        className={cn(
                                            'size-9 shrink-0 tabular-nums',
                                            complete && !active && 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
                                        )}
                                        onClick={() => setCurrentIdx(index)}
                                        aria-label={`Soal ${index + 1}${complete ? ', sudah dijawab' : ', belum dijawab'}`}
                                        aria-current={active ? 'step' : undefined}
                                    >
                                        {index + 1}
                                    </Button>
                                );
                            })}
                        </nav>
                        <div className={cn(
                            'mt-3 flex items-center gap-2 border-t pt-3 text-xs',
                            saveState === 'error' ? 'text-destructive' : 'text-muted-foreground',
                        )} aria-live="polite">
                            <SaveIcon className={cn('size-3.5', saveState === 'saving' && 'animate-pulse')} />
                            {saveLabel}
                        </div>
                    </div>
                </aside>

                <section className="min-w-0 space-y-4">
                    <Card className="rounded-lg shadow-sm">
                        <CardHeader className="border-b">
                            <div className="flex items-center justify-between gap-3">
                                <Badge variant="outline">Soal {currentIdx + 1}</Badge>
                                <span className="text-xs font-medium text-muted-foreground">{currentQuestion.points} poin</span>
                            </div>
                            <CardTitle className="whitespace-pre-wrap break-words text-base font-medium leading-7 sm:text-lg">
                                {currentQuestion.question_text}
                            </CardTitle>
                            {currentQuestion.question_image && (
                                <img
                                    src={currentQuestion.question_image}
                                    alt="Gambar soal"
                                    className="max-h-80 max-w-full rounded-lg border object-contain"
                                />
                            )}
                        </CardHeader>
                        <CardContent className="py-5 sm:py-6">
                            <AnswerEditor
                                question={currentQuestion}
                                value={answers[currentQuestion.id] || ''}
                                onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                            />
                        </CardContent>
                    </Card>
                </section>
            </main>

            <footer className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:pr-44">
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={currentIdx === 0 || submitting}
                        onClick={() => setCurrentIdx((index) => Math.max(0, index - 1))}
                    >
                        <ArrowLeft />
                        <span className="hidden sm:inline">Sebelumnya</span>
                    </Button>

                    {currentIdx < questions.length - 1 ? (
                        <Button
                            type="button"
                            size="lg"
                            disabled={submitting}
                            onClick={() => setCurrentIdx((index) => Math.min(questions.length - 1, index + 1))}
                        >
                            Selanjutnya <ArrowRight />
                        </Button>
                    ) : (
                        <Button type="button" size="lg" disabled={submitting} onClick={() => setConfirmOpen(true)}>
                            {submitting ? <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <Send />}
                            Kirim ujian
                        </Button>
                    )}
                </div>
            </footer>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia>
                            {unansweredCount > 0 ? <AlertCircle className="text-amber-600" /> : <CheckCircle2 className="text-emerald-600" />}
                        </AlertDialogMedia>
                        <AlertDialogTitle>Kirim jawaban ujian?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {unansweredCount > 0
                                ? `${unansweredCount} soal masih belum dijawab. Jawaban tidak dapat diubah setelah dikirim.`
                                : 'Semua soal sudah dijawab. Jawaban tidak dapat diubah setelah dikirim.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={submitting}>Periksa lagi</AlertDialogCancel>
                        <AlertDialogAction disabled={submitting} onClick={submitExam}>
                            <Send /> Kirim jawaban
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
