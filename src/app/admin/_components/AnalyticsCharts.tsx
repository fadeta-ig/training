"use client";

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

interface AnalyticsChartsProps {
  trendData: { name: string; partisipasi: number }[];
  ratioData: { name: string; value: number }[];
}

const COLORS = ['#10b981', '#f43f5e']; // Emerald-500 (Pass), Rose-500 (Fail)

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background/80 backdrop-blur-md border border-border p-3 rounded-lg shadow-xl text-xs font-medium text-foreground">
                <p className="mb-1 opacity-70">{label}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} style={{ color: p.color }}>
                        {p.name}: <span className="font-bold text-foreground">{p.value}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export function AnalyticsCharts({ trendData, ratioData }: AnalyticsChartsProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Laporan Aktivitas Mingguan */}
            <div className="lg:col-span-2 glass-card p-6 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-full h-full flex flex-col">
                    <h2 className="text-lg font-semibold tracking-tight mb-6">Aktivitas Ujian (14 Hari Terakhir)</h2>
                    {trendData.length > 0 ? (
                        <div className="flex-1 w-full min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 12, className: 'fill-muted-foreground' }} 
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 12, className: 'fill-muted-foreground' }} 
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line 
                                        type="monotone" 
                                        dataKey="partisipasi" 
                                        name="Modul Diselesaikan"
                                        stroke="#3b82f6" 
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Belum ada data aktivitas.</div>
                    )}
                </div>
            </div>

            {/* Rasio Kelulusan */}
            <div className="glass-card p-6 flex flex-col min-h-[400px]">
                <h2 className="text-lg font-semibold tracking-tight mb-2">Rasio Kelulusan Rasio</h2>
                <p className="text-xs text-muted-foreground mb-6">Total partisipasi ujian yang mencapai KKM.</p>
                <div className="flex-1 w-full min-h-[250px] relative flex flex-col items-center justify-center">
                    {ratioData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={ratioData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        stroke="transparent"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {ratioData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Lulus' ? COLORS[0] : COLORS[1]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Inner Circle Label overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center pb-8">
                                    <span className="block text-2xl font-bold">
                                        {(() => {
                                            const passed = ratioData.find(d => d.name === 'Lulus')?.value || 0;
                                            const total = ratioData.reduce((acc, curr) => acc + curr.value, 0);
                                            return total > 0 ? Math.round((passed / total) * 100) + '%' : '0%';
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">Belum ada data nilai ujian terlaporkan.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
