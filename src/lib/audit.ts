import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';

/**
 * Common Audit Actions. Feel free to extend this list.
 */
export type AuditActionType =
    | 'USER_LOGIN'
    | 'USER_LOGOUT'
    | 'CREATE_USER'
    | 'UPDATE_USER'
    | 'DELETE_USER'
    | 'CREATE_SESSION'
    | 'UPDATE_SESSION'
    | 'DELETE_SESSION'
    | 'MANUAL_GRADE_EXAM'
    | 'BULK_IMPORT_USERS'
    | 'RESET_PASSWORD';

/**
 * Core function to log an activity to the audit_logs table.
 * @param userId - ID of the user performing the action.
 * @param actionType - Standardized action string.
 * @param entity - The target entity table (e.g., 'users', 'sessions', 'answers')
 * @param entityId - Target entity identifier, if applicable.
 * @param details - Any extra JSON-serializable info to store.
 */
export async function logActivity(
    userId: string,
    actionType: AuditActionType,
    entity: string,
    entityId: string | null = null,
    details: Record<string, any> | null = null
): Promise<void> {
    try {
        const id = uuidv4();
        const detailsJson = details ? JSON.stringify(details) : null;

        await executeQuery(
            `INSERT INTO audit_logs (id, user_id, action_type, entity, entity_id, details)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, userId, actionType, entity, entityId, detailsJson]
        );
    } catch (error) {
        // We log the error but don't break the application flow if an audit log fails.
        console.error('[Audit Log Error]', error);
    }
}
