/**
 * LMS Antigravity - Safe API Client Utilities
 * Provides resilient fetch wrappers that prevent 'Unexpected token <' crashes
 * when servers or reverse proxies return HTML error pages (413, 500, 502, 404, etc.).
 */

export interface SafeFetchResult<T = unknown> {
    ok: boolean;
    status: number;
    data: T | null;
    error: string | null;
}

/**
 * Maps HTTP status codes to user-friendly Indonesian messages
 * when the server responds with non-JSON content (e.g. HTML from Nginx/Apache/Next.js).
 */
export function getFriendlyErrorMessage(status: number, fallback = 'Terjadi kesalahan sistem'): string {
    switch (status) {
        case 400:
            return 'Permintaan data tidak valid (HTTP 400).';
        case 401:
            return 'Sesi Anda telah kedaluwarsa. Silakan masuk kembali (HTTP 401).';
        case 403:
            return 'Anda tidak memiliki hak akses untuk tindakan ini (HTTP 403).';
        case 404:
            return 'Resource atau endpoint tidak ditemukan di server (HTTP 404).';
        case 413:
            return 'Ukuran berkas terlalu besar untuk diproses server (HTTP 413 Payload Too Large).';
        case 429:
            return 'Terlalu banyak permintaan. Silakan tunggu beberapa saat (HTTP 429).';
        case 500:
            return 'Server mengalami gangguan internal (HTTP 500). Silakan coba lagi.';
        case 502:
            return 'Server gateway bermasalah atau sedang offline (HTTP 502 Bad Gateway).';
        case 503:
            return 'Layanan server sementara tidak tersedia (HTTP 503 Service Unavailable).';
        case 504:
            return 'Batas waktu server habis saat memproses data (HTTP 504 Gateway Timeout).';
        default:
            return status >= 500
                ? `Terjadi kendala pada server (HTTP ${status}).`
                : `${fallback} (HTTP ${status}).`;
    }
}

/**
 * Executes a fetch request and safely parses the response as JSON.
 * If the response is HTML, text, or an unexpected format, it extracts
 * a human-readable error instead of throwing a SyntaxError.
 */
export async function safeFetchJson<T = any>(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<SafeFetchResult<T>> {
    let res: Response;
    try {
        res = await fetch(input, init);
    } catch (networkErr: unknown) {
        const message = networkErr instanceof Error ? networkErr.message : 'Koneksi jaringan gagal';
        return {
            ok: false,
            status: 0,
            data: null,
            error: `Gagal terhubung ke server: ${message}`,
        };
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    if (isJson) {
        try {
            const data = (await res.json()) as T;
            if (!res.ok) {
                const apiError = (data as any)?.error || (data as any)?.message;
                return {
                    ok: false,
                    status: res.status,
                    data,
                    error: apiError || getFriendlyErrorMessage(res.status),
                };
            }
            return {
                ok: true,
                status: res.status,
                data,
                error: null,
            };
        } catch {
            // Malformed JSON body
            return {
                ok: false,
                status: res.status,
                data: null,
                error: getFriendlyErrorMessage(res.status, 'Format data respons tidak valid'),
            };
        }
    }

    // Response is NOT JSON (e.g. HTML error page or raw text)
    const friendlyMessage = getFriendlyErrorMessage(res.status);

    return {
        ok: false,
        status: res.status,
        data: null,
        error: friendlyMessage,
    };
}
