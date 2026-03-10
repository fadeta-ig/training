import { z } from 'zod';

export const moduleSchema = z.object({
    title: z.string().min(3, 'Judul modul minimal 3 karakter').max(255, 'Judul modul terlalu panjang'),
    description: z.string().optional(),
    items: z.array(
        z.object({
            item_type: z.enum(['training', 'exam']),
            item_id: z.string().min(1, 'Item ID harus valid'),
            sequence_order: z.number().int().min(1)
        })
    ).optional().default([])
});

export type ModuleInput = z.infer<typeof moduleSchema>;
