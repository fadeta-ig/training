import {
    Book01Icon,
    Edit01Icon,
    PlayIcon,
    UserGroupIcon,
    ArrowRight01Icon,
    Calendar01Icon
} from 'hugeicons-react';
import { ReactNode } from 'react';
import { executeQuery } from '@/lib/db';
import Link from 'next/link';

// Make this a dynamic server component to fetch real-time fresh data
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
    // Fetch live statistics in parallel
    const [trainings, exams, sessions, trainees] = await Promise.all([
        executeQuery<{ count: number }[]>('SELECT COUNT(*) as count FROM trainings'),
        executeQuery<{ count: number }[]>('SELECT COUNT(*) as count FROM exams'),
        executeQuery<{ count: number }[]>('SELECT COUNT(*) as count FROM sessions'),
        executeQuery<{ count: number }[]>('SELECT COUNT(*) as count FROM users WHERE role = "participant"')
    ]);

    const stats = {
        totalTrainings: trainings[0]?.count || 0,
        activeExams: exams[0]?.count || 0,
        ongoingSessions: sessions[0]?.count || 0,
        totalTrainees: trainees[0]?.count || 0
    };

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

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-5">
                    <h2 className="text-xl font-semibold tracking-tight">Sesi Terkini</h2>
                    <div className="glass-card p-10 flex flex-col items-center justify-center min-h-[300px]">
                        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                            <Calendar01Icon size={32} className="text-muted-foreground/50" />
                        </div>
                        <p className="text-base text-muted-foreground font-medium">Belum ada sesi yang berjalan saat ini.</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Sesi ujian baru dapat dibuat melalui menu Session Manager.</p>
                    </div>
                </div>

                <div className="space-y-5">
                    <h2 className="text-xl font-semibold tracking-tight">Aksi Cepat</h2>
                    <div className="glass-card p-2 flex flex-col gap-1">
                        <ActionRow label="Buat Materi Baru" href="/admin/content/new" />
                        <ActionRow label="Buat Bank Soal" href="/admin/exams/new" />
                        <ActionRow label="Kelola Peserta" href="/admin/users/new" />
                        <ActionRow label="Modul Pembelajaran" href="/admin/modules/new" />
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

function ActionRow({ label, href }: { label: string, href: string }) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 rounded-xl hover:bg-black/5 active:scale-95 transition-all w-full text-left group">
            <span className="text-sm font-semibold">{label}</span>
            <ArrowRight01Icon size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
        </Link>
    );
}
