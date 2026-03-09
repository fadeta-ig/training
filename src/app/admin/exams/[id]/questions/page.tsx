'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    HelpCircleIcon,
    ArrowLeft01Icon,
    PlusSignIcon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon
} from 'hugeicons-react';
import Link from 'next/link';

type Question = {
    id: string;
    question_text: string;
    options_json: any;
    correct_option_index: number;
    created_at: string;
};

export default function QuestionBankPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newQuestion, setNewQuestion] = useState({
        question_text: '',
        options: ['', '', '', ''],
        correct_option_index: 0
    });
    const [isSaving, setIsSaving] = useState(false);

    const fetchQuestions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/questions?examId=${resolvedParams.id}`);
            if (!res.ok) throw new Error('Failed to fetch questions');
            const result = await res.json();
            if (result.success) {
                setQuestions(result.data);
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, [resolvedParams.id]);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...newQuestion.options];
        newOptions[index] = value;
        setNewQuestion({ ...newQuestion, options: newOptions });
    };

    const handleSaveQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const res = await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exam_id: resolvedParams.id,
                    ...newQuestion
                })
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            setIsModalOpen(false);
            setNewQuestion({ question_text: '', options: ['', '', '', ''], correct_option_index: 0 });
            fetchQuestions();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteQuestion = async (id: string) => {
        if (!confirm('Delete this question permanently?')) return;
        try {
            const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            fetchQuestions();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-8 max-w-5xl">
            <div className="flex items-center justify-between border-b border-black/5 pb-6">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/exams"
                        className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                    >
                        <ArrowLeft01Icon size={20} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                            <HelpCircleIcon size={28} className="text-muted-foreground" />
                            Question Bank
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Manage the questions for this specific exam.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={fetchQuestions}
                        className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-white border border-black/10 hover:bg-black/5 flex items-center gap-2 shadow-sm"
                    >
                        <RefreshIcon size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 flex items-center gap-2 shadow-sm"
                    >
                        <PlusSignIcon size={18} />
                        Add Question
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                {isLoading ? (
                    <div className="p-10 text-center text-muted-foreground glass-card">Loading questions...</div>
                ) : questions.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground glass-card">No questions found for this exam. Click "Add Question".</div>
                ) : (
                    questions.map((q, idx) => (
                        <div key={q.id} className="glass-card p-6 flex flex-col gap-4 group relative">
                            <button
                                onClick={() => deleteQuestion(q.id)}
                                className="absolute top-4 right-4 p-2 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Delete02Icon size={18} />
                            </button>

                            <div className="flex gap-3 pr-10">
                                <span className="font-bold text-lg text-muted-foreground">{idx + 1}.</span>
                                <h3 className="font-semibold text-lg">{q.question_text}</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8">
                                {(typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json).map((opt: string, i: number) => (
                                    <div key={i} className={`p-3 rounded-xl border text-sm ${q.correct_option_index === i ? 'bg-black/5 border-foreground/50 font-semibold' : 'bg-white/50 border-black/5 text-muted-foreground'}`}>
                                        <span className="mr-3 font-mono opacity-50">{String.fromCharCode(65 + i)}.</span>
                                        {opt}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Simple Modal overlay for Adding Question */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm px-4">
                    <div className="glass-card w-full max-w-2xl bg-white p-8 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-6">New Multiple Choice Question</h2>

                        <form onSubmit={handleSaveQuestion} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold">Question Text</label>
                                <textarea
                                    required
                                    rows={3}
                                    className="w-full glass-input px-4 py-3 rounded-xl text-sm"
                                    value={newQuestion.question_text}
                                    onChange={e => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold">Options & Correct Answer</label>
                                {newQuestion.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="correct_answer"
                                            checked={newQuestion.correct_option_index === idx}
                                            onChange={() => setNewQuestion({ ...newQuestion, correct_option_index: idx })}
                                            className="w-5 h-5 accent-foreground"
                                        />
                                        <input
                                            type="text"
                                            required
                                            placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                            className={`flex-1 glass-input px-4 py-2.5 rounded-xl text-sm ${newQuestion.correct_option_index === idx ? 'border-foreground/50 bg-black/5' : ''}`}
                                            value={opt}
                                            onChange={e => handleOptionChange(idx, e.target.value)}
                                        />
                                    </div>
                                ))}
                                <p className="text-xs text-muted-foreground mt-2">Select the radio button next to the correct option.</p>
                            </div>

                            <div className="pt-6 flex justify-end gap-3 border-t border-black/5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-semibold rounded-xl hover:bg-black/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Question'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
