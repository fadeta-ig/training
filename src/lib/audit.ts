import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';

/**
 * Common Audit Actions. Feel free to extend this list.
 */
export type AuditActionType =
    | 'USER_LOGIN'
    | 'LOGIN_FAILED'
    | 'USER_LOGOUT'
    | 'CREATE_USER'
    | 'UPDATE_USER'
    | 'DELETE_USER'
    | 'CREATE_SESSION'
    | 'UPDATE_SESSION'
    | 'DELETE_SESSION'
    | 'MANUAL_GRADE_EXAM'
    | 'BULK_IMPORT_USERS'
    | 'BULK_IMPORT_PARTICIPANTS'
    | 'RESET_PASSWORD'
    | 'SEND_CREDENTIALS'
    | 'SUBMIT_EXAM'
    | 'START_EXAM'
    | 'EXAM_OVERRIDE_RESUME'
    | 'EXAM_OVERRIDE_RESET'
    | 'EXAM_OVERRIDE_BULK_EXTENSION'
    | 'UPLOAD_MEDIA'
    | 'REORDER_QUESTIONS'
    | 'SHUFFLE_QUESTIONS'
    | 'DUPLICATE_EXAM'
    | 'DOWNLOAD_MODULE'
    | 'GRADUATION_VERDICT_UPDATED'
    | 'BULK_GRADUATION_VERDICT'
    | 'UPLOAD_CERTIFICATE'
    | 'USER_REGISTRATION_SUBMITTED'
    | 'REGISTRATION_APPROVED'
    | 'REGISTRATION_REJECTED'
    | 'BULK_UPDATE_BATCH'
    | 'CREATE_CERTIFICATION_PROGRAM'
    | 'UPDATE_CERTIFICATION_PROGRAM'
    | 'DELETE_CERTIFICATION_PROGRAM';


/**
 * Core function to log an activity to the audit_logs table.
 * @param userId - ID of the user performing the action.
 * @param actionType - Standardized action string.
 * @param entity - The target entity table (e.g., 'users', 'sessions', 'answers')
 * @param entityId - Target entity identifier, if applicable.
 * @param details - Any extra JSON-serializable info to store.
 */
export async function logActivity(
    userId: string | null,
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
