/**
 * Pure participant formatting utilities safe for both client and server components.
 * ZERO server-side dependencies (no DB, no Node crypto, no NextRequest).
 */

/**
 * Formats full official participant name including front title and back title.
 * Examples:
 * - ("Budi Santoso", "Dr.", "S.Kom., M.M.") -> "Dr. Budi Santoso, S.Kom., M.M."
 * - ("Budi Santoso", null, "S.Kom.") -> "Budi Santoso, S.Kom."
 * - ("Budi Santoso", "Ir.", null) -> "Ir. Budi Santoso"
 * - ("Budi Santoso", null, null) -> "Budi Santoso"
 */
export function formatFullNameWithTitles(
    fullName: string | null | undefined,
    frontTitle?: string | null,
    backTitle?: string | null
): string {
    const cleanName = (fullName || '').trim();
    if (!cleanName) return '';
    const cleanFront = (frontTitle || '').trim();
    const cleanBack = (backTitle || '').trim();

    let result = cleanName;
    if (cleanFront) {
        result = `${cleanFront} ${result}`;
    }
    if (cleanBack) {
        result = cleanBack.startsWith(',') ? `${result}${cleanBack}` : `${result}, ${cleanBack}`;
    }
    return result;
}
