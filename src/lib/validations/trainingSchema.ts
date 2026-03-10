import { z } from 'zod';

export const trainingSchema = z.object({
    title: z.string().min(3, 'Judul materi pelatihan minimal 3 karakter').max(255, 'Judul materi terlalu panjang'),
    content_html: z.string().min(1, 'Konten materi tidak boleh kosong'),
    video_url: z.string().url('Format URL video tidak valid').optional().or(z.literal('')),
});

export type TrainingInput = z.infer<typeof trainingSchema>;
