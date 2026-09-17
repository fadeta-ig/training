import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { verifyEnrollment, validateSessionTiming, ParticipantError } from '@/lib/participant-helpers';
import {
    looksLikeSebUserAgent,
    signSebAccessToken,
    verifySebHashes,
    type SebAccessMode,
} from '@/lib/seb-access';

type CameraStatus = 'granted' | 'denied' | 'unavailable' | 'error' | 'unchecked';

interface PreflightBody {
    page_url?: unknown;
    config_key_hash?: unknown;
    browser_exam_key_hash?: unknown;
    platform?: unknown;
    version?: unknown;
    js_api_available?: unknown;
    camera_status?: unknown;
}

interface OverrideRow {
    id: string;
    expires_at: Date | string;
}

function stringValue(value: unknown, maxLength: number): string | null {
    return typeof value === 'string' && value.length <= maxLength ? value.trim() : null;
}

function versionParts(value: string): number[] | null {
    const match = value.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
}

function versionAtLeast(actual: number[], minimum: number[]): boolean {
    for (let index = 0; index < Math.max(actual.length, minimum.length); index += 1) {
        const left = actual[index] || 0;
        const right = minimum[index] || 0;
        if (left > right) return true;
        if (left < right) return false;
    }
    return true;
}

function normalizePlatform(value: string | null, userAgent: string): 'windows' | 'macos' | 'unknown' {
    const combined = `${value || ''} ${userAgent}`.toLowerCase();
    if (combined.includes('win')) return 'windows';
    if (combined.includes('mac')) return 'macos';
    return 'unknown';
}

function checkSupportedVersion(platform: 'windows' | 'macos' | 'unknown', version: string | null) {
    if (!version) return { supported: true, detected: null, minimum: null };
    const parsed = versionParts(version);
    if (!parsed) return { supported: true, detected: version, minimum: null };

    const minimum = platform === 'windows' ? [3, 10, 2] : platform === 'macos' ? [3, 7, 1] : null;
    if (!minimum) return { supported: true, detected: version, minimum: null };
    return {
        supported: versionAtLeast(parsed, minimum),
        detected: version,
        minimum: minimum.join('.'),
    };
}

