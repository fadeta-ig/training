import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import logger from '@/lib/logger';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { verifyEnrollment, ParticipantError } from '@/lib/participant-helpers';
import { getAppBaseUrl } from '@/lib/app-url';
import {
    buildSebConfig,
    calculateSebConfigKey,
    mergeStoredSebConfigKeys,
    parseStoredSebConfigKeys,
    serializeSebConfigPlist,
} from '@/lib/seb-config';

async function handleGet(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await context?.params;
    const sessionId = resolvedParams?.id;
    
    if (!sessionId) {
        return NextResponse.json({ error: 'ID sesi tidak valid' }, { status: 400 });
    }

    try {
        if (user.role === 'trainee') {
            await verifyEnrollment(sessionId, user.id);
        }
        // Cek sesi dan apakah mewajibkan SEB
        const queryStr = `
             SELECT s.id, s.require_seb, s.seb_config_key, s.title, s.enable_proctoring
             FROM sessions s
             WHERE s.id = ?
             LIMIT 1
        `;
        
        const sessions = await executeQuery<any[]>(queryStr, [sessionId]);

        if (!sessions || sessions.length === 0) {
            return NextResponse.json({ success: false, message: 'Sesi tidak ditemukan' }, { status: 404 });
        }

        const session = sessions[0];
        if (!session.require_seb) {
            return NextResponse.json({ success: false, message: 'Sesi ini tidak mewajibkan SEB' }, { status: 400 });
        }

        // Production must use the configured canonical origin. This prevents a
        // caller-controlled Host/X-Forwarded-Host value from rotating Config Keys.
        const origin = process.env.NODE_ENV === 'production'
            ? getAppBaseUrl()
            : request.nextUrl.origin;
        const startUrl = `${origin}/dashboard/sesi/${encodeURIComponent(session.id)}`;
        const config = buildSebConfig({
            sessionId: session.id,
            startUrl,
            quitUrl: `${origin}/quit-seb`,
            enableProctoring: Boolean(session.enable_proctoring),
        });
        const configKey = calculateSebConfigKey(config);
        // Discard the legacy static environment value. It was not calculated from
        // this plist and must not remain an accepted key after the first v2 download.
        const legacyStaticKey = process.env.SEB_CONFIG_KEY_HASH?.trim().toLowerCase();
        const existingKeys = parseStoredSebConfigKeys(session.seb_config_key)
            .filter((key) => key !== legacyStaticKey)
            .join(',') || null;
        const storedKeys = mergeStoredSebConfigKeys(existingKeys, configKey);
        const sebXML = serializeSebConfigPlist(config);

        // Store the calculated Config Key generated from the exact downloaded plist.
        // Keep the latest three to support a controlled hostname/IP transition without
        // invalidating participants who already opened an earlier copy.
        if (storedKeys !== session.seb_config_key) {
            await executeQuery(
                `UPDATE sessions SET seb_config_key = ? WHERE id = ?`,
                [storedKeys, session.id],
            );
        }

        const safeFilename = String(session.title || 'Ujian')
            .normalize('NFKD')
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80) || 'Ujian';

        return new NextResponse(sebXML, {
            status: 200,
            headers: {
                'Content-Type': 'application/seb',
                'Content-Disposition': `attachment; filename="Ujian_${safeFilename}.seb"`,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-SEB-Config-Version': '2',
            },
        });
    } catch (error) {
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
        }
        logger.error('SEB_CONFIG', 'Gagal membuat file konfigurasi SEB', error);
        return NextResponse.json(
            { success: false, message: 'Gagal membuat konfigurasi Safe Exam Browser. Silakan coba lagi.' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer', 'trainee'] });
