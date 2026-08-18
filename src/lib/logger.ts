import { logActivity, AuditActionType } from '@/lib/audit';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';

function formatTimestamp(): string {
    return new Date().toISOString();
}

/**
 * LMS Nusamitra Consulting Server Logger.
 * Formats server logs cleanly: [TIMESTAMP] [LEVEL] [MODULE] [USER_ID] Message | Context
 */
export const logger = {
    info(moduleName: string, message: string, details?: Record<string, any>, userId?: string) {
        const time = formatTimestamp();
        const userTag = userId ? `[User:${userId}]` : '[System]';
        const context = details ? ` | Details: ${JSON.stringify(details)}` : '';
        console.log(`\x1b[36m[${time}] [INFO] [${moduleName}] ${userTag}\x1b[0m ${message}${context}`);
    },

    warn(moduleName: string, message: string, details?: Record<string, any>, userId?: string) {
        const time = formatTimestamp();
        const userTag = userId ? `[User:${userId}]` : '[System]';
        const context = details ? ` | Details: ${JSON.stringify(details)}` : '';
        console.warn(`\x1b[33m[${time}] [WARN] [${moduleName}] ${userTag}\x1b[0m ${message}${context}`);
    },

    error(moduleName: string, message: string, errorObj?: any, userId?: string) {
        const time = formatTimestamp();
        const userTag = userId ? `[User:${userId}]` : '[System]';
        const errorDetails = errorObj instanceof Error 
            ? `${errorObj.message} ${errorObj.stack || ''}` 
            : typeof errorObj === 'object' ? JSON.stringify(errorObj) : String(errorObj || '');
        
        console.error(`\x1b[31m[${time}] [ERROR] [${moduleName}] ${userTag}\x1b[0m ${message} ${errorDetails}`);
    },

    async audit(
        userId: string,
        actionType: AuditActionType,
        entity: string,
        entityId: string | null = null,
        details: Record<string, any> | null = null,
        moduleName = 'AUDIT'
    ) {
        this.info(moduleName, `[Audit Action: ${actionType}] Entity: ${entity} (ID: ${entityId || 'N/A'})`, details || undefined, userId);
        try {
            await logActivity(userId, actionType, entity, entityId, details);
        } catch (err) {
            this.error('AUDIT_FAIL', `Gagal mencatat audit log ke DB: ${actionType}`, err, userId);
        }
    }
};

export default logger;
