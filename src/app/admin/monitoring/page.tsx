'use client';

import { useState, useEffect } from 'react';
import { Camera01Icon, AlertCircleIcon, Calendar01Icon, RefreshIcon } from 'hugeicons-react';

interface Session {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    module_title: string;
}

interface Snapshot {
    id: string;
    user_id: string;
    session_id: string;
    image_base64: string;
    captured_at: string;
    full_name: string;
    username: string;
}

export default function MonitoringDashboard() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>('');
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (selectedSessionId) {
            fetchSnapshots(selectedSessionId);
            
            // Auto-refresh every 30 seconds
            const interval = setInterval(() => {
                fetchSnapshots(selectedSessionId, true);
            }, 30000);
            
            return () => clearInterval(interval);
        }
    }, [selectedSessionId]);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/monitoring');
            const data = await res.json();
            if (data.success && data.data) {
                setSessions(data.data);
                if (data.data.length > 0 && !selectedSessionId) {
                    setSelectedSessionId(data.data[0].id);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSnapshots = async (sessionId: string, isSilentRefresh = false) => {
        if (!isSilentRefresh) setLoading(true);
        else setRefreshing(true);
        
        try {
            const res = await fetch(`/api/admin/monitoring?session_id=${sessionId}`);
            const data = await res.json();
            if (data.success) {
                setSnapshots(data.data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleManualRefresh = () => {
        if (selectedSessionId) {
            fetchSnapshots(selectedSessionId, true);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Camera01Icon className="text-primary" size={28} />
                        Live Proctoring
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Pantau peserta yang sedang mengikuti ujian menggunakan SEB
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                        className="bg-white border text-sm rounded-xl px-4 py-2 flex-grow sm:flex-grow-0 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                        disabled={loading && !refreshing}
                    >
                        <option value="">Pilih Sesi Ujian</option>
                        {sessions.map((session) => {
                            const now = new Date();
                            const end = new Date(session.end_time);
                            const isActive = now <= end;
                            return (
                                <option key={session.id} value={session.id}>
                                    {isActive ? '🟢 ' : '⚫ '}{session.title} — {session.module_title}
                                </option>
                            );
                        })}
                    </select>

                    <button
                        onClick={handleManualRefresh}
                        disabled={!selectedSessionId || loading}
                        className="flex items-center justify-center gap-2 bg-white text-foreground hover:bg-black/5 p-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 border border-black/10"
                        title="Segarkan Data"
                    >
                        <RefreshIcon size={20} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading && !refreshing ? (
                <div className="flex justify-center items-center h-64">
                    <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
            ) : !selectedSessionId ? (
                <div className="glass-card flex flex-col items-center justify-center h-64 text-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Calendar01Icon size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Tidak ada sesi terpilih</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Silakan pilih sesi ujian dari menu dropdown di atas untuk mulai melihat pemantauan peserta secara live.
                        </p>
                    </div>
                </div>
            ) : snapshots.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center h-64 text-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center text-muted-foreground">
                        <AlertCircleIcon size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Tidak Ada Tangkapan Layar</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Belum ada peserta yang mengambil snapshot webcam pada sesi ini, atau peserta tidak menggunakan Safe Exam Browser.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {snapshots.map((snap) => (
                        <div key={snap.id} className="glass-card overflow-hidden group hover:shadow-lg transition-all border-black/5">
                            <div className="relative aspect-[4/3] bg-black">
                                {/* Base64 Image */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`data:image/jpeg;base64,${snap.image_base64}`}
                                    alt={`Snapshot of ${snap.full_name}`}
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                />
                                
                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100" />
                                
                                {/* Time Badge */}
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-medium px-2 py-1 rounded-md">
                                    {new Date(snap.captured_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </div>
                            </div>
                            <div className="p-3 bg-white">
                                <h3 className="font-bold text-sm truncate text-foreground" title={snap.full_name}>
                                    {snap.full_name}
                                </h3>
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                    {snap.username}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
