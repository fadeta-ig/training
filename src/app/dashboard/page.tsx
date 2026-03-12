'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Calendar01Icon,
    Mortarboard01Icon,
    Tick01Icon,
    PlayIcon,
    ArrowRight01Icon,
    BookOpen01Icon,
} from 'hugeicons-react';

type Session = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    module_title: string;
    total_items: number;
    completed_items: number;
};

export default function DashboardOverviewPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        fetch('/api/participant/sessions')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setSessions(data.data);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

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

    // Calendar Logic
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Adjust to start on Sunday

    const calendarDays = [];
    let currentDayIter = new Date(startDate);
    while (currentDayIter <= endOfMonth || calendarDays.length % 7 !== 0) {
        calendarDays.push(new Date(currentDayIter));
        currentDayIter.setDate(currentDayIter.getDate() + 1);
    }

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

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

                {/* Calendar View */}
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold flex items-center gap-2">
                            <Calendar01Icon size={20} className="text-muted-foreground" />
                            Jadwal Pelatihan
                        </h2>
                        <div className="flex items-center gap-3">
                            <button onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center border hover:bg-black/5 transition-colors">&lt;</button>
                            <span className="text-sm font-bold w-32 text-center">
                                {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={nextMonth} className="w-8 h-8 rounded-lg flex items-center justify-center border hover:bg-black/5 transition-colors">&gt;</button>
                        </div>
                    </div>

                    {/* Calendar Grid */}
                    <div>
                        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-muted-foreground">
                            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                                <div key={d} className="py-2">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {calendarDays.map((date, idx) => {
                                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                                const isToday = date.toDateString() === now.toDateString();

                                // Find events for this day
                                const dayEvents = sessions.filter(s => {
                                    const st = new Date(s.start_time);
                                    const en = new Date(s.end_time);
                                    // Treat as event if the day falls between start and end inclusive
                                    const dStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                    const dEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                                    return (st <= dEnd && en >= dStart);
                                });

                                return (
                                    <div
                                        key={idx}
                                        className={`min-h-24 p-2 rounded-xl border transition-all 
                                            ${!isCurrentMonth ? 'opacity-40 bg-black/5' : 'bg-white/50 hover:border-black/20'} 
                                            ${isToday ? 'ring-2 ring-foreground border-transparent shadow-sm' : 'border-black/10'}`}
                                    >
                                        <div className={`text-xs font-bold mb-1.5 ${isToday ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {date.getDate()}
                                        </div>
                                        <div className="space-y-1">
                                            {dayEvents.slice(0, 2).map(ev => {
                                                const status = getStatus(ev);
                                                const bg = status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                    : status === 'ended' || status === 'completed' ? 'bg-black/5 text-muted-foreground border border-black/10'
                                                        : 'bg-blue-100 text-blue-800 border border-blue-200';
                                                return (
                                                    <Link key={ev.id} href={`/dashboard/sesi/${ev.id}`} title={ev.title}
                                                        className={`block px-1.5 py-1 text-[10px] font-semibold rounded shrink-0 truncate transition-colors hover:brightness-95 ${bg}`}>
                                                        {ev.title}
                                                    </Link>
                                                )
                                            })}
                                            {dayEvents.length > 2 && (
                                                <div className="text-[10px] font-bold text-muted-foreground px-1">
                                                    +{dayEvents.length - 2} sesi
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Quick Actions / Shortcut */}
                <div className="space-y-6">
                    <div className="glass-card p-6 bg-foreground text-background relative overflow-hidden">
                        <div className="relative z-10 space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Mortarboard01Icon size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Lanjutkan Belajar</h3>
                                <p className="text-sm text-background/80 mt-1 mb-4 leading-relaxed">
                                    Jangan tunda penyelesaian materi dan ujian Anda. Cek sesi aktif Anda sekarang.
                                </p>
                                <Link href="/dashboard/sesi" className="inline-flex items-center gap-2 bg-background text-foreground px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors w-full justify-center">
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
