import type { PoolConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface ModuleItemInput {
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
}

interface ExistingModuleItem extends ModuleItemInput {
    id: string;
}

function itemKey(item: Pick<ModuleItemInput, 'item_type' | 'item_id'>): string {
    return `${item.item_type}:${item.item_id}`;
}

export async function assertModuleItemReferences(
    connection: PoolConnection,
    items: ModuleItemInput[],
): Promise<void> {
    const trainingIds = items.filter((item) => item.item_type === 'training').map((item) => item.item_id);
    const examIds = items.filter((item) => item.item_type === 'exam').map((item) => item.item_id);

    const verify = async (table: 'trainings' | 'exams', ids: string[]) => {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await connection.execute<Array<{ id: string }> & any[]>(
            `SELECT id FROM ${table} WHERE id IN (${placeholders})`,
            ids,
        );
        const found = new Set(rows.map((row) => String(row.id)));
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length > 0) {
            throw new ModuleItemsError(`Referensi ${table === 'exams' ? 'ujian' : 'materi'} tidak ditemukan: ${missing.join(', ')}`);
        }
    };

    await verify('trainings', trainingIds);
    await verify('exams', examIds);
}

/** Synchronize module items while retaining IDs so learner progress remains attached. */
export async function synchronizeModuleItems(
    connection: PoolConnection,
    moduleId: string,
    requestedItems: ModuleItemInput[],
): Promise<void> {
    await assertModuleItemReferences(connection, requestedItems);

    const [existingRows] = await connection.execute<ExistingModuleItem[] & any[]>(
        `SELECT id, item_type, item_id, sequence_order
         FROM module_items
         WHERE module_id = ?
         FOR UPDATE`,
        [moduleId],
    );
    const existingByKey = new Map(existingRows.map((item) => [itemKey(item), item]));
    const requestedKeys = new Set(requestedItems.map(itemKey));
    const removedItems = existingRows.filter((item) => !requestedKeys.has(itemKey(item)));

    if (removedItems.length > 0) {
        const placeholders = removedItems.map(() => '?').join(',');
        const [usageRows] = await connection.execute<Array<{ module_item_id: string; total: number | string }> & any[]>(
            `SELECT module_item_id, COUNT(*) AS total
             FROM user_progress
             WHERE module_item_id IN (${placeholders})
             GROUP BY module_item_id`,
            removedItems.map((item) => item.id),
        );
        if (usageRows.some((row) => Number(row.total) > 0)) {
            throw new ModuleItemsError(
                'Item modul yang sudah memiliki progres peserta tidak dapat dihapus. Duplikasi modul untuk membuat susunan baru.',
            );
        }
    }

    // Move existing rows out of the requested sequence range first so unique-order
    // constraints can be enabled safely without transient collisions.
    if (existingRows.length > 0) {
        await connection.execute(
            'UPDATE module_items SET sequence_order = sequence_order + 1000000 WHERE module_id = ?',
            [moduleId],
        );
    }

    for (const item of requestedItems) {
        const existing = existingByKey.get(itemKey(item));
        if (existing) {
            await connection.execute(
                'UPDATE module_items SET sequence_order = ? WHERE id = ?',
                [item.sequence_order, existing.id],
            );
        } else {
            await connection.execute(
                `INSERT INTO module_items (id, module_id, item_type, item_id, sequence_order)
                 VALUES (?, ?, ?, ?, ?)`,
                [uuidv4(), moduleId, item.item_type, item.item_id, item.sequence_order],
            );
        }
    }

    if (removedItems.length > 0) {
        const placeholders = removedItems.map(() => '?').join(',');
        await connection.execute(
            `DELETE FROM module_items WHERE id IN (${placeholders})`,
            removedItems.map((item) => item.id),
        );
    }
}

export class ModuleItemsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ModuleItemsError';
    }
}
