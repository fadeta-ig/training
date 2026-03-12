import Link from 'next/link';
import { cookies } from 'next/headers';
import { executeQuery } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import {
    Calendar01Icon,
    Mortarboard01Icon,
    Tick01Icon,
    PlayIcon,
    ArrowRight01Icon,
    BookOpen01Icon,
} from 'hugeicons-react';
import DashboardCalendar from './_components/DashboardCalendar';

type Session = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    module_title: string;
    total_items: number;
    completed_items: number;
};

// RSC Fetch Logic
async function getSessions() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('training_session')?.value;
        if (!token) return [];

        const payload = await verifyToken(token);
        if (!payload || !payload.sub) return [];
        const userId = payload.sub;

        const query = `
            SELECT 
                s.id, s.title, s.start_time, s.end_time,
                m.title as module_title,
                (SELECT COUNT(*) FROM module_items mi WHERE mi.module_id = m.id) as total_items,
                (SELECT COUNT(*) FROM user_progress up 
                 WHERE up.user_id = ? AND up.session_id = s.id AND up.status = 'completed') as completed_items
            FROM sessions s
            JOIN modules m ON s.module_id = m.id
            JOIN session_participants sp ON s.id = sp.session_id
            WHERE sp.user_id = ?
            ORDER BY s.start_time ASC
        `;

        const data = await executeQuery<Session[]>(query, [userId, userId]);
        return data || [];
    } catch {
        return [];
    }
}

export default async function DashboardOverviewPage() {
    const sessions = await getSessions();
    const now = new Date();

    function getStatus(s: Session) {
        if (s.total_items > 0 && s.completed_items >= s.total_items) return 'completed';
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'active';
        return 'ended';
    }

    const activeCount = sessions.filter(s => getStatus(s) === 'active').length;
    const completedCount = sessions.filter(s => getStatus(s) === 'completed').length;
    const upcomingCount = sessions.filter(s => getStatus(s) === 'upcoming').length;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Ringkasan progres pelatihan dan jadwal terdekat Anda.
                </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-6 flex items-center gap-5 relative overflow-hidden group hover:border-emerald-200 transition-colors">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <PlayIcon size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Berjalan</p>
                        <h3 className="text-3xl font-bold">{activeCount}</h3>
                    </div>
                    {/* Decorative Background */}
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                </div>

                <div className="glass-card p-6 flex items-center gap-5 relative overflow-hidden group hover:border-black/20 transition-colors">
                    <div className="w-14 h-14 rounded-2xl bg-black/5 text-foreground flex items-center justify-center shrink-0">
                        <Calendar01Icon size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Akan Datang</p>
                        <h3 className="text-3xl font-bold">{upcomingCount}</h3>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-black/10 rounded-full blur-2xl group-hover:bg-black/20 transition-all"></div>
                </div>

                <div className="glass-card p-6 flex items-center gap-5 relative overflow-hidden group hover:border-blue-200 transition-colors">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Tick01Icon size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Selesai</p>
                        <h3 className="text-3xl font-bold">{completedCount}</h3>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                </div>
            </div>

            {/* Layout Grid: Calendar & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Calendar View (Client Component) */}
                <DashboardCalendar sessions={sessions} />

                {/* Quick Actions / Shortcut */}
                <div className="space-y-6">
                    <div className="glass-card p-6 !bg-[#111111] text-white relative overflow-hidden">
                        <div className="relative z-10 space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Mortarboard01Icon size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Lanjutkan Belajar</h3>
                                <p className="text-sm text-white/80 mt-1 mb-4 leading-relaxed">
                                    Jangan tunda penyelesaian materi dan ujian Anda. Cek sesi aktif Anda sekarang.
                                </p>
                                <Link href="/dashboard/sesi" className="inline-flex items-center gap-2 bg-white text-[#111111] px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors w-full justify-center">
                                    Lihat Sesi Aktif
                                    <ArrowRight01Icon size={16} />
                                </Link>
                            </div>
                        </div>
                        {/* Decorative Circle */}
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border-[20px] border-white/10"></div>
                        <div className="absolute -left-12 -bottom-12 w-40 h-40 rounded-full bg-white/5 blur-3xl"></div>
                    </div>

                    {/* Mini List */}
                    <div className="glass-card p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold">Terbaru</h3>
                            <Link href="/dashboard/sesi" className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Lihat Semua</Link>
                        </div>
                        <div className="space-y-3">
                            {sessions.slice(0, 4).map(s => (
                                <Link key={s.id} href={`/dashboard/sesi/${s.id}`} className="flex items-start gap-3 p-2 rounded-xl hover:bg-black/5 transition-colors group">
                                    <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                                        <BookOpen01Icon size={16} className="text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate group-hover:text-foreground">{s.title}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{s.module_title}</p>
                                    </div>
                                </Link>
                            ))}
                            {sessions.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-4 bg-black/5 rounded-xl">Belum ada aktivitas</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
