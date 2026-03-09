import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeQuery } from '@/lib/db';

const updateQuestionSchema = z.object({
    question_text: z.string().min(5, 'Question text is required'),
    options: z.array(z.string()).min(2, 'At least 2 options are required').max(10),
    correct_option_index: z.number().int().min(0, 'Invalid option index')
}).refine(data => data.correct_option_index < data.options.length, {
    message: 'Correct option index must be within the options bounds',
    path: ['correct_option_index']
});

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // Await the entire params object for Next 15 dynamically
) {
    try {
        const resolvedParams = await params;
        const body = await request.json();
        const parsed = updateQuestionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { question_text, options, correct_option_index } = parsed.data;
        const optionsJson = JSON.stringify(options);

        const result = await executeQuery<{ affectedRows: number }>(
            `UPDATE questions SET question_text = ?, options_json = ?, correct_option_index = ? WHERE id = ?`,
            [question_text, optionsJson, correct_option_index, resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Question updated successfully' });
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

        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM questions WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Question deleted successfully' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
