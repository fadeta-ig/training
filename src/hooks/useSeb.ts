import { useSyncExternalStore } from 'react';

/**
 * Checks if the current browser environment is Safe Exam Browser (SEB).
 * Utilizes `useSyncExternalStore` to avoid SSR hydration mismatches
 * and cascading re-renders caused by synchronous `setState` in `useEffect`.
 */
function checkIsSeb(): boolean {
    if (typeof window === 'undefined') return false;
    
    const ua = (navigator.userAgent || '').toLowerCase();
    
    // Check User-Agent strings across Windows, macOS, iOS
    const isSebUA = 
        ua.includes('safeexambrowser') ||
        ua.includes('seb/') ||
        /\bseb\b/.test(ua);

    // Check JavaScript window objects injected by SEB iOS / macOS / Windows
    const sebObj = (window as unknown as Record<string, any>).SafeExamBrowser;
    const hasSebWindow = sebObj !== undefined && sebObj !== null;

    return isSebUA || hasSebWindow;
}

export interface SafeExamBrowserSecurity {
    browserExamKey?: string;
    configKey?: string;
    updateKeys?: (callback: () => void) => void;
    logout?: () => void;
}

export interface SafeExamBrowserObject {
    security?: SafeExamBrowserSecurity;
    version?: string | { version?: string; build?: string };
    terminateBrowser?: () => void;
    [key: string]: unknown;
}

declare global {
    interface Window {
        SafeExamBrowser?: SafeExamBrowserObject;
    }
}

const subscribeNoop = () => () => {};

export function useIsSeb(): boolean {
    return useSyncExternalStore(
        subscribeNoop,
        checkIsSeb,
        () => false
    );
}

/**
 * Safely extracts SEB security headers from the Modern WebView JS API or global context.
 */
export function getSebHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const seb = window.SafeExamBrowser;
    if (!seb?.security) return {};

    const headers: Record<string, string> = {};
    if (typeof seb.security.configKey === 'string' && seb.security.configKey.trim()) {
        headers['x-safeexambrowser-configkeyhash'] = seb.security.configKey.trim();
    }
    if (typeof seb.security.browserExamKey === 'string' && seb.security.browserExamKey.trim()) {
        headers['x-safeexambrowser-requesthash'] = seb.security.browserExamKey.trim();
    }
    return headers;
}

/**
 * Asynchronously query the SEB JavaScript API to update security keys
 * in Modern WebView (WKWebView) environments before making network calls.
 */
export async function updateSebSecurityKeys(timeoutMs = 1_500): Promise<Record<string, string>> {
    if (typeof window === 'undefined') return {};
    const seb = window.SafeExamBrowser;
    if (!seb?.security) return {};

    if (typeof seb.security.updateKeys === 'function') {
        await new Promise<void>((resolve) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    resolve();
                }
            }, timeoutMs);

            try {
                seb.security?.updateKeys?.(() => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            } catch {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeout);
                    resolve();
                }
            }
        });
    }

    return getSebHeaders();
}

export type SebCameraStatus = 'granted' | 'denied' | 'unavailable' | 'error' | 'unchecked';

export interface SebPreflightResult {
    required: boolean;
    token?: string;
    mode?: 'verified' | 'admin_override';
    platform?: string;
    version?: string | null;
    cameraRequired: boolean;
    expiresAt?: string;
}

export class SebPreflightError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly retryable: boolean,
    ) {
        super(message);
        this.name = 'SebPreflightError';
    }
}

function getSebVersion(): string | null {
    if (typeof window === 'undefined') return null;
    const value = window.SafeExamBrowser?.version;
    if (typeof value === 'string') return value;
    if (value && typeof value.version === 'string') {
        return value.build ? `${value.version}.${value.build}` : value.version;
    }

    const uaMatch = navigator.userAgent.match(/(?:SafeExamBrowser|SEB)[/\s-]([0-9]+(?:\.[0-9]+){1,3})/i);
    return uaMatch?.[1] || null;
}