async function findActiveOverride(sessionId: string, userId: string): Promise<OverrideRow | null> {
    try {
        const rows = await executeQuery<OverrideRow[]>(
            `SELECT id, expires_at
             FROM seb_access_overrides
             WHERE session_id = ?
               AND user_id = ?
               AND revoked_at IS NULL
               AND expires_at > UTC_TIMESTAMP()
             ORDER BY created_at DESC
             LIMIT 1`,
            [sessionId, userId],
        );
        return rows[0] || null;
    } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== 'ER_NO_SUCH_TABLE') {
            logger.error('SEB_PREFLIGHT', 'Gagal memeriksa override SEB', error, userId);
        }
        return null;
    }
}

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const { id: sessionId } = await context.params;
        const body = await request.json() as PreflightBody;
        await verifyEnrollment(sessionId, user.id);
        const { session, isEnded, effectiveEndTime } = await validateSessionTiming(sessionId, user.id);

        if (isEnded) {
            return NextResponse.json({
                success: false,
                code: 'session_ended',
                error: 'Sesi ujian sudah berakhir.',
                retryable: false,
            }, { status: 400 });
        }

        if (!session.require_seb) {
            return NextResponse.json({ success: true, required: false, cameraRequired: false });
        }

        const userAgent = request.headers.get('user-agent') || '';
        const platform = normalizePlatform(stringValue(body.platform, 100), userAgent);
        const version = stringValue(body.version, 100);
        const versionCheck = checkSupportedVersion(platform, version);
        if (!versionCheck.supported) {
            return NextResponse.json({
                success: false,
                code: 'unsupported_version',
                error: `Versi SEB ${versionCheck.detected} belum didukung. Minimum untuk ${platform === 'windows' ? 'Windows' : 'macOS'} adalah ${versionCheck.minimum}.`,
                retryable: false,
                platform,
                version: versionCheck.detected,
                minimumVersion: versionCheck.minimum,
            }, { status: 426 });
        }

        const override = await findActiveOverride(sessionId, user.id);
        let accessMode: SebAccessMode | null = override ? 'admin_override' : null;

        if (!accessMode) {
            if (!session.seb_config_key) {
                return NextResponse.json({
                    success: false,
                    code: 'config_not_ready',
                    error: 'Config Key sesi belum tersedia. Unduh dan buka ulang file SEB terbaru dari halaman sesi.',
                    retryable: false,
                }, { status: 409 });
            }

            const verification = verifySebHashes(request, session.seb_config_key, {
                pageUrl: stringValue(body.page_url, 2_000),
                configKeyHash: stringValue(body.config_key_hash, 128),
                browserExamKeyHash: stringValue(body.browser_exam_key_hash, 128),
            });
            if (verification.valid) {
                accessMode = 'verified';
            }
        }

        if (!accessMode) {
            const isSeb = looksLikeSebUserAgent(userAgent) || body.js_api_available === true;
            const hasAnyKey = Boolean(
                request.headers.get('x-safeexambrowser-configkeyhash')
                || request.headers.get('x-safeexambrowser-requesthash')
                || stringValue(body.config_key_hash, 128)
                || stringValue(body.browser_exam_key_hash, 128),
            );

            return NextResponse.json({
                success: false,
                code: !isSeb ? 'not_seb' : hasAnyKey ? 'config_key_mismatch' : 'seb_key_pending',
                error: !isSeb
                    ? 'Safe Exam Browser tidak terdeteksi.'
                    : hasAnyKey
                        ? 'Config Key SEB tidak cocok. Buka ulang file konfigurasi terbaru untuk sesi ini.'
                        : 'SEB terdeteksi, tetapi security key belum tersedia. Sistem akan mencoba kembali.',
                retryable: isSeb && !hasAnyKey,
                platform,
                version,
            }, { status: 403 });
        }

        const cameraStatus = stringValue(body.camera_status, 30) as CameraStatus | null;
        if (session.enable_proctoring && cameraStatus !== 'granted') {
            const unchecked = !cameraStatus || cameraStatus === 'unchecked';
            return NextResponse.json({
                success: false,
                code: unchecked ? 'camera_check_required' : `camera_${cameraStatus}`,
                error: unchecked
                    ? 'Izin kamera perlu diperiksa sebelum ujian dibuka.'
                    : cameraStatus === 'denied'
                        ? 'Izin kamera ditolak. Aktifkan izin kamera untuk Safe Exam Browser lalu coba kembali.'
                        : 'Kamera tidak tersedia atau sedang digunakan aplikasi lain.',
                retryable: unchecked,
                cameraRequired: true,
            }, { status: 428 });
        }

        let expiresAt = new Date(effectiveEndTime.getTime() + 10 * 60 * 1000);
        if (accessMode === 'admin_override' && override?.expires_at) {
            const rawOverrideExpiry = String(override.expires_at);
            const overrideExpiry = new Date(
                rawOverrideExpiry.endsWith('Z')
                    ? rawOverrideExpiry
                    : `${rawOverrideExpiry.replace(' ', 'T')}Z`,
            );
            if (Number.isFinite(overrideExpiry.getTime()) && overrideExpiry < expiresAt) {
                expiresAt = overrideExpiry;
            }
        }
        const token = await signSebAccessToken({
            userId: user.id,
            sessionId,
            mode: accessMode,
            expiresAt,
        });

        logger.info('SEB_PREFLIGHT', 'Preflight SEB berhasil', {
            sessionId,
            mode: accessMode,
            platform,
            version: version || 'unavailable',
            cameraStatus: session.enable_proctoring ? cameraStatus : 'not_required',
        }, user.id);

        return NextResponse.json({
            success: true,
            required: true,
            token,
            mode: accessMode,
            platform,
            version,
            cameraRequired: Boolean(session.enable_proctoring),
            expiresAt: expiresAt.toISOString(),
        });
    } catch (error) {
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, code: 'participant_error', error: error.message, retryable: false }, { status: error.statusCode });
        }
        logger.error('SEB_PREFLIGHT', 'Preflight SEB gagal', error, user.id);
        return NextResponse.json({
            success: false,
            code: 'preflight_error',
            error: 'Pemeriksaan SEB mengalami gangguan. Silakan coba kembali.',
            retryable: true,
        }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['trainee'] });
