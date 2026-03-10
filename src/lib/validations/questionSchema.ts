import { z } from 'zod';

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

export const questionSchema = z.object({
    exam_id: z.string().uuid('ID Ujian tidak valid'),
    question_type: z.enum(QUESTION_TYPES, { message: 'Tipe soal tidak valid' }),
    question_text: z.string().min(3, 'Teks pertanyaan minimal 3 karakter'),
    question_image: z.string().nullable().optional(),
    options: z.array(z.object({
        text: z.string(),
        image: z.string().nullable().optional(),
    })).optional(),
    correct_option_index: z.number().int().min(0).optional(),
    correct_option_indices: z.array(z.number().int().min(0)).optional(),
    correct_answer: z.string().optional(),
    matching_pairs: z.array(z.object({
        left: z.string(),
        right: z.string(),
    })).optional(),
    points: z.number().int().min(1).default(1),
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
        }
    }

    if (t === 'true_false') {
        if (data.correct_option_index === undefined || data.correct_option_index === null) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Jawaban benar wajib dipilih (0=Benar, 1=Salah)' });
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
        }
    }

    // 'essay' has no specific validation — graded manually
});

export type QuestionInput = z.infer<typeof questionSchema>;
