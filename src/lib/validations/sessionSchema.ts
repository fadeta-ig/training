import { z } from 'zod';

export const sessionSchema = z.object({
    module_id: z.string().uuid('Module ID tidak valid'),
    title: z.string().min(3, 'Judul minimal 3 karakter').max(150),
    start_time: z.string().datetime('Format waktu mulai tidak valid'),
    end_time: z.string().datetime('Format waktu selesai tidak valid'),
    require_seb: z.boolean().default(false),
    participant_ids: z.array(z.string().uuid()).optional(),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
    message: "Waktu selesai harus lebih besar dari waktu mulai",
    path: ["end_time"], // Menunjukkan error ada di field ini
});
