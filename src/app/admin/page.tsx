import {
    Book01Icon,
    Edit01Icon,
    PlayIcon,
    UserGroupIcon,
    ArrowRight01Icon,
    Calendar01Icon,
    Clock01Icon,
    UserIcon,
} from 'hugeicons-react';
import { ReactNode } from 'react';
import { executeQuery } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type RecentSession = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    participant_count: number;
    module_title: string;
};

export default async function AdminOverviewPage() {
    const [trainings, exams, sessions, trainees, recentSessions] = await Promise.all([
        executeQuery<{ count: number }[]>('SELECT COUNT(*) as count FROM trainings'),
        executeQuery<{ count: number }[]>('SELECT COUNT(*) as count FROM exams'),
        executeQuery<{ count: number }[]>('SELECT COUNT(*) as count FROM sessions'),
        executeQuery<{ count: number }[]>("SELECT COUNT(*) as count FROM users WHERE role = 'trainee'"),
        executeQuery<RecentSession[]>(`
            SELECT s.id, s.title, s.start_time, s.end_time,
                   m.title AS module_title,
                   (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = s.id) AS participant_count
            FROM sessions s
            LEFT JOIN modules m ON s.module_id = m.id
            ORDER BY s.start_time DESC
            LIMIT 5
        `),
    ]);

    const stats = {
        totalTrainings: trainings[0]?.count || 0,
        activeExams: exams[0]?.count || 0,
        ongoingSessions: sessions[0]?.count || 0,
        totalTrainees: trainees[0]?.count || 0,
    };

    const now = new Date();

    function getSessionStatus(start: string, end: string) {
        const s = new Date(start);
        const e = new Date(end);
        if (now < s) return { label: 'Akan Datang', color: 'bg-blue-100 text-blue-700' };
        if (now >= s && now <= e) return { label: 'Sedang Berlangsung', color: 'bg-emerald-100 text-emerald-700' };
        return { label: 'Selesai', color: 'bg-black/5 text-muted-foreground' };
    }

    function formatDateTime(dateStr: string) {
        const d = new Date(dateStr);
        return d.toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    return (
        <div className="space-y-10 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">Overview</h1>
                <p className="text-muted-foreground mt-2 text-sm lg:text-base">Status sistem, sesi berjalan, dan modul pembelajaran saat ini.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard title="Total Materi (Trainings)" value={stats.totalTrainings} trend="Update terbaru" icon={<Book01Icon size={24} />} />
                <StatCard title="Bank Soal (Exams)" value={stats.activeExams} trend="Siap digunakan" icon={<Edit01Icon size={24} />} />
                <StatCard title="Sesi Ujian (Sessions)" value={stats.ongoingSessions} trend="Sesi terdaftar" icon={<PlayIcon size={24} />} />
                <StatCard title="Total Peserta" value={stats.totalTrainees} trend="Aktif di sistem" icon={<UserGroupIcon size={24} />} />
            </div>

            {/* Sesi Terkini & Aksi Cepat */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-5">
                    <h2 className="text-xl font-semibold tracking-tight">Sesi Terkini</h2>

                    {recentSessions.length === 0 ? (
                        <div className="glass-card p-10 flex flex-col items-center justify-center min-h-[300px]">
                            <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                                <Calendar01Icon size={32} className="text-muted-foreground/50" />
                            </div>
                            <p className="text-base text-muted-foreground font-medium">Belum ada sesi yang terdaftar.</p>
                            <p className="text-sm text-muted-foreground/70 mt-1">Sesi ujian baru dapat dibuat melalui menu Session Manager.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentSessions.map((s) => {
                                const status = getSessionStatus(s.start_time, s.end_time);
                                return (
                                    <Link
                                        key={s.id}
                                        href={`/admin/sessions/${s.id}`}
                                        className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 glass-card-hover group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.color}`}>
                                                    {status.label}
                                                </span>
                                                {s.module_title && (
                                                    <span className="text-[10px] font-semibold text-muted-foreground bg-black/5 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                                                        {s.module_title}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-sm font-bold text-foreground truncate group-hover:text-foreground/80 transition-colors">
                                                {s.title}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock01Icon size={12} />
                                                    {formatDateTime(s.start_time)} — {formatDateTime(s.end_time)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-black/5 px-3 py-1.5 rounded-full">
                                                <UserIcon size={12} />
                                                {s.participant_count} Peserta
                                            </div>
                                            <ArrowRight01Icon size={16} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="space-y-5">
                    <h2 className="text-xl font-semibold tracking-tight">Aksi Cepat</h2>
                    <div className="glass-card p-2 flex flex-col gap-1">
                        <ActionRow label="Buat Materi Baru" href="/admin/content/new" />
                        <ActionRow label="Buat Bank Soal" href="/admin/exams/new" />
                        <ActionRow label="Kelola Peserta" href="/admin/participants" />
                        <ActionRow label="Modul Pembelajaran" href="/admin/modules/new" />
                        <ActionRow label="Buat Sesi Baru" href="/admin/sessions/create" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, trend, icon }: { title: string; value: number; trend: string; icon: ReactNode }) {
    return (
        <div className="glass-card p-6 flex items-start justify-between glass-card-hover group cursor-default">
            <div>
                <h3 className="text-3xl font-bold tracking-tight mb-1">{value}</h3>
                <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{title}</p>
                <p className="text-xs text-muted-foreground/80 mt-3">{trend}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-foreground group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                {icon}
            </div>
        </div>
    );
}

function ActionRow({ label, href }: { label: string; href: string }) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 rounded-xl hover:bg-black/5 active:scale-95 transition-all w-full text-left group">
            <span className="text-sm font-semibold">{label}</span>
            <ArrowRight01Icon size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
        </Link>
    );
}
