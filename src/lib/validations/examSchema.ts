import { z } from 'zod';

export const examSchema = z.object({
    category_id: z.string().trim().max(50, 'ID Kategori maksimal 50 karakter').nullable().optional().or(z.literal('')),
    title: z.string().trim().min(3, 'Judul ujian minimal 3 karakter').max(150, 'Judul ujian maksimal 150 karakter'),
    duration_minutes: z.coerce.number().int().min(1, 'Durasi ujian minimal 1 menit'),
    passing_grade: z.coerce.number().min(0, 'Passing grade minimal 0').max(100, 'Passing grade maksimal 100'),
    allow_remedial: z.boolean().default(false).optional(),
    max_attempts: z.coerce.number().int().min(1, 'Maksimal percobaan minimal 1').default(1).optional(),
    remedial_exam_id: z.string().trim().max(50, 'ID ujian remedial tidak valid').nullable().optional().or(z.literal('')),
});

export type ExamInput = z.infer<typeof examSchema>;
