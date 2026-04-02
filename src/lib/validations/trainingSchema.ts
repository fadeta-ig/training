import { z } from 'zod';

/** Schema for a single media attachment item */
export const mediaItemSchema = z.object({
    media_type: z.enum(['video', 'image', 'pdf', 'document']),
    media_url: z.string().min(1, 'URL media tidak boleh kosong'),
    original_filename: z.string().max(255).optional().default(''),
});

export const trainingSchema = z.object({
    title: z.string().min(3, 'Judul materi pelatihan minimal 3 karakter').max(255, 'Judul materi terlalu panjang'),
    content_html: z.string().min(1, 'Konten materi tidak boleh kosong'),
    media: z.array(mediaItemSchema).optional().default([]),
});

export type MediaItemInput = z.infer<typeof mediaItemSchema>;
export type TrainingInput = z.infer<typeof trainingSchema>;
