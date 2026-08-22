'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
    PencilEdit02Icon,
    Delete02Icon,
    ViewIcon,
    ViewOffIcon,
    StarIcon,
} from 'hugeicons-react';
import { GripVertical } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
    attachClosestEdge,
    extractClosestEdge,
    type Edge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';

export type QuestionItemData = {
    id: string;
    question_type: string;
    question_text: string;
    question_image: string | null;
    options_json: any;
    correct_option_index: number | null;
    correct_answer: string | null;
    points: number;
    sequence_order?: number;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    multiple_choice: { label: 'Pilihan Ganda', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    multiple_select: { label: 'Multi-Jawaban', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    true_false: { label: 'Benar / Salah', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    short_answer: { label: 'Isian Singkat', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    essay: { label: 'Esai', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
    matching: { label: 'Menjodohkan', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
};

interface SortableQuestionItemProps {
    question: QuestionItemData;
    displayIndex: number;
    examId: string;
    isReorderMode: boolean;
    isExpanded: boolean;
    userRole: string;
    deleteConfirmId: string | null;
    onToggleExpand: (id: string) => void;
    onSetDeleteConfirm: (id: string | null) => void;
    onDelete: (id: string) => void;
    renderAnswerPreview: (q: QuestionItemData) => React.ReactNode;
}

export function SortableQuestionItem({
    question,
    displayIndex,
    examId,
    isReorderMode,
    isExpanded,
    userRole,
    deleteConfirmId,
    onToggleExpand,
    onSetDeleteConfirm,
    onDelete,
    renderAnswerPreview,
}: SortableQuestionItemProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const dragHandleRef = useRef<HTMLButtonElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    const conf = TYPE_CONFIG[question.question_type || 'multiple_choice'] || TYPE_CONFIG.multiple_choice;

    useEffect(() => {
        const cardEl = cardRef.current;
        const handleEl = dragHandleRef.current;
        if (!cardEl) return;

        const cleanups: Array<() => void> = [];

        if (isReorderMode && handleEl) {
            cleanups.push(
                draggable({
                    element: handleEl,
                    getInitialData: () => ({ questionId: question.id, index: displayIndex }),
                    onDragStart: () => setIsDragging(true),
                    onDrop: () => {
                        setIsDragging(false);
                        setClosestEdge(null);
                    },
                })
            );
        }

        if (isReorderMode) {
            cleanups.push(
                dropTargetForElements({
                    element: cardEl,
                    canDrop: ({ source }) => {
                        return source.data.questionId !== question.id;
                    },
                    getData: ({ input, element }) => {
                        const data = { questionId: question.id, index: displayIndex };
                        return attachClosestEdge(data, {
                            element,
                            input,
                            allowedEdges: ['top', 'bottom'],
                        });
                    },
                    onDragEnter: (args) => {
                        const edge = extractClosestEdge(args.self.data);
                        setClosestEdge(edge);
                    },
                    onDrag: (args) => {
                        const edge = extractClosestEdge(args.self.data);
                        setClosestEdge(edge);
                    },
                    onDragLeave: () => {
                        setClosestEdge(null);
                    },
                    onDrop: () => {
                        setClosestEdge(null);
                    },
                })
            );
        }

        return () => {
            cleanups.forEach((cleanup) => cleanup());
        };
    }, [isReorderMode, question.id, displayIndex]);

    return (
        <div ref={cardRef} className="relative transition-all duration-150">
            {/* Edge drop indicator lines */}
            {closestEdge === 'top' && (
                <div className="absolute -top-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-20 shadow-xs animate-pulse" />
            )}
            {closestEdge === 'bottom' && (
                <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-20 shadow-xs animate-pulse" />
            )}

            <GlassCard
                className={`overflow-hidden transition-all ${
                    isExpanded ? 'ring-1 ring-black/5' : ''
                } ${
                    isDragging
                        ? 'opacity-40 border-dashed border-blue-400 scale-[0.99] shadow-sm'
                        : closestEdge
                        ? 'ring-1 ring-blue-400/50 bg-blue-50/20'
                        : ''
                }`}
            >
                <div className="px-4 py-3 flex items-start gap-3">
                    {/* Drag handle in reorder mode */}
                    {isReorderMode && userRole === 'admin' && (
                        <button
                            ref={dragHandleRef}
                            type="button"
                            className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 mt-0.5 transition-colors touch-none"
                            title="Tahan dan geser untuk mengubah urutan"
                            aria-label={`Pindahkan soal nomor ${displayIndex}`}
                        >
                            <GripVertical className="size-4" />
                        </button>
                    )}

                    {/* Question number */}
                    <span className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center font-bold text-xs text-black/40 shrink-0 mt-0.5 tabular-nums">
                        {displayIndex}
                    </span>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${conf.bg} ${conf.color} ${conf.border} border`}
                            >
                                {conf.label}
                            </span>
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-medium">
                                <StarIcon size={10} /> {question.points || 1} poin
                            </span>
                        </div>
                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                            {question.question_text}
                        </p>
                        {question.question_image && (
                            <img
                                src={question.question_image}
                                alt="Gambar soal"
                                className="max-h-20 rounded-lg border border-black/10 mt-1.5 object-cover"
                            />
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => onToggleExpand(question.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                                isExpanded
                                    ? 'bg-black/5 text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                            }`}
                            title={isExpanded ? 'Tutup jawaban' : 'Lihat jawaban'}
                        >
                            {isExpanded ? <ViewOffIcon size={15} /> : <ViewIcon size={15} />}
                        </button>

                        {userRole === 'admin' && (
                            <>
                                <Link
                                    href={`/admin/exams/${examId}/questions/${question.id}/edit`}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                                    title="Edit Soal"
                                >
                                    <PencilEdit02Icon size={15} />
                                </Link>

                                {deleteConfirmId === question.id ? (
                                    <div className="flex items-center gap-1 bg-destructive/10 rounded-lg px-1.5 py-0.5 ml-0.5">
                                        <span className="text-[10px] text-destructive font-semibold">
                                            Hapus?
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(question.id)}
                                            className="px-1.5 py-0.5 bg-destructive text-white rounded text-[10px] font-bold"
                                        >
                                            Ya
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onSetDeleteConfirm(null)}
                                            className="px-1.5 py-0.5 bg-black/10 rounded text-[10px] font-bold"
                                        >
                                            Batal
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onSetDeleteConfirm(question.id)}
                                        className="p-1.5 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        title="Hapus Soal"
                                    >
                                        <Delete02Icon size={15} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div className="px-4 pb-3 pt-0 ml-11">
                        <div className="border-t border-black/5 pt-3">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
                                Jawaban
                            </p>
                            {renderAnswerPreview(question)}
                        </div>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
