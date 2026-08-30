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
    Flag,
    HelpCircle,
    Layers,
    LogOut,
    Send,
    X,
} from 'lucide-react';
import WebcamProctor from '@/components/proctor/WebcamProctor';
import { ClientPortal } from '@/components/ui/ClientPortal';
import { useAntiCheat } from '@/hooks/useAntiCheat';
import { useIsSeb } from '@/hooks/useSeb';
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
    exam: { 
        id: string; 
        title: string; 
        duration_minutes: number; 
        passing_grade: number;
        is_remedial_attempt?: boolean;
        remedial_exam_title?: string | null;
    };
    questions: Question[];
    existingAnswers: { question_id: string; selected_option: string }[];
    serverTime: string;
    sessionEnd: string;
    enableProctoring: boolean;
    attemptStart: string;
    attemptNumber: number;
    attemptVersion?: number;
};

type ExamResult = {
    score?: number;
    passed: boolean;
    earnedPoints?: number;
    totalPoints?: number;
    show_score?: boolean;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

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
                                    ? 'border-primary/80 bg-primary/5 text-foreground ring-1 ring-primary/40'
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
                                checked ? 'border-primary/80 bg-primary/5 text-foreground ring-1 ring-primary/40' : 'border-border hover:bg-muted/40',
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
    const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [result, setResult] = useState<ExamResult | null>(null);
    const isSeb = useIsSeb();
    const [isOnline, setIsOnline] = useState(true);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

    const answersRef = useRef(answers);
    const dirtyQuestionIdsRef = useRef(new Set<string>());
    const autosaveTimerRef = useRef<number | null>(null);
    const deadlineRef = useRef<number | null>(null);
    const serverClockOffsetRef = useRef(0);

    const warned15MinRef = useRef(false);
    const warned5MinRef = useRef(false);
    const warned1MinRef = useRef(false);

    useAntiCheat(!!examData && !result && !error);

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    // Initialize online state & restore local flags and draft fallback
    useEffect(() => {
        setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

        try {
            const savedFlags = localStorage.getItem(`exam_flags_${sessionId}_${examId}`);
            if (savedFlags) {
                const parsed = JSON.parse(savedFlags);
                if (Array.isArray(parsed)) {
                    setFlaggedIds(new Set(parsed));
                }
            }
        } catch {}
    }, [examId, sessionId]);

    const toggleFlag = useCallback((questionId: string) => {
        setFlaggedIds((prev) => {
            const next = new Set(prev);
            if (next.has(questionId)) {
                next.delete(questionId);
            } else {
                next.add(questionId);
            }
            try {
                localStorage.setItem(`exam_flags_${sessionId}_${examId}`, JSON.stringify(Array.from(next)));
            } catch {}
            return next;
        });
    }, [examId, sessionId]);

    const handleAnswerChange = useCallback((questionId: string, value: string) => {
        if (answersRef.current[questionId] === value) return;
        dirtyQuestionIdsRef.current.add(questionId);
        setSaveState('idle');
        setAnswers((previous) => {
            const next = { ...previous, [questionId]: value };
            try {
                localStorage.setItem(`exam_draft_${sessionId}_${examId}`, JSON.stringify(next));
            } catch {}
            return next;
        });
    }, [examId, sessionId]);

    const saveDraft = useCallback(async () => {
        if (!examData || dirtyQuestionIdsRef.current.size === 0 || submitting || result) return;

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setSaveState('offline');
            return;
        }

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
                body: JSON.stringify({
                    attempt_number: examData.attemptNumber,
                    attempt_version: examData.attemptVersion || 1,
                    answers: payload,
                }),
            });
            const data = await response.json();

            if (response.status === 409) {
                toast.error('Akses Ujian Diperbarui', {
                    description: 'Administrator telah memperbarui status ujian Anda. Halaman akan dimuat ulang.',
                });
                setTimeout(() => window.location.reload(), 1500);
                return;
            }

            if (!response.ok || !data.success) throw new Error(data.error || 'Draft gagal disimpan');

            for (const item of payload) {
                if ((answersRef.current[item.question_id] || '') === item.selected_option) {
                    dirtyQuestionIdsRef.current.delete(item.question_id);
                }
            }
            setSaveState(dirtyQuestionIdsRef.current.size === 0 ? 'saved' : 'idle');
        } catch {
            setSaveState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
        }
    }, [examData, examId, result, sessionId, submitting]);

    // Network connectivity listeners & auto-sync
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Koneksi Internet Pulih', {
                description: 'Menyinkronkan draft jawaban ke server...',
            });
            saveDraft();
        };
        const handleOffline = () => {
            setIsOnline(false);
            setSaveState('offline');
            toast.warning('Koneksi Internet Terputus', {
                description: 'Jawaban Anda tetap aman tersimpan di memori perangkat lokal.',
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [saveDraft]);

    // Debounced autosave
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
            try {
                localStorage.removeItem(`exam_draft_${sessionId}_${examId}`);
                localStorage.removeItem(`exam_flags_${sessionId}_${examId}`);
            } catch {}
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

    // Initial Exam Fetch with Server NTP Offset
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
                const serverAnswers = Object.fromEntries(
                    data.existingAnswers.map((answer) => [answer.question_id, answer.selected_option]),
                );

                // Check if there is local draft fallback
                let finalAnswers = serverAnswers;
                try {
                    const localDraftStr = localStorage.getItem(`exam_draft_${sessionId}_${examId}`);
                    if (localDraftStr) {
                        const localDraft = JSON.parse(localDraftStr);
                        if (localDraft && typeof localDraft === 'object') {
                            finalAnswers = { ...serverAnswers, ...localDraft };
                        }
                    }
                } catch {}

                setAnswers(finalAnswers);

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

    // Sync timer every second
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

    // Smart Timer Warning Triggers
    useEffect(() => {
        if (!examData || result || error || timeLeft <= 0) return;

        if (timeLeft <= 15 * 60 && timeLeft > 14 * 60 && !warned15MinRef.current) {
            warned15MinRef.current = true;
            toast.info('Peringatan Sisa Waktu', {
                description: 'Sisa waktu ujian Anda adalah 15 menit.',
            });
        }
        if (timeLeft <= 5 * 60 && timeLeft > 4 * 60 && !warned5MinRef.current) {
            warned5MinRef.current = true;
            toast.warning('Peringatan Sisa Waktu', {
                description: 'Sisa waktu ujian 5 menit! Harap tinjau kembali soal yang ragu-ragu/kosong.',
            });
        }
        if (timeLeft <= 60 && timeLeft > 0 && !warned1MinRef.current) {
            warned1MinRef.current = true;
            toast.error('Waktu Hampir Habis', {
                description: 'Sisa waktu tinggal 1 menit! Sistem akan mengirimkan jawaban Anda secara otomatis.',
            });
        }
    }, [error, examData, result, timeLeft]);

    // Auto submit on time expiry
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

    const flaggedCount = useMemo(
        () => questions.filter((question) => flaggedIds.has(question.id)).length,
        [flaggedIds, questions],
    );

    const confidentAnsweredCount = useMemo(
        () => questions.filter((question) => isAnswerComplete(question, answers[question.id] || '') && !flaggedIds.has(question.id)).length,
        [answers, flaggedIds, questions],
    );

    const unansweredCount = questions.length - answeredCount;
    const progressValue = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

    const uncompletedOrFlaggedList = useMemo(() => {
        return questions
            .map((q, idx) => ({
                question: q,
                index: idx,
                isComplete: isAnswerComplete(q, answers[q.id] || ''),
                isFlagged: flaggedIds.has(q.id),
            }))
            .filter((item) => !item.isComplete || item.isFlagged);
    }, [answers, flaggedIds, questions]);

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
                                <a href="/quit-seb" className={buttonVariants({ variant: 'destructive', size: 'lg' })}>
                                    <LogOut /> Keluar aplikasi SEB
                                </a>
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
    const isCurrentFlagged = flaggedIds.has(currentQuestion.id);
    const criticalTime = timeLeft <= 3 * 60;
    const warningTime = timeLeft <= 10 * 60 && !criticalTime;

    const saveLabel = saveState === 'saving'
        ? 'Menyimpan draft...'
        : saveState === 'offline'
            ? 'Offline - Tersimpan di cache lokal'
            : saveState === 'error'
                ? 'Gagal menyimpan ke server'
                : saveState === 'saved'
                    ? 'Tersimpan ke server'
                    : 'Autosave siap';

    const SaveIcon = saveState === 'saving'
        ? CloudUpload
        : saveState === 'offline'
            ? CloudAlert
            : saveState === 'error'
                ? CloudAlert
                : Cloud;

    const renderQuestionPalette = (isDrawer = false) => (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Daftar Soal</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                    {answeredCount}/{questions.length} Selesai
                </span>
            </div>

            {/* Status Legend */}
            <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground border-y border-black/5 py-2.5">
                <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>Yakin ({confidentAnsweredCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                    <span>Ragu ({flaggedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-slate-300 shrink-0" />
                    <span>Kosong ({unansweredCount})</span>
                </div>
            </div>

            {/* Question Buttons Grid */}
            <nav
                aria-label="Navigasi nomor soal"
                className={cn(
                    'grid grid-cols-5 gap-1.5 max-h-[50vh] overflow-y-auto p-0.5',
                    isDrawer && 'grid-cols-6 sm:grid-cols-8'
                )}
            >
                {questions.map((question, index) => {
                    const complete = isAnswerComplete(question, answers[question.id] || '');
                    const flagged = flaggedIds.has(question.id);
                    const active = index === currentIdx;

                    let buttonStyle = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300';
                    if (flagged) {
                        buttonStyle = 'bg-amber-50 text-amber-900 border-amber-300/80 hover:bg-amber-100/60 font-medium';
                    } else if (complete) {
                        buttonStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/60 font-medium';
                    }

                    return (
                        <button
                            key={question.id}
                            type="button"
                            onClick={() => {
                                setCurrentIdx(index);
                                if (isDrawer) setMobilePaletteOpen(false);
                            }}
                            className={cn(
                                'h-8.5 w-full rounded-lg border text-xs font-mono font-medium transition-all relative flex items-center justify-center',
                                buttonStyle,
                                active && 'ring-2 ring-slate-900 ring-offset-1 font-semibold text-foreground'
                            )}
                            aria-label={`Soal ${index + 1}${flagged ? ', ragu-ragu' : complete ? ', sudah dijawab' : ', belum dijawab'}`}
                        >
                            {index + 1}
                            {flagged && (
                                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500" />
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );

    return (
        <div className="min-h-dvh bg-muted/30 text-foreground pb-20 lg:pb-12">
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
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="truncate text-sm font-semibold sm:text-base">{examData.exam.title}</h1>
                            {(examData.attemptNumber > 1 || examData.exam.is_remedial_attempt) && (
                                <Badge variant="secondary" className="rounded-md text-[11px] font-normal border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                    Remedial (Percobaan ke-{examData.attemptNumber})
                                </Badge>
                            )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span>Soal {currentIdx + 1} dari {questions.length}</span>
                            <span aria-hidden="true">•</span>
                            <span className="text-emerald-700 font-medium">{answeredCount} dijawab</span>
                            {flaggedCount > 0 && (
                                <>
                                    <span aria-hidden="true">•</span>
                                    <span className="text-amber-700 font-medium">{flaggedCount} ragu-ragu</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Sync Status Badge */}
                    <div className={cn(
                        'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-normal border',
                        saveState === 'offline'
                            ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                            : saveState === 'error'
                                ? 'bg-red-50 text-red-700 border-red-200/80'
                                : saveState === 'saving'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200/80'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                    )}>
                        <SaveIcon className={cn('size-3.5', saveState === 'saving' && 'animate-spin')} />
                        <span>{saveLabel}</span>
                    </div>

                    {/* Timer Badge */}
                    <div className={cn(
                        'flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 font-mono text-sm font-medium tabular-nums shadow-2xs transition-colors',
                        criticalTime
                            ? 'border-destructive bg-destructive/10 text-destructive animate-pulse'
                            : warningTime
                                ? 'border-amber-300 bg-amber-50 text-amber-900'
                                : 'border-black/5 bg-background text-foreground',
                    )} aria-label={`Sisa waktu ${formatTime(timeLeft)}`}>
                        <Clock3 className={cn('size-3.5', criticalTime && 'text-destructive', warningTime && 'text-amber-600')} />
                        <span>{formatTime(timeLeft)}</span>
                    </div>
                </div>
                <Progress value={progressValue} className="gap-0 [&_[data-slot=progress-track]]:h-1 [&_[data-slot=progress-track]]:rounded-none" aria-label={`${answeredCount} dari ${questions.length} soal dijawab`} />
            </header>

            <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:py-7 xl:pr-44">
                {/* Desktop Question Palette Sidebar */}
                <aside className="hidden lg:block min-w-0 lg:sticky lg:top-24 lg:self-start">
                    <div className="rounded-xl border border-black/5 bg-background p-4 shadow-2xs space-y-3">
                        {renderQuestionPalette(false)}

                        <div className={cn(
                            'flex items-center gap-2 border-t pt-3 text-xs',
                            saveState === 'offline'
                                ? 'text-amber-700 font-medium'
                                : saveState === 'error'
                                    ? 'text-destructive font-medium'
                                    : 'text-muted-foreground'
                        )} aria-live="polite">
                            <SaveIcon className={cn('size-3.5', saveState === 'saving' && 'animate-spin')} />
                            <span className="truncate">{saveLabel}</span>
                        </div>
                    </div>
                </aside>

                {/* Main Question & Answer Section */}
                <section className="min-w-0 space-y-4">
                    <Card className="rounded-xl border-black/5 shadow-2xs overflow-hidden">
                        <CardHeader className="border-b bg-slate-50/40 p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-xs font-medium">
                                        Soal {currentIdx + 1}
                                    </Badge>
                                    <span className="text-xs font-normal text-muted-foreground">{currentQuestion.points} Poin</span>
                                </div>

                                {/* Toggle Ragu-Ragu Button */}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleFlag(currentQuestion.id)}
                                    className={cn(
                                        'h-8 gap-1.5 px-3 text-xs font-medium rounded-lg transition-colors shadow-2xs',
                                        isCurrentFlagged
                                            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70'
                                            : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                                    )}
                                >
                                    <Flag className={cn('size-3.5', isCurrentFlagged ? 'text-amber-600 fill-amber-500' : 'text-slate-400')} />
                                    <span>{isCurrentFlagged ? 'Ragu-Ragu' : 'Tandai Ragu'}</span>
                                </Button>
                            </div>

                            <CardTitle className="whitespace-pre-wrap break-words text-base font-medium leading-relaxed sm:text-lg pt-2 text-foreground">
                                {currentQuestion.question_text}
                            </CardTitle>

                            {currentQuestion.question_image && (
                                <img
                                    src={currentQuestion.question_image}
                                    alt="Gambar soal"
                                    className="max-h-80 max-w-full rounded-lg border object-contain mt-3"
                                />
                            )}
                        </CardHeader>

                        <CardContent className="p-4 sm:p-6">
                            <AnswerEditor
                                question={currentQuestion}
                                value={answers[currentQuestion.id] || ''}
                                onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                            />
                        </CardContent>
                    </Card>
                </section>
            </main>

            {/* Mobile Bottom Sticky Navigation Bar */}
            <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 shadow-2xs">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-6 xl:pr-44">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentIdx === 0 || submitting}
                        onClick={() => setCurrentIdx((index) => Math.max(0, index - 1))}
                        className="h-8.5 px-3 text-xs font-medium rounded-lg text-slate-700"
                    >
                        <ArrowLeft className="size-3.5 mr-1" />
                        <span className="hidden sm:inline">Sebelumnya</span>
                    </Button>

                    {/* Mobile Center Palette Button */}
                    <div className="flex lg:hidden items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setMobilePaletteOpen(true)}
                            className="h-8.5 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/70 rounded-lg flex items-center gap-1.5 transition-colors border border-black/5"
                        >
                            <Layers className="size-3.5 text-slate-500" />
                            <span>Daftar Soal</span>
                            <span className="font-mono text-[11px] text-slate-600">
                                {currentIdx + 1}/{questions.length}
                            </span>
                            {flaggedCount > 0 && (
                                <span className="size-1.5 rounded-full bg-amber-500" />
                            )}
                        </button>
                    </div>

                    {currentIdx < questions.length - 1 ? (
                        <Button
                            type="button"
                            size="sm"
                            disabled={submitting}
                            onClick={() => setCurrentIdx((index) => Math.min(questions.length - 1, index + 1))}
                            className="h-8.5 px-3 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-2xs"
                        >
                            <span className="hidden sm:inline mr-1">Selanjutnya</span>
                            <ArrowRight className="size-3.5" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            disabled={submitting}
                            onClick={() => setConfirmOpen(true)}
                            className="h-8.5 px-4 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                        >
                            {submitting ? (
                                <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            ) : (
                                <Send className="size-3.5 mr-1.5" />
                            )}
                            Kirim Ujian
                        </Button>
                    )}
                </div>
            </footer>

            {/* Mobile Slide-Up Question Palette Bottom Sheet */}
            {mobilePaletteOpen && (
                <ClientPortal>
                    <div 
                        className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150 lg:hidden"
                        onClick={() => setMobilePaletteOpen(false)}
                    >
                        <div 
                            className="w-full bg-white rounded-t-2xl border-t border-black/10 p-5 space-y-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-black/5 pb-3">
                                <h3 className="text-sm font-semibold text-foreground">Daftar Nomor Soal</h3>
                                <button
                                    type="button"
                                    onClick={() => setMobilePaletteOpen(false)}
                                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>

                            {renderQuestionPalette(true)}

                            <div className="pt-2 border-t border-black/5 flex justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setMobilePaletteOpen(false)}
                                    className="w-full sm:w-auto text-xs font-medium rounded-lg"
                                >
                                    Tutup
                                </Button>
                            </div>
                        </div>
                    </div>
                </ClientPortal>
            )}

            {/* Submission Checklist Breakdown Modal */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="max-w-md rounded-2xl p-5 sm:p-6 space-y-4 bg-white border border-black/10 shadow-xl">
                    <AlertDialogHeader>
                        <AlertDialogMedia>
                            {unansweredCount > 0 ? (
                                <AlertCircle className="size-8 text-amber-600" />
                            ) : (
                                <CheckCircle2 className="size-8 text-emerald-600" />
                            )}
                        </AlertDialogMedia>
                        <AlertDialogTitle className="text-base font-semibold text-foreground">
                            Konfirmasi Pengumpulan Ujian
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            {unansweredCount > 0 || flaggedCount > 0
                                ? 'Periksa kembali status pengerjaan soal Anda sebelum mengirimkan secara final. Jawaban tidak dapat diubah setelah dikirim.'
                                : 'Seluruh soal telah dijawab dengan yakin. Jawaban tidak dapat diubah setelah dikirim.'}
                        </AlertDialogDescription>

                        {/* Stats Breakdown Grid */}
                        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-black/5 text-center w-full">
                            <div className="p-2.5 rounded-lg bg-white border border-black/5">
                                <span className="text-[11px] block text-muted-foreground font-medium">Yakin</span>
                                <span className="text-sm font-semibold font-mono text-emerald-700">{confidentAnsweredCount}</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white border border-black/5">
                                <span className="text-[11px] block text-muted-foreground font-medium">Ragu</span>
                                <span className="text-sm font-semibold font-mono text-amber-700">{flaggedCount}</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white border border-black/5">
                                <span className="text-[11px] block text-muted-foreground font-medium">Kosong</span>
                                <span className="text-sm font-semibold font-mono text-slate-600">{unansweredCount}</span>
                            </div>
                        </div>

                        {/* Direct Jump List for Incomplete/Flagged Questions */}
                        {uncompletedOrFlaggedList.length > 0 && (
                            <div className="space-y-1.5 pt-1 text-left w-full">
                                <span className="text-[11px] font-medium text-muted-foreground block">
                                    Perlu ditinjau kembali (klik nomor untuk melompat):
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto p-1.5 bg-slate-50/60 rounded-lg border border-black/5">
                                    {uncompletedOrFlaggedList.map((item) => (
                                        <button
                                            key={item.question.id}
                                            type="button"
                                            onClick={() => {
                                                setCurrentIdx(item.index);
                                                setConfirmOpen(false);
                                            }}
                                            className={cn(
                                                'px-2 py-1 rounded-md text-[11px] font-mono font-medium border transition-colors',
                                                item.isFlagged
                                                    ? 'bg-amber-50 text-amber-900 border-amber-200/80 hover:bg-amber-100/70'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            )}
                                        >
                                            {item.isFlagged && <Flag className="size-2.5 text-amber-600 fill-amber-500 inline mr-1" />}
                                            Soal {item.index + 1}
                                            {!item.isFlagged && <span className="text-slate-400 ml-1">(Kosong)</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </AlertDialogHeader>

                    <AlertDialogFooter className="gap-2 pt-2 border-t border-black/5">
                        <AlertDialogCancel disabled={submitting} className="rounded-xl text-xs font-medium">
                            Periksa Lagi
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={submitting}
                            onClick={submitExam}
                            className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-2xs"
                        >
                            {submitting ? 'Mengirim...' : 'Kirim Jawaban'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

