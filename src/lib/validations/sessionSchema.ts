import { z } from 'zod';

export const sessionSchema = z.object({
    module_id: z.string().uuid('Module ID tidak valid'),
    title: z.string().min(3, 'Judul minimal 3 karakter').max(150),
    start_time: z.string().min(1, 'Waktu mulai wajib diisi'),
    end_time: z.string().min(1, 'Waktu selesai wajib diisi'),
    require_seb: z.boolean().default(false),
    show_score: z.boolean().default(true),
    participant_ids: z.array(z.string().uuid()).optional(),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
    message: "Waktu selesai harus lebih besar dari waktu mulai",
    path: ["end_time"],
});
