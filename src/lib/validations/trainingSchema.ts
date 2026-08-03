import { z } from 'zod';
import { isSafePublicUrl, sanitizeRichHtml } from '@/lib/sanitize';

/** Schema for a single media attachment item */
export const mediaItemSchema = z.object({
    media_type: z.enum(['video', 'image', 'pdf', 'document']),
    media_url: z.string()
        .min(1, 'URL media tidak boleh kosong')
        .refine(isSafePublicUrl, 'URL media tidak aman atau tidak valid'),
    original_filename: z.string().max(255).optional().default(''),
});

export const trainingSchema = z.object({
    title: z.string().min(3, 'Judul materi pelatihan minimal 3 karakter').max(255, 'Judul materi terlalu panjang'),
    content_html: z.string()
        .min(1, 'Konten materi tidak boleh kosong')
        .transform((value) => sanitizeRichHtml(value))
        .refine((value) => value.trim().length > 0, 'Konten materi tidak boleh kosong setelah sanitasi'),
    media: z.array(mediaItemSchema).optional().default([]),
});

export type MediaItemInput = z.infer<typeof mediaItemSchema>;
export type TrainingInput = z.infer<typeof trainingSchema>;
