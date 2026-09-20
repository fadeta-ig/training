import { executeQuery } from '@/lib/db';
import type { AuthenticatedUser } from '@/lib/api-auth';

export interface ScopeConstraint {
    isScoped: boolean;
    categoryIds: string[];
    sqlCondition: string;
    params: (string | number)[];
}

export interface AccessibleCategory {
    id: string;
    name: string;
    code: string;
    color: string;
}

/**
 * Mengambil daftar ID kategori aktif yang ditugaskan ke trainer.
 */
export async function getTrainerCategoryIds(trainerId: string): Promise<string[]> {
    const rows = await executeQuery<{ category_id: string }[]>(
        `SELECT ct.category_id 
         FROM category_trainers ct
         JOIN learning_categories lc ON ct.category_id = lc.id
         WHERE ct.trainer_id = ? AND lc.is_active = 1`,
        [trainerId]
    );
    return (rows || []).map((r) => r.category_id);
}

/**
 * Mengambil objek kategori yang dapat diakses oleh pengguna.
 * Jika Admin: mengembalikan semua kategori aktif.
 * Jika Trainer: hanya mengembalikan kategori aktif yang ditugaskan kepadanya.
 */
export async function getAccessibleCategories(user: AuthenticatedUser): Promise<AccessibleCategory[]> {
    if (user.role === 'admin') {
        return executeQuery<AccessibleCategory[]>(
            `SELECT id, name, code, color 
             FROM learning_categories 
             WHERE is_active = 1 
             ORDER BY name ASC`
        );
    }

    if (user.role === 'trainer') {
        return executeQuery<AccessibleCategory[]>(
            `SELECT lc.id, lc.name, lc.code, lc.color 
             FROM learning_categories lc
             JOIN category_trainers ct ON lc.id = ct.category_id
             WHERE ct.trainer_id = ? AND lc.is_active = 1 
             ORDER BY lc.name ASC`,
            [user.id]
        );
    }

    return [];
}

/**
 * Membangun klausa SQL filter kategori untuk entitas yang memiliki kolom `category_id`.
 * Jika Admin: tidak ada filter tambahan (isScoped = false).
 * Jika Trainer: menyaring `tableAlias.category_id IN (...)`. Jika belum di-assign -> `AND 1 = 0`.
 */
export async function resolveUserCategoryScope(
    user: AuthenticatedUser,
    tableAlias: string = 't'
): Promise<ScopeConstraint> {
    if (user.role === 'admin') {
        return { isScoped: false, categoryIds: [], sqlCondition: '', params: [] };
    }

    if (user.role === 'trainer') {
        const categoryIds = await getTrainerCategoryIds(user.id);
        if (categoryIds.length === 0) {
            return {
                isScoped: true,
                categoryIds: [],
                sqlCondition: ` AND 1 = 0`,
                params: [],
            };
        }

        const placeholders = categoryIds.map(() => '?').join(',');
        return {
            isScoped: true,
            categoryIds,
            sqlCondition: ` AND ${tableAlias}.category_id IN (${placeholders})`,
            params: categoryIds,
        };
    }

    // Role selain admin dan trainer tidak memiliki akses ke manajemen konten
    return {
        isScoped: true,
        categoryIds: [],
        sqlCondition: ` AND 1 = 0`,
        params: [],
    };
}

/**
 * Membangun klausa SQL filter sesi berdasarkan kategori modul yang dijalankan.
 */
export async function resolveSessionCategoryScope(
    user: AuthenticatedUser,
    moduleAlias: string = 'm'
): Promise<ScopeConstraint> {
    if (user.role === 'admin') {
        return { isScoped: false, categoryIds: [], sqlCondition: '', params: [] };
    }

    if (user.role === 'trainer') {
        const categoryIds = await getTrainerCategoryIds(user.id);
        if (categoryIds.length === 0) {
            return {
                isScoped: true,
                categoryIds: [],
                sqlCondition: ` AND 1 = 0`,
                params: [],
            };
        }

        const placeholders = categoryIds.map(() => '?').join(',');
        return {
            isScoped: true,
            categoryIds,
            sqlCondition: ` AND ${moduleAlias}.category_id IN (${placeholders})`,
            params: categoryIds,
        };
    }

    return {
        isScoped: true,
        categoryIds: [],
        sqlCondition: ` AND 1 = 0`,
        params: [],
    };
}

/**
 * Verifikasi apakah seorang trainer memiliki hak akses ke entitas spesifik (Anti-IDOR).
 */
export async function assertTrainerAccess(
    user: AuthenticatedUser,
    table: 'trainings' | 'exams' | 'modules',
    entityId: string
): Promise<boolean> {
    if (user.role === 'admin') return true;
    if (user.role !== 'trainer') return false;

    const categoryIds = await getTrainerCategoryIds(user.id);
    if (categoryIds.length === 0) return false;

    const placeholders = categoryIds.map(() => '?').join(',');
    const rows = await executeQuery<{ id: string }[]>(
        `SELECT id FROM ${table} WHERE id = ? AND category_id IN (${placeholders}) LIMIT 1`,
        [entityId, ...categoryIds]
    );

    return (rows || []).length > 0;
}

/**
 * Verifikasi apakah trainer berhak mengakses sesi tertentu berdasarkan modul kategori yang dijalankan.
 */
export async function assertTrainerSessionAccess(
    user: AuthenticatedUser,
    sessionId: string
): Promise<boolean> {
    if (user.role === 'admin') return true;
    if (user.role !== 'trainer') return false;

    const categoryIds = await getTrainerCategoryIds(user.id);
    if (categoryIds.length === 0) return false;

    const placeholders = categoryIds.map(() => '?').join(',');
    const rows = await executeQuery<{ id: string }[]>(
        `SELECT s.id 
         FROM sessions s
         JOIN modules m ON s.module_id = m.id
         WHERE s.id = ? AND m.category_id IN (${placeholders}) 
         LIMIT 1`,
        [sessionId, ...categoryIds]
    );

    return (rows || []).length > 0;
}
