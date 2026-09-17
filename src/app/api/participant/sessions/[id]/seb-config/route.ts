import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import logger from '@/lib/logger';
import {
    buildSebConfig,
    calculateSebConfigKey,
    mergeStoredSebConfigKeys,
    parseStoredSebConfigKeys,
    serializeSebConfigPlist,
} from '@/lib/seb-config';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await context?.params;
    const sessionId = resolvedParams?.id;
    
    if (!sessionId) {
        return NextResponse.json({ error: 'ID sesi tidak valid' }, { status: 400 });
    }

    try {
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

        const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
        const proto = request.headers.get('x-forwarded-proto') || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
        const requestOrigin = `${proto}://${host}`;

        let origin: string;
        // Only prioritize configuredAppUrl if it is a production domain (not localhost/127.0.0.1)
        // This ensures remote devices (like MacBooks on LAN) get the correct network IP/host instead of unreachable localhost.
        if (configuredAppUrl && !configuredAppUrl.includes('localhost') && !configuredAppUrl.includes('127.0.0.1')) {
            origin = new URL(configuredAppUrl).origin;
        } else {
            origin = requestOrigin;
        }
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
        logger.error('SEB_CONFIG', 'Gagal membuat file konfigurasi SEB', error);
        return NextResponse.json(
            { success: false, message: 'Gagal membuat konfigurasi Safe Exam Browser. Silakan coba lagi.' },
            { status: 500 }
        );
    }
}
