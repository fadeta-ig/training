import { z } from 'zod';
import { isSafePublicUrl } from '@/lib/sanitize';

/** Supported question types for the modular bank soal */
const QUESTION_TYPES = [
    'multiple_choice',
    'multiple_select',
    'true_false',
    'short_answer',
    'essay',
    'matching',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

const optionSchema = z.object({
    text: z.string().trim().min(1, 'Teks opsi wajib diisi'),
    image: z.string()
        .nullable()
        .optional()
        .refine((value) => !value || isSafePublicUrl(value), 'URL gambar opsi tidak aman atau tidak valid'),
});

const matchingPairSchema = z.object({
    left: z.string().trim().min(1, 'Item pasangan wajib diisi'),
    right: z.string().trim().min(1, 'Jawaban pasangan wajib diisi'),
});

export const questionSchema = z.object({
    exam_id: z.string().uuid('ID Ujian tidak valid'),
    question_type: z.enum(QUESTION_TYPES, { message: 'Tipe soal tidak valid' }),
    question_text: z.string().trim().min(3, 'Teks pertanyaan minimal 3 karakter'),
    question_image: z.string()
        .nullable()
        .optional()
        .refine((value) => !value || isSafePublicUrl(value), 'URL gambar soal tidak aman atau tidak valid'),
    options: z.array(optionSchema).optional(),
    correct_option_index: z.number().int().min(0).optional(),
    correct_option_indices: z.array(z.number().int().min(0)).optional(),
    correct_answer: z.string().trim().optional(),
    matching_pairs: z.array(matchingPairSchema).optional(),
    points: z.number().int().min(1).max(100, 'Bobot poin maksimal 100').default(1),
}).superRefine((data, ctx) => {
    const t = data.question_type;

    if (t === 'multiple_choice') {
        if (!data.options || data.options.length < 2) {
            ctx.addIssue({ code: 'custom', path: ['options'], message: 'Pilihan ganda membutuhkan minimal 2 opsi' });
        }
        if (data.correct_option_index === undefined || data.correct_option_index === null) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Jawaban benar wajib dipilih' });
        } else if (data.options && data.correct_option_index >= data.options.length) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Index jawaban benar melebihi jumlah opsi' });
        }
    }

    if (t === 'multiple_select') {
        if (!data.options || data.options.length < 2) {
            ctx.addIssue({ code: 'custom', path: ['options'], message: 'Multi-jawaban membutuhkan minimal 2 opsi' });
        }
        if (!data.correct_option_indices || data.correct_option_indices.length === 0) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_indices'], message: 'Minimal 1 jawaban benar wajib dipilih' });
        } else {
            const uniqueIndices = new Set(data.correct_option_indices);
            if (uniqueIndices.size !== data.correct_option_indices.length) {
                ctx.addIssue({ code: 'custom', path: ['correct_option_indices'], message: 'Jawaban benar tidak boleh duplikat' });
            }
            if (data.options && data.correct_option_indices.some((index) => index >= data.options!.length)) {
                ctx.addIssue({ code: 'custom', path: ['correct_option_indices'], message: 'Index jawaban benar melebihi jumlah opsi' });
            }
        }
    }

    if (t === 'true_false') {
        if (data.correct_option_index === undefined || data.correct_option_index === null) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Jawaban benar wajib dipilih (0=Benar, 1=Salah)' });
        } else if (data.correct_option_index > 1) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Jawaban Benar/Salah hanya menerima nilai 0 atau 1' });
        }
    }

    if (t === 'short_answer') {
        if (!data.correct_answer || data.correct_answer.trim().length === 0) {
            ctx.addIssue({ code: 'custom', path: ['correct_answer'], message: 'Kunci jawaban singkat wajib diisi' });
        }
    }

    if (t === 'matching') {
        if (!data.matching_pairs || data.matching_pairs.length < 2) {
            ctx.addIssue({ code: 'custom', path: ['matching_pairs'], message: 'Menjodohkan membutuhkan minimal 2 pasangan' });
        } else {
            const normalizedLefts = data.matching_pairs.map((pair) => pair.left.toLocaleLowerCase('id-ID'));
            const normalizedRights = data.matching_pairs.map((pair) => pair.right.toLocaleLowerCase('id-ID'));
            if (new Set(normalizedLefts).size !== normalizedLefts.length) {
                ctx.addIssue({ code: 'custom', path: ['matching_pairs'], message: 'Item sisi kiri tidak boleh duplikat' });
            }
            if (new Set(normalizedRights).size !== normalizedRights.length) {
                ctx.addIssue({ code: 'custom', path: ['matching_pairs'], message: 'Jawaban pasangan tidak boleh duplikat' });
            }
        }
    }

    // 'essay' has no specific validation — graded manually
});

export type QuestionInput = z.infer<typeof questionSchema>;
