import {
    Book01Icon,
    Edit01Icon,
    PlayIcon,
    UserGroupIcon,
    ArrowRight01Icon,
    Calendar01Icon
} from 'hugeicons-react';
import { ReactNode } from 'react';

export default function AdminOverviewPage() {
    return (
        <div className="space-y-10 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">Overview</h1>
                <p className="text-muted-foreground mt-2 text-sm lg:text-base">System status, ongoing sessions, and modular statistics.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard title="Total Trainings" value="24" trend="+3 this week" icon={<Book01Icon size={24} />} />
                <StatCard title="Active Exams" value="12" trend="0 changes" icon={<Edit01Icon size={24} />} />
                <StatCard title="Ongoing Sessions" value="5" trend="+1 today" icon={<PlayIcon size={24} />} />
                <StatCard title="Total Trainees" value="1,248" trend="+15 this month" icon={<UserGroupIcon size={24} />} />
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-5">
                    <h2 className="text-xl font-semibold tracking-tight">Recent Sessions</h2>
                    <div className="glass-card p-10 flex flex-col items-center justify-center min-h-[300px]">
                        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                            <Calendar01Icon size={32} className="text-muted-foreground/50" />
                        </div>
                        <p className="text-base text-muted-foreground font-medium">No active sessions running currently.</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Start a new session from the Session Manager.</p>
                    </div>
                </div>

                <div className="space-y-5">
                    <h2 className="text-xl font-semibold tracking-tight">Quick Actions</h2>
                    <div className="glass-card p-2 flex flex-col gap-1">
                        <ActionRow label="Create New Training" />
                        <ActionRow label="Build Learning Module" />
                        <ActionRow label="Start Exam Session" />
                        <ActionRow label="Review Proctoring Logs" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, trend, icon }: { title: string; value: string; trend: string; icon: ReactNode }) {
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

function ActionRow({ label }: { label: string }) {
    return (
        <button className="flex items-center justify-between p-4 rounded-xl hover:bg-black/5 active:scale-95 transition-all w-full text-left group">
            <span className="text-sm font-semibold">{label}</span>
            <ArrowRight01Icon size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
        </button>
    );
}
