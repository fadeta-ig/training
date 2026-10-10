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

const PREFERRED_CAMERA_DEVICE_KEY = 'lms-seb-camera-device-id';

export function getPreferredCameraDeviceId(): string | null {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return null;
        return window.sessionStorage.getItem(PREFERRED_CAMERA_DEVICE_KEY);
    } catch {
        return null;
    }
}

export function setPreferredCameraDeviceId(id: string | null): void {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        if (id) {
            window.sessionStorage.setItem(PREFERRED_CAMERA_DEVICE_KEY, id);
        } else {
            window.sessionStorage.removeItem(PREFERRED_CAMERA_DEVICE_KEY);
        }
    } catch {
        // Ignore storage errors (private mode / blocked storage).
    }
}

export function isMacClient(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const nav = navigator as unknown as { platform?: string; userAgentData?: { platform?: string } };
    const platform = nav.platform || nav.userAgentData?.platform || '';
    return /macintosh|mac os|darwin/i.test(`${ua} ${platform}`);
}

/**
 * Asynchronously query the SEB JavaScript API to update security keys
 * in Modern WebView (WKWebView) environments before making network calls.
 * Mac (WKWebView) needs a longer default timeout (3500ms) than other
 * platforms (1500ms) because key refresh via Continuity Camera-era
 * WebKit bridges is measurably slower.
 */
export async function updateSebSecurityKeys(timeoutMs?: number): Promise<Record<string, string>> {
    const effectiveTimeout = typeof timeoutMs === 'number' ? timeoutMs : (isMacClient() ? 3_500 : 1_500);
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
            }, effectiveTimeout);

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

export type SebCameraStatus = 'granted' | 'denied' | 'unavailable' | 'busy' | 'overconstrained' | 'error' | 'unchecked';

export interface SebCameraProbe {
    status: SebCameraStatus;
    errorName?: string;
    deviceId?: string | null;
    deviceLabel?: string | null;
}

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

function mapCameraErrorToStatus(name: string): SebCameraStatus {
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'unavailable';
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'busy';
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'overconstrained';
    if (name === 'AbortError') return 'error';
    return 'error';
}

function stopMediaStream(stream: MediaStream | null | undefined): void {
    try {
        stream?.getTracks().forEach((track) => track.stop());
    } catch {
        // Ignore stop errors.
    }
}

export async function probeCameraPermission(): Promise<SebCameraProbe> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return { status: 'unavailable', errorName: 'NoMediaDevices' };
    }

    let selectedDeviceId: string | null = getPreferredCameraDeviceId();
    let selectedDeviceLabel: string | null = null;

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        if (videoInputs.length > 0) {
            const byLabel = (needle: string) =>
                videoInputs.find((d) => (d.label || '').toLowerCase().includes(needle));
            // Prefer built-in FaceTime camera on macOS; Continuity Camera
            // devices appear with iPhone names and are less reliable in SEB.
            const preferred =
                byLabel('facetime hd') || byLabel('face time') || byLabel('built-in') || videoInputs[0];
            if (preferred) {
                // Keep a stored preference if it still exists.
                const storedStillExists = selectedDeviceId
                    ? videoInputs.some((d) => d.deviceId === selectedDeviceId)
                    : false;
                if (!storedStillExists) {
                    selectedDeviceId = preferred.deviceId || null;
                    selectedDeviceLabel = preferred.label || null;
                } else {
                    const stored = videoInputs.find((d) => d.deviceId === selectedDeviceId);
                    selectedDeviceLabel = stored?.label || null;
                }
            }
        }
    } catch {
        // enumerateDevices failed (permission-gated labels); fall back to stored id / generic constraints.
    }

    const attempts: MediaStreamConstraints[] = [];
    if (selectedDeviceId) {
        attempts.push({ video: { deviceId: { exact: selectedDeviceId } }, audio: false });
    }
    attempts.push({ video: { width: { ideal: 1280 }, facingMode: 'user' }, audio: false });
    attempts.push({ video: true, audio: false });

    let lastErrorName = 'UnknownError';
    for (const constraints of attempts) {
        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            const track = stream.getVideoTracks()[0];
            if (!track) {
                stopMediaStream(stream);
                lastErrorName = 'NoVideoTrack';
                continue;
            }
            const settings = typeof track.getSettings === 'function' ? track.getSettings() : ({} as MediaTrackSettings);
            const deviceId = settings.deviceId || selectedDeviceId || null;
            const deviceLabel = track.label || selectedDeviceLabel || null;
            setPreferredCameraDeviceId(deviceId);
            const probe: SebCameraProbe = { status: 'granted', deviceId, deviceLabel };
            stopMediaStream(stream);
            return probe;
        } catch (error) {
            stopMediaStream(stream);
            const name = error instanceof DOMException ? error.name : (error as Error)?.name || 'UnknownError';
            lastErrorName = name || 'UnknownError';
            continue;
        }
    }

    return { status: mapCameraErrorToStatus(lastErrorName), errorName: lastErrorName };
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
    let cameraProbe: SebCameraProbe = { status: 'unchecked' };
    let cameraStatus: SebCameraStatus = 'unchecked';
    let lastError: SebPreflightError | null = null;

    while (Date.now() - startedAt <= timeoutMs) {
        attempt += 1;
        options.onAttempt?.(attempt);
        const remaining = Math.max(300, timeoutMs - (Date.now() - startedAt));
        const baseTimeout = isMacClient() ? 3_500 : 1_500;
        const keyTimeout = Math.min(4_000, baseTimeout + (attempt - 1) * 500);
        const sebHeaders = await updateSebSecurityKeys(Math.min(keyTimeout, remaining));

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
                    camera_error: cameraProbe.errorName || null,
                    camera_device_id: cameraProbe.deviceId || null,
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
            cameraProbe = await probeCameraPermission();
            cameraStatus = cameraProbe.status;
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
