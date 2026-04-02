import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';

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

        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const startUrl = `${origin}/dashboard/sesi/${session.id}`;
        
        // PList XML Generator as per SEB documentation
        const sebXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>origin</key>
    <string>WIG Antigravity LMS</string>
    <key>startURL</key>
    <string>${startUrl}</string>
    <key>sendBrowserExamKey</key>
    <true/>
    <key>browserExamKey</key>
    <string>${session.seb_config_key || ''}</string>
    <key>quitURL</key>
    <string>${origin}/dashboard/riwayat</string>
    <key>allowQuit</key>
    <true/>
    <key>showTaskBar</key>
    <false/>
    <key>enableZoomPage</key>
    <true/>
  </dict>
</plist>`;

        return new NextResponse(sebXML, {
            status: 200,
            headers: {
                'Content-Type': 'application/seb',
                'Content-Disposition': `attachment; filename="Ujian_${session.title.replace(/\s+/g, '_')}.seb"`,
            },
        });
    } catch (error) {
        console.error('SEB Generator Error:', error);
        return NextResponse.json(
            { success: false, message: 'Terjadi kesalahan sistem' },
            { status: 500 }
        );
    }
}, { allowedRoles: ['trainee', 'admin', 'trainer'] });
