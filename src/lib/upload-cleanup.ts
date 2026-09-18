import { promises as fs } from 'fs';
import path from 'path';
import { executeQuery } from '@/lib/db';
import logger from '@/lib/logger';

function resolveLocalUpload(mediaUrl: string): string | null {
    if (!mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('/uploads/proctor/')) return null;
    const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
    const relative = mediaUrl.slice('/uploads/'.length);
    const target = path.resolve(uploadsRoot, relative);
    if (!target.startsWith(`${uploadsRoot}${path.sep}`)) return null;
    return target;
}

/** Delete local uploads only after every known database reference is gone. */
export async function cleanupUnusedUploads(mediaUrls: string[]): Promise<void> {
    for (const mediaUrl of [...new Set(mediaUrls)]) {
        const target = resolveLocalUpload(mediaUrl);
        if (!target) continue;
        try {
            const rows = await executeQuery<Array<{ total: number | string }>>(
                `SELECT (
                    (SELECT COUNT(*) FROM training_media WHERE media_url = ?)
                    + (SELECT COUNT(*) FROM questions WHERE question_image = ?)
                    + (SELECT COUNT(*) FROM session_participants WHERE certificate_file_url = ?)
                    + (SELECT COUNT(*) FROM trainings WHERE content_html LIKE CONCAT('%', ?, '%'))
                    + (SELECT COUNT(*) FROM questions WHERE question_text LIKE CONCAT('%', ?, '%'))
                    + (SELECT COUNT(*) FROM questions WHERE CAST(options_json AS CHAR) LIKE CONCAT('%', ?, '%'))
                    + (SELECT COUNT(*) FROM exam_answers WHERE question_snapshot LIKE CONCAT('%', ?, '%'))
                    + (SELECT COUNT(*) FROM question_import_batches WHERE payload_json LIKE CONCAT('%', ?, '%'))
                ) AS total`,
                [mediaUrl, mediaUrl, mediaUrl, mediaUrl, mediaUrl, mediaUrl, mediaUrl, mediaUrl],
            );
            if (Number(rows[0]?.total || 0) === 0) {
                await fs.unlink(target).catch((error: NodeJS.ErrnoException) => {
                    if (error.code !== 'ENOENT') throw error;
                });
            }
        } catch (error) {
            logger.warn('UPLOAD_CLEANUP', 'Gagal membersihkan upload yang tidak lagi digunakan', {
                mediaUrl,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
