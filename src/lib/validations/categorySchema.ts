import { z } from 'zod';

export const categorySchema = z.object({
    name: z.string().trim().min(3, 'Nama kategori minimal 3 karakter').max(150, 'Nama kategori maksimal 150 karakter'),
    code: z
        .string()
        .trim()
        .min(2, 'Kode kategori minimal 2 karakter')
        .max(50, 'Kode kategori maksimal 50 karakter')
        .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya boleh berisi huruf, angka, tanda hubung (-), dan garis bawah (_)')
        .transform((val) => val.toUpperCase()),
    description: z.string().trim().max(1000, 'Deskripsi maksimal 1000 karakter').optional().nullable(),
    color: z
        .string()
        .trim()
        .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Format warna harus hex yang valid (contoh: #0ea5e9)')
        .default('#0ea5e9'),
    is_active: z.boolean().default(true),
    trainer_ids: z.array(z.string().trim().max(50, 'ID trainer tidak valid')).optional().default([]),
});

export const assignTrainersSchema = z.object({
    trainer_ids: z.array(z.string().trim().max(50, 'ID trainer tidak valid')),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type AssignTrainersInput = z.infer<typeof assignTrainersSchema>;
