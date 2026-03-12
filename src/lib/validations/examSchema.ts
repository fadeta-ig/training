import { z } from 'zod';

export const examSchema = z.object({
    title: z.string().min(3, 'Judul ujian minimal 3 karakter').max(255, 'Judul ujian terlalu panjang'),
    duration_minutes: z.number().int().min(1, 'Durasi ujian minimal 1 menit'),
    passing_grade: z.number().int().min(0, 'Passing grade minimal 0').max(100, 'Passing grade maksimal 100'),
    allow_remedial: z.boolean().default(false).optional(),
    max_attempts: z.number().int().min(1, 'Maksimal percobaan minimal 1').default(1).optional(),
});

export type ExamInput = z.infer<typeof examSchema>;
