import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeQuery } from '@/lib/db';

const itemSchema = z.object({
    item_type: z.enum(['training', 'exam']),
    item_id: z.string().uuid(),
    sequence_order: z.number().int().min(1),
});

const updateModuleSchema = z.object({
    title: z.string().min(3).max(150),
    description: z.string().optional(),
    items: z.array(itemSchema).min(1, 'Modul harus memiliki setidaknya satu item'),
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const result = await executeQuery<any[]>(
            `SELECT * FROM modules WHERE id = ?`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
        }

        const items = await executeQuery<any[]>(
            `SELECT * FROM module_items WHERE module_id = ? ORDER BY sequence_order ASC`,
            [resolvedParams.id]
        );

        return NextResponse.json({ success: true, data: { ...result[0], items } });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const body = await request.json();
        const parsed = updateModuleSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { title, description, items } = parsed.data;

        // Start Transaction
        const connection = await require('@/lib/db').default.getConnection();
        await connection.beginTransaction();

        try {
            await connection.execute(
                `UPDATE modules SET title = ?, description = ? WHERE id = ?`,
                [title, description || null, resolvedParams.id]
            );

            // Replace all items
            await connection.execute(`DELETE FROM module_items WHERE module_id = ?`, [resolvedParams.id]);

            for (const item of items) {
                const itemId = require('uuid').v4();
                await connection.execute(
                    `INSERT INTO module_items (id, module_id, item_type, item_id, sequence_order) VALUES (?, ?, ?, ?, ?)`,
                    [itemId, resolvedParams.id, item.item_type, item.item_id, item.sequence_order]
                );
            }

            await connection.commit();
            connection.release();
            return NextResponse.json({ success: true, message: 'Module updated successfully' });
        } catch (txnError) {
            await connection.rollback();
            connection.release();
            throw txnError;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;

        // ON DELETE CASCADE will handle module_items and sessions
        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM modules WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Module deleted' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
