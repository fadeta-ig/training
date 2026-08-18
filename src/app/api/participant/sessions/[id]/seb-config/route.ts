import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { escapeHtml } from '@/lib/sanitize';

export const GET = withAuth(async (
    request: NextRequest,
    user,
    context?: { params: Promise<{ id: string }> }
) => {
    const resolvedParams = await context?.params;
    const sessionId = resolvedParams?.id;
    
    if (!sessionId) {
        return NextResponse.json({ error: 'ID sesi tidak valid' }, { status: 400 });
    }

    try {
        // Cek sesi & apakah user terdaftar
        const queryStr = `
             SELECT s.id, s.require_seb, s.seb_config_key, s.title
             FROM sessions s
             JOIN session_participants sp ON s.id = sp.session_id
             WHERE s.id = ? AND sp.user_id = ?
        `;
        
        const sessions = await executeQuery<any[]>(queryStr, [sessionId, user.id]);

        if (sessions.length === 0) {
            return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
        }

        const session = sessions[0];
        if (!session.require_seb) {
            return NextResponse.json({ success: false, message: 'Sesi ini tidak mewajibkan SEB' }, { status: 400 });
        }

        const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!configuredAppUrl && process.env.NODE_ENV === 'production') {
            throw new Error('NEXT_PUBLIC_APP_URL wajib diatur di production');
        }

        const origin = new URL(configuredAppUrl || request.nextUrl.origin).origin;
        const startUrl = `${origin}/dashboard/sesi/${encodeURIComponent(session.id)}`;
        const safeStartUrl = escapeHtml(startUrl);
        const safeQuitUrl = escapeHtml(`${origin}/quit-seb`);
        const safeConfigKey = escapeHtml(session.seb_config_key || '');
        
        // PList XML Generator as per SEB documentation
        const sebXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>origin</key>
    <string>LMS Nusamitra Consulting</string>
    <key>startURL</key>
    <string>${safeStartUrl}</string>
    <key>sendBrowserExamKey</key>
    <true/>
    <key>browserExamKey</key>
    <string>${safeConfigKey}</string>
    <key>quitURL</key>
    <string>${safeQuitUrl}</string>
    <key>allowQuit</key>
    <true/>
    <key>showTaskBar</key>
    <true/>
    <key>showQuitButton</key>
    <true/>
    <key>enableZoomPage</key>
    <true/>
    <key>allowPreferencesWindow</key>
    <false/>
    <key>insideSebEnableSwitchUser</key>
    <false/>
    <key>allowSwitchToThirdPartyApps</key>
    <false/>
    <key>allowDeveloperConsole</key>
    <false/>
  </dict>
</plist>`;

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
            },
        });
    } catch (error) {
        logger.error('SEB_CONFIG', 'Gagal membuat file konfigurasi SEB', error);
        return NextResponse.json(
            { success: false, message: 'Gagal membuat konfigurasi Safe Exam Browser. Silakan coba lagi.' },
            { status: 500 }
        );
    }
}, { allowedRoles: ['trainee'] });
