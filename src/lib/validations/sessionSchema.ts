import { z } from 'zod';

export const sessionSchema = z.object({
    module_id: z.string().uuid('Module ID tidak valid'),
    title: z.string().min(3, 'Judul minimal 3 karakter').max(150),
    start_time: z.string().min(1, 'Waktu mulai wajib diisi'),
    end_time: z.string().min(1, 'Waktu selesai wajib diisi'),
    session_type: z.enum(['regular', 'remedial']).default('regular'),
    parent_session_id: z.string().uuid('Sesi induk tidak valid').nullable().optional(),
    remedial_cycle: z.number().int().min(0).max(20).default(0),
    require_seb: z.boolean().default(false),
    show_score: z.boolean().default(false),
    enable_proctoring: z.boolean().default(true),
    participant_ids: z.array(z.string().uuid()).optional(),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
    message: "Waktu selesai harus lebih besar dari waktu mulai",
    path: ["end_time"],
}).refine(data => data.session_type !== 'remedial' || Boolean(data.parent_session_id), {
    message: 'Sesi remedial wajib memiliki sesi induk',
    path: ['parent_session_id'],
}).refine(data => data.session_type !== 'remedial' || data.remedial_cycle >= 1, {
    message: 'Siklus remedial minimal 1',
    path: ['remedial_cycle'],
});
