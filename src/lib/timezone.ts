/**
 * Timezone Management Utility for LMS Nusamitra
 * Standardizes time handling across WIB (UTC+7), WITA (UTC+8), and WIT (UTC+9).
 * Single Source of Truth: WIB (Asia/Jakarta / UTC+7).
 */

export const WIB_OFFSET = '+07:00';
export const WIB_TIMEZONE = 'Asia/Jakarta';

/**
 * Normalizes a database date string or Date object into a full ISO 8601 string
 * with explicit WIB offset (+07:00).
 * Prevents client browsers in WITA/WIT from misinterpreting raw MySQL DATETIME as device-local time.
 */
export function normalizeDbDateToIso(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '';

    if (dateInput instanceof Date) {
        return dateInput.toISOString();
    }

    const trimmed = String(dateInput).trim();
    if (!trimmed) return '';

    // If it already has an offset or UTC Z, return as is
    if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    // Handle "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
    const standardPart = trimmed.replace(' ', 'T');
    const withSeconds = standardPart.length === 16 ? `${standardPart}:00` : standardPart;

    // Append WIB offset (+07:00) so browsers worldwide calculate the identical epoch
    return `${withSeconds}${WIB_OFFSET}`;
}

/**
 * Converts datetime-local input string ("YYYY-MM-DDTHH:mm") to ISO string with WIB offset.
 */
export function parseLocalInputToWibIso(localDateTimeStr: string): string {
    if (!localDateTimeStr) return '';
    const trimmed = localDateTimeStr.trim();
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    return `${withSeconds}${WIB_OFFSET}`;
}

/**
 * Converts an ISO string or datetime-local string to MySQL DATETIME format (YYYY-MM-DD HH:mm:ss) in WIB.
 */
export function toMysqlDatetimeWib(dateInput: string | Date): string {
    if (!dateInput) return '';

    if (dateInput instanceof Date) {
        // Convert to WIB (+7)
        const wibDate = new Date(dateInput.getTime() + (7 * 60 + dateInput.getTimezoneOffset()) * 60000);
        return wibDate.toISOString().slice(0, 19).replace('T', ' ');
    }

    const trimmed = String(dateInput).trim();
    // If it is from datetime-local ("2026-09-16T09:00"), format to "YYYY-MM-DD HH:mm:ss"
    if (trimmed.includes('T')) {
        const clean = trimmed.split('+')[0].split('Z')[0];
        const withSec = clean.length === 16 ? `${clean}:00` : clean;
        return withSec.replace('T', ' ');
    }

    return trimmed.length === 16 ? `${trimmed}:00` : trimmed;
}

/**
 * Returns the detected timezone abbreviation for the current user (e.g. WIB, WITA, WIT, or custom offset).
 */
export function getClientTimezoneAbbr(timeZone?: string): string {
    try {
        const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz === 'Asia/Jakarta' || tz === 'Asia/Pontianak') return 'WIB';
        if (tz === 'Asia/Makassar' || tz === 'Asia/Ujung_Pandang') return 'WITA';
        if (tz === 'Asia/Jayapura') return 'WIT';

        // Check offset if standard Indonesian zones are not matched
        const offsetMinutes = -new Date().getTimezoneOffset();
        if (offsetMinutes === 420) return 'WIB';
        if (offsetMinutes === 480) return 'WITA';
        if (offsetMinutes === 540) return 'WIT';

        const sign = offsetMinutes >= 0 ? '+' : '-';
        const hours = Math.floor(Math.abs(offsetMinutes) / 60);
        return `UTC${sign}${hours}`;
    } catch {
        return 'WIB';
    }
}

/**
 * Formats a schedule range with client local timezone and WIB reference.
 * Prevents confusion for participants in WITA and WIT.
 */
export function formatDualSchedule(
    startInput: string | Date,
    endInput: string | Date
): {
    localFormatted: string;
    wibReference: string;
    fullText: string;
    isDifferentTimezone: boolean;
} {
    const startIso = normalizeDbDateToIso(startInput);
    const endIso = normalizeDbDateToIso(endInput);

    const startDate = new Date(startIso);
    const endDate = new Date(endIso);

    const clientTzAbbr = getClientTimezoneAbbr();
    const isDifferentTimezone = clientTzAbbr !== 'WIB';

    // Format for local device
    const dateFormatter = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    });

    // Format for WIB reference
    const wibTimeFormatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: WIB_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
    });

    const startLocalTime = timeFormatter.format(startDate);
    const endLocalTime = timeFormatter.format(endDate);
    const dateStr = dateFormatter.format(startDate);

    const localFormatted = `${dateStr}, ${startLocalTime} - ${endLocalTime} ${clientTzAbbr}`;

    const startWibTime = wibTimeFormatter.format(startDate);
    const endWibTime = wibTimeFormatter.format(endDate);
    const wibReference = `${startWibTime} - ${endWibTime} WIB`;

    const fullText = isDifferentTimezone
        ? `${localFormatted} (${wibReference})`
        : localFormatted;

    return {
        localFormatted,
        wibReference,
        fullText,
        isDifferentTimezone,
    };
}

/**
 * Formats a date string or Date object strictly into WIB (Asia/Jakarta) representation.
 * Prevents device in WITA/WIT from formatting the time in their local offset when WIB is intended.
 */
export function formatWibDateTime(dateInput: string | Date | null | undefined, options?: { withDayName?: boolean }): string {
    if (!dateInput) return '-';
    const iso = normalizeDbDateToIso(dateInput);
    if (!iso) return '-';

    const date = new Date(iso);
    if (isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
        timeZone: WIB_TIMEZONE,
        weekday: options?.withDayName ? 'short' : undefined,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date) + ' WIB';
}

/**
 * Converts an ISO or DB date string into a WIB datetime-local input string ("YYYY-MM-DDTHH:mm").
 * Ensures datetime-local inputs in admin forms always reflect the accurate WIB hour.
 */
export function formatIsoToWibInput(dateStr: string | Date | null | undefined): string {
    if (!dateStr) return '';
    try {
        const iso = normalizeDbDateToIso(dateStr);
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: WIB_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(d);

        const findPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
        return `${findPart('year')}-${findPart('month')}-${findPart('day')}T${findPart('hour')}:${findPart('minute')}`;
    } catch {
        return '';
    }
}

