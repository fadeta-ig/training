import { z } from 'zod';

export const moduleSchema = z.object({
    category_id: z.string().uuid('Kategori harus berupa UUID yang valid').optional().nullable(),
    title: z.string().trim().min(3, 'Judul modul minimal 3 karakter').max(150, 'Judul modul maksimal 150 karakter'),
    description: z.string().optional(),
    enforce_sequence: z.boolean().optional().default(false),
    items: z.array(
        z.object({
            item_type: z.enum(['training', 'exam']),
            item_id: z.string().uuid('Item ID harus berupa UUID yang valid'),
            sequence_order: z.number().int().min(1)
        })
    ).max(500, 'Maksimal 500 item dalam satu modul').optional().default([])
}).superRefine((value, context) => {
    const itemKeys = new Set<string>();
    const sequenceOrders = new Set<number>();

    value.items.forEach((item, index) => {
        const key = `${item.item_type}:${item.item_id}`;
        if (itemKeys.has(key)) {
            context.addIssue({
                code: 'custom',
                path: ['items', index, 'item_id'],
                message: 'Item yang sama tidak boleh ditambahkan lebih dari satu kali',
            });
        }
        if (sequenceOrders.has(item.sequence_order)) {
            context.addIssue({
                code: 'custom',
                path: ['items', index, 'sequence_order'],
                message: 'Urutan item harus unik dalam modul',
            });
        }
        itemKeys.add(key);
        sequenceOrders.add(item.sequence_order);
    });
});

export type ModuleInput = z.infer<typeof moduleSchema>;
