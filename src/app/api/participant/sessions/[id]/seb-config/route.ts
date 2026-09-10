import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import logger from '@/lib/logger';
import { escapeHtml } from '@/lib/sanitize';

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
             SELECT s.id, s.require_seb, s.seb_config_key, s.title
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
        if (!configuredAppUrl && process.env.NODE_ENV === 'production') {
            throw new Error('NEXT_PUBLIC_APP_URL wajib diatur di production');
        }

        const origin = new URL(configuredAppUrl || request.nextUrl.origin).origin;
        const startUrl = `${origin}/dashboard/sesi/${encodeURIComponent(session.id)}`;
        const safeStartUrl = escapeHtml(startUrl);
        const safeQuitUrl = escapeHtml(`${origin}/quit-seb`);
        const safeConfigKey = escapeHtml(session.seb_config_key || '');
        
        // PList XML Generator as per Safe Exam Browser specification for Windows & macOS
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

    <!-- Camera & Media Proctored Exam Permissions (macOS & Windows SEB 3.x) -->
    <key>allowVideoCapture</key>
    <true/>
    <key>allowAudioCapture</key>
    <false/>
    <key>mediaCaptureRequiresUserGesture</key>
    <false/>

    <!-- Navigation & Safe Recovery in Shared Lab / Wi-Fi -->
    <key>showTaskBar</key>
    <true/>
    <key>showReloadButton</key>
    <true/>
    <key>browserWindowAllowReload</key>
    <true/>
    <key>showQuitButton</key>
    <true/>
    <key>quitURL</key>
    <string>${safeQuitUrl}</string>
    <key>quitURLConfirm</key>
    <true/>
    <key>allowQuit</key>
    <true/>
    <key>showTime</key>
    <true/>
    <key>showNetworkInfo</key>
    <true/>
    <key>showBatteryInfo</key>
    <true/>
    <key>enableZoomPage</key>
    <true/>

    <!-- Security & Anti-Cheating Lockdown (macOS & Windows) -->
    <key>allowPreferencesWindow</key>
    <false/>
    <key>insideSebEnableSwitchUser</key>
    <false/>
    <key>allowSwitchToThirdPartyApps</key>
    <false/>
    <key>allowDeveloperConsole</key>
    <false/>
    <key>allowSpellCheck</key>
    <false/>
    <key>allowDictionaryLookup</key>
    <false/>

    <!-- Windows Specific Key Interceptions -->
    <key>hookKeys</key>
    <true/>
    <key>enableAltTab</key>
    <false/>
    <key>enableCtrlEsc</key>
    <false/>
    <key>enableStartMenu</key>
    <false/>
    <key>enablePrintScreen</key>
    <false/>
    <key>enableF5</key>
    <true/>

    <!-- macOS Specific Screen Capture Protections -->
    <key>prohibitWindowCapture</key>
    <true/>
    <key>prohibitScreenSharing</key>
    <true/>
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
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
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