function getClientPlatform(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    return navigator.platform || navigator.userAgent || 'unknown';
}

async function probeCameraPermission(): Promise<SebCameraStatus> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unavailable';
    let stream: MediaStream | null = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        return stream.getVideoTracks().length > 0 ? 'granted' : 'unavailable';
    } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'unavailable';
        return 'error';
    } finally {
        stream?.getTracks().forEach((track) => track.stop());
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Perform a bounded SEB handshake. Windows can authenticate through request
 * headers injected by SEB, while modern macOS WebView can submit keys exposed
 * by the JavaScript API. Both paths receive one short-lived LMS token.
 */
export async function performSebPreflight(
    sessionId: string,
    options: { timeoutMs?: number; onAttempt?: (attempt: number) => void } = {},
): Promise<SebPreflightResult> {
    if (typeof window === 'undefined') {
        throw new SebPreflightError('Pemeriksaan SEB hanya dapat dijalankan di browser.', 'browser_unavailable', false);
    }

    const timeoutMs = options.timeoutMs ?? 15_000;
    const startedAt = Date.now();
    let attempt = 0;
    let cameraStatus: SebCameraStatus = 'unchecked';
    let lastError: SebPreflightError | null = null;

    while (Date.now() - startedAt <= timeoutMs) {
        attempt += 1;
        options.onAttempt?.(attempt);
        const sebHeaders = await updateSebSecurityKeys(Math.min(1_500, Math.max(300, timeoutMs - (Date.now() - startedAt))));

        let response: Response;
        try {
            response = await fetch(`/api/participant/sessions/${sessionId}/seb-preflight`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...sebHeaders },
                body: JSON.stringify({
                    page_url: window.location.href.split('#')[0],
                    config_key_hash: sebHeaders['x-safeexambrowser-configkeyhash'] || null,
                    browser_exam_key_hash: sebHeaders['x-safeexambrowser-requesthash'] || null,
                    platform: getClientPlatform(),
                    version: getSebVersion(),
                    js_api_available: Boolean(window.SafeExamBrowser?.security),
                    camera_status: cameraStatus,
                }),
            });
        } catch {
            lastError = new SebPreflightError('Tidak dapat menghubungi server untuk memeriksa SEB.', 'network_error', true);
            await delay(650);
            continue;
        }

        if (response.status === 401) {
            throw new SebPreflightError('Sesi login berakhir. Silakan login kembali.', 'authentication_required', false);
        }

        const data = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (response.ok && data.success === true) {
            return {
                required: data.required !== false,
                token: typeof data.token === 'string' ? data.token : undefined,
                mode: data.mode === 'verified' || data.mode === 'admin_override' ? data.mode : undefined,
                platform: typeof data.platform === 'string' ? data.platform : undefined,
                version: typeof data.version === 'string' ? data.version : null,
                cameraRequired: data.cameraRequired === true,
                expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : undefined,
            };
        }

        const code = typeof data.code === 'string' ? data.code : 'preflight_error';
        const message = typeof data.error === 'string' ? data.error : 'Validasi SEB gagal.';
        const retryable = data.retryable === true;

        if (code === 'camera_check_required') {
            cameraStatus = await probeCameraPermission();
            continue;
        }

        lastError = new SebPreflightError(message, code, retryable);
        if (!retryable) throw lastError;
        await delay(650);
    }

    throw lastError || new SebPreflightError(
        'Security key SEB belum tersedia setelah 15 detik. Tutup SEB, buka ulang file konfigurasi terbaru, lalu coba kembali.',
        'seb_handshake_timeout',
        true,
    );
}

export function getSebRequestHeaders(accessToken?: string | null): Record<string, string> {
    const headers = getSebHeaders();
    if (accessToken) headers['x-lms-seb-token'] = accessToken;
    return headers;
}
