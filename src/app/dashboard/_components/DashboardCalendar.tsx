'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar01Icon, ArrowLeft01Icon, ArrowRight01Icon } from 'hugeicons-react';

type Session = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    module_title: string;
    total_items: number;
    completed_items: number;
};

export default function DashboardCalendar({ sessions }: { sessions: Session[] }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const now = new Date();

    function getStatus(s: Session) {
        if (s.total_items > 0 && s.completed_items >= s.total_items) return 'completed';
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'active';
        return 'ended';
    }

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

    return (
        <div className="lg:col-span-2 glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold flex items-center gap-2">
                    <Calendar01Icon size={20} className="text-muted-foreground" />
                    Jadwal Pelatihan
                </h2>
                <div className="flex items-center gap-3">
                    <button onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center border border-black/10 hover:bg-black/5 transition-colors text-muted-foreground hover:text-foreground"><ArrowLeft01Icon size={16} /></button>
                    <span className="text-sm font-bold w-32 text-center">
                        {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={nextMonth} className="w-8 h-8 rounded-lg flex items-center justify-center border border-black/10 hover:bg-black/5 transition-colors text-muted-foreground hover:text-foreground"><ArrowRight01Icon size={16} /></button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div>
                <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-muted-foreground">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                        <div key={d} className="py-2">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((date, idx) => {
                        const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                        const isToday = date.toDateString() === now.toDateString();

                        // Find events for this day
                        const dayEvents = sessions.filter(s => {
                            const st = new Date(s.start_time);
                            const en = new Date(s.end_time);
                            const dStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                            const dEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                            return (st <= dEnd && en >= dStart);
                        });

                        const hasEvents = dayEvents.length > 0;

                        return (
                            <div
                                key={idx}
                                className={`min-h-[80px] p-1.5 rounded-xl border transition-all flex flex-col group
                                    ${!isCurrentMonth ? 'opacity-30 bg-black/5' : 'bg-white/40 hover:bg-white'} 
                                    ${isToday ? 'border-foreground/30 shadow-sm ring-1 ring-foreground/20' : 'border-black/5 hover:border-black/10 hover:shadow-sm'}`}
                            >
                                <div className="flex justify-between items-start mb-1 px-1">
                                    <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-foreground text-background shadow-sm' : 'text-foreground/70 group-hover:text-foreground'}`}>
                                        {date.getDate()}
                                    </span>
                                    {hasEvents && (
                                        <div className="flex gap-0.5 mt-1.5">
                                            {dayEvents.slice(0, 3).map((ev, i) => {
                                                const status = getStatus(ev);
                                                const bg = status === 'active' ? 'bg-emerald-500' : status === 'ended' || status === 'completed' ? 'bg-black/20' : 'bg-blue-500';
                                                return <div key={i} className={`w-1 h-1 rounded-full ${bg}`} />
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-0.5 px-0.5 mt-1">
                                    {dayEvents.slice(0, 2).map(ev => {
                                        const status = getStatus(ev);
                                        const bg = status === 'active' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                            : status === 'ended' || status === 'completed' ? 'bg-black/5 text-muted-foreground hover:bg-black/10'
                                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100';
                                        return (
                                            <Link key={ev.id} href={`/dashboard/sesi/${ev.id}`} title={ev.title}
                                                className={`block px-1.5 py-1 text-[9px] font-medium rounded transition-colors truncate ${bg}`}>
                                                {ev.title}
                                            </Link>
                                        )
                                    })}
                                    {dayEvents.length > 2 && (
                                        <div className="text-[9px] font-medium text-muted-foreground px-1 mt-0.5">
                                            +{dayEvents.length - 2} lagi
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
