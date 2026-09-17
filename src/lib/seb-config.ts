import crypto from 'crypto';

export type SebConfigValue = string | number | boolean | Buffer | SebConfigValue[] | SebConfigDictionary;
export interface SebConfigDictionary {
    [key: string]: SebConfigValue;
}

export interface BuildSebConfigOptions {
    sessionId: string;
    startUrl: string;
    quitUrl: string;
    enableProctoring: boolean;
}

const WINDOWS_MINIMUM_VERSION = 'Win.3.10.2.min';
const MACOS_MINIMUM_VERSION = 'Mac.3.7.1.min';

function getStableExamSalt(sessionId: string): Buffer {
    const secret = process.env.SEB_CONFIG_SALT || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('SEB_CONFIG_SALT atau JWT_SECRET wajib tersedia untuk menghasilkan konfigurasi SEB');
    }

    return crypto.createHmac('sha256', secret).update(`seb-exam:${sessionId}`).digest();
}

/**
 * Build the exact raw dictionary consumed by SEB. Keep all security-relevant
 * settings here so the downloaded plist and the calculated Config Key cannot drift.
 */
export function buildSebConfig(options: BuildSebConfigOptions): SebConfigDictionary {
    return {
        originatorVersion: 'SEB_Win_3.10.2',
        sebConfigPurpose: 0,
        startURL: options.startUrl,
        sendBrowserExamKey: true,
        examKeySalt: getStableExamSalt(options.sessionId),
        sebAllowedVersions: [WINDOWS_MINIMUM_VERSION, MACOS_MINIMUM_VERSION],

        browserWindowWebView: 3,
        browserWindowWebViewClassicHideDeprecationNote: true,

        allowVideoCapture: options.enableProctoring,
        allowAudioCapture: false,
        browserMediaCaptureCamera: options.enableProctoring,
        browserMediaCaptureMicrophone: false,
        mediaCaptureRequiresUserGesture: false,

        showTaskBar: true,
        showReloadButton: true,
        showReloadWarning: true,
        browserWindowAllowReload: true,
        showQuitButton: true,
        quitURL: options.quitUrl,
        quitURLConfirm: true,
        allowQuit: true,
        showTime: true,
        showNetworkInfo: true,
        showBatteryInfo: true,
        enableZoomPage: true,

        // Process monitoring is deliberately kept disabled for BYOD reliability.
        // SEB access is enforced by the Config Key handshake in the LMS instead.
        monitorProcesses: false,
        allowPreferencesWindow: false,
        insideSebEnableSwitchUser: false,
        allowSwitchToThirdPartyApps: false,
        allowDeveloperConsole: false,
        allowSpellCheck: false,
        allowDictionaryLookup: false,
        allowScreenSharing: false,
        allowWindowCapture: false,
        screenSharingMacEnforceBlocked: true,

        hookKeys: true,
        enableAltTab: false,
        enableCtrlEsc: false,
        enableStartMenu: false,
        enablePrintScreen: false,
        enableF5: true,
        enableAAC: false,
        enableMacOSAAC: false,
    };
}

/**
 * Matches SEB's platform-independent Config Key serialization:
 * dictionaries are sorted by key and originatorVersion is excluded.
 */
export function serializeSebConfigForKey(value: SebConfigValue): string {
    if (Buffer.isBuffer(value)) {
        return `"${value.toString('base64')}"`;
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => serializeSebConfigForKey(item)).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value)
            .filter(([key, child]) => {
                if (key.toLowerCase() === 'originatorversion') return false;
                if (child && typeof child === 'object' && !Array.isArray(child) && !Buffer.isBuffer(child)) {
                    return Object.keys(child).length > 0;
                }
                return true;
            })
            .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);

        return `{${entries.map(([key, child]) => `"${key}":${serializeSebConfigForKey(child)}`).join(',')}}`;
    }
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
}

export function calculateSebConfigKey(config: SebConfigDictionary): string {
    return crypto.createHash('sha256').update(serializeSebConfigForKey(config), 'utf8').digest('hex');
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function serializePlistValue(value: SebConfigValue, depth: number): string {
    const indent = '  '.repeat(depth);
    if (Buffer.isBuffer(value)) return `${indent}<data>${value.toString('base64')}</data>`;
    if (Array.isArray(value)) {
        const children = value.map((item) => serializePlistValue(item, depth + 1)).join('\n');
        return `${indent}<array>\n${children}\n${indent}</array>`;
    }
    if (value !== null && typeof value === 'object') {
        const children = Object.entries(value).map(([key, child]) => (
            `${'  '.repeat(depth + 1)}<key>${escapeXml(key)}</key>\n${serializePlistValue(child, depth + 1)}`
        )).join('\n');
        return `${indent}<dict>\n${children}\n${indent}</dict>`;
    }
    if (typeof value === 'boolean') return `${indent}<${value ? 'true' : 'false'}/>`;
    if (typeof value === 'number') return `${indent}<integer>${value}</integer>`;
    return `${indent}<string>${escapeXml(value)}</string>`;
}

export function serializeSebConfigPlist(config: SebConfigDictionary): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${serializePlistValue(config, 1)}\n</plist>`;
}

export function parseStoredSebConfigKeys(value: string | null | undefined): string[] {
    if (!value) return [];
    return Array.from(new Set(
        value.split(',')
            .map((key) => key.trim().toLowerCase())
            .filter((key) => /^[a-f0-9]{64}$/.test(key)),
    ));
}

export function mergeStoredSebConfigKeys(current: string | null | undefined, next: string): string {
    return [next.toLowerCase(), ...parseStoredSebConfigKeys(current).filter((key) => key !== next.toLowerCase())]
        .slice(0, 3)
        .join(',');
}

