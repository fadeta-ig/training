/**
 * HTML entity escaping for XSS prevention.
 * Use when injecting user-generated strings into HTML templates (e.g., XLS export).
 */

const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
};

const ESCAPE_REGEX = /[&<>"']/g;

/** Escapes HTML special characters to prevent XSS in raw HTML templates. */
export function escapeHtml(input: string | null | undefined): string {
    if (!input) return '';
    return input.replace(ESCAPE_REGEX, (char) => ESCAPE_MAP[char] || char);
}
