/**
 * HTML entity escaping for XSS prevention.
 * Use when injecting user-generated strings into HTML templates (e.g., XLS export).
 */
import sanitizeHtml from 'sanitize-html';

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

const SAFE_STYLE_VALUE = /^[-#(),.%\w\s]+$/;

/**
 * Sanitizes rich-text HTML before storing or rendering user/admin-authored content.
 * This keeps the TipTap formatting surface while removing scripts, event handlers,
 * javascript: URLs, unsafe iframes, and unapproved inline styles.
 */
export function sanitizeRichHtml(input: string | null | undefined): string {
    if (!input) return '';

    return sanitizeHtml(input, {
        allowedTags: [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
            'blockquote', 'code', 'pre', 'hr',
            'h1', 'h2', 'h3', 'ul', 'ol', 'li',
            'span', 'a', 'img',
        ],
        allowedAttributes: {
            a: ['href', 'target', 'rel', 'title'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            span: ['style'],
            p: ['style'],
            h1: ['style'],
            h2: ['style'],
            h3: ['style'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedSchemesByTag: {
            img: ['http', 'https', 'data'],
        },
        allowedStyles: {
            '*': {
                color: [SAFE_STYLE_VALUE],
                'background-color': [SAFE_STYLE_VALUE],
                'text-align': [/^(left|right|center|justify)$/],
            },
        },
        transformTags: {
            a: (_tagName, attribs) => {
                const safeAttributes: Record<string, string> = {
                    ...attribs,
                    rel: 'noopener noreferrer',
                };

                if (attribs.target !== '_blank') {
                    delete safeAttributes.target;
                }

                return { tagName: 'a', attribs: safeAttributes };
            },
        },
        disallowedTagsMode: 'discard',
        enforceHtmlBoundary: true,
    });
}

/** Returns true for app-relative paths or normal HTTP(S) URLs. */
export function isSafePublicUrl(value: string | null | undefined): value is string {
    if (!value) return false;
    if (value.startsWith('/')) {
        return !value.startsWith('//') && !value.includes('\\') && !value.includes('\0');
    }

    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/** Parses bounded pagination values so LIMIT/OFFSET cannot be abused. */
export function parsePagination(
    searchParams: URLSearchParams,
    defaultLimit = 10,
    maxLimit = 100,
): { page: number; limit: number; offset: number } {
    const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10);
    const parsedLimit = Number.parseInt(searchParams.get('limit') || String(defaultLimit), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), maxLimit)
        : defaultLimit;

    return {
        page,
        limit,
        offset: (page - 1) * limit,
    };
}
