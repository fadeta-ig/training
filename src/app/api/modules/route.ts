import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';

const itemSchema = z.object({
    item_type: z.enum(['training', 'exam']),
    item_id: z.string().uuid(),
    sequence_order: z.number().int().min(1),
});

const moduleSchema = z.object({
    title: z.string().min(3).max(150),
    description: z.string().optional(),
    items: z.array(itemSchema).min(1, 'Module must have at least one item'),
});

export async function GET() {
    try {
        const modules = await executeQuery(`SELECT id, title, description, created_at FROM modules ORDER BY created_at DESC`);
        return NextResponse.json({ success: true, data: modules });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const parsed = moduleSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { title, description, items } = parsed.data;
        const moduleId = uuidv4();

        // Use transaction since we are inserting into modules and module_items
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            `INSERT INTO modules (id, title, description) VALUES (?, ?, ?)`,
            [moduleId, title, description || null]
        );

        for (const item of items) {
            const itemId = uuidv4();
            await connection.execute(
                `INSERT INTO module_items (id, module_id, item_type, item_id, sequence_order) VALUES (?, ?, ?, ?, ?)`,
                [itemId, moduleId, item.item_type, item.item_id, item.sequence_order]
            );
        }

        await connection.commit();
        connection.release();

        return NextResponse.json({ success: true, id: moduleId, message: 'Module created with items' }, { status: 201 });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
