'use client';

import { useState, useEffect, FormEvent, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    FloppyDiskIcon,
    AlertCircleIcon,
    Tick02Icon,
    Calendar02Icon,
} from 'hugeicons-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import {
    ParticipantEnrollmentPicker,
    ParticipantItem,
} from '@/components/admin/ParticipantEnrollmentPicker';
import { formatIsoToWibInput } from '@/lib/timezone';

type Module = { id: string; title: string };
type SessionOption = { id: string; title: string; module_id?: string; session_type?: 'regular' | 'remedial' };

export default function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form Data
    const [title, setTitle] = useState('');
    const [moduleId, setModuleId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [requireSeb, setRequireSeb] = useState(false);
    const [showScore, setShowScore] = useState(true);
    const [enableProctoring, setEnableProctoring] = useState(true);
    const [sessionType, setSessionType] = useState<'regular' | 'remedial'>('regular');
    const [parentSessionId, setParentSessionId] = useState('');
    const [remedialCycle, setRemedialCycle] = useState(1);

    // Enrollments
    const [availableModules, setAvailableModules] = useState<Module[]>([]);
    const [availableParentSessions, setAvailableParentSessions] = useState<SessionOption[]>([]);
    const [availableUsers, setAvailableUsers] = useState<ParticipantItem[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoadingParticipants(true);
            try {
                // Fetch Modules
                const modRes = await fetch('/api/modules?limit=100');
                const modData = await modRes.json();
                if (modData.success) setAvailableModules(modData.data);

                const listSessionRes = await fetch('/api/sessions');
                const listSessionData = await listSessionRes.json();
                if (listSessionData.success) {
                    setAvailableParentSessions(listSessionData.data.filter((item: SessionOption) => item.id !== resolvedParams.id && (item.session_type || 'regular') === 'regular'));
                }

                // Fetch Users (Participants / Trainees) up to 10,000 for full picker capability
                const usrRes = await fetch('/api/admin/participants?limit=10000');
                const usrData = await usrRes.json();
                if (usrData.success) {
                    const participants: ParticipantItem[] = usrData.data.map((p: any) => ({
                        id: p.id,
                        username: p.email || p.username,
                        email: p.email,
                        full_name: p.name || p.full_name,
                        nip: p.nip || null,
                        batch: p.batch || null,
                        registration_date: p.registration_date || null,
                        institution: p.institution || null,
                        gender: p.gender || null,
                        phone_number: p.phone_number || null,
                        created_at: p.created_at,
                    }));
                    setAvailableUsers(participants);
                }

                // Fetch Current Session Data
                const sessRes = await fetch(`/api/sessions/${resolvedParams.id}`);
                const sessData = await sessRes.json();

                if (sessData.success) {
                    const session = sessData.data;
                    setTitle(session.title);
                    setModuleId(session.module_id);

                    if (session.start_time) {
                        setStartTime(formatIsoToWibInput(session.start_time));
                    }
                    if (session.end_time) {
                        setEndTime(formatIsoToWibInput(session.end_time));
                    }

                    setRequireSeb(Boolean(session.require_seb));
                    setShowScore(session.show_score === 1 || session.show_score === true || session.show_score === '1');
                    setEnableProctoring(session.enable_proctoring === 1 || session.enable_proctoring === true || session.enable_proctoring === '1');
                    setSessionType(session.session_type || 'regular');
                    setParentSessionId(session.parent_session_id || '');
                    setRemedialCycle(Number(session.remedial_cycle || 1));

                    if (session.participants && Array.isArray(session.participants)) {
                        setSelectedUserIds(session.participants.map((p: any) => p.id));
                    }
                } else {
                    setError('Sesi tidak ditemukan atau gagal dimuat');
                }
            } catch {
                console.error('Failed to fetch reference data');
                setError('Kesalahan jaringan saat memuat data referensi');
            } finally {
                setInitialLoading(false);
                setIsLoadingParticipants(false);
                setIsInitialLoad(false);
            }
        };
        fetchInitialData();
    }, [resolvedParams.id]);

    // Auto-sync module when parent session is changed by user (not on initial load)
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    useEffect(() => {
        if (isInitialLoad || sessionType !== 'remedial' || !parentSessionId) return;
        const parentSession = availableParentSessions.find((s) => s.id === parentSessionId);
        if (parentSession?.module_id) {
            setModuleId(parentSession.module_id);
        }
    }, [parentSessionId, sessionType, availableParentSessions, isInitialLoad]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title || !moduleId || !startTime || !endTime) {
            setError('Semua kolom wajib diisi');
            return;
        }

        if (new Date(endTime) <= new Date(startTime)) {
            setError('Waktu selesai harus lebih besar dari waktu mulai');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                title,
                module_id: moduleId,
                start_time: startTime,
                end_time: endTime,
                session_type: sessionType,
                parent_session_id: sessionType === 'remedial' ? parentSessionId : null,
                remedial_cycle: sessionType === 'remedial' ? remedialCycle : 0,
                require_seb: requireSeb,
                show_score: showScore,
                enable_proctoring: enableProctoring,
                participant_ids: selectedUserIds,
            };

            const res = await fetch(`/api/sessions/${resolvedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Gagal memperbarui sesi');
            }

            router.push('/admin/sessions');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin dark:border-slate-700 dark:border-t-white"></div>
                <p className="text-sm font-medium text-muted-foreground">Memuat data sesi...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <Link
                href="/admin/sessions"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
                <ArrowLeft01Icon size={16} />
                Kembali ke Daftar Sesi
            </Link>

            <PageHeader
                title="Edit Sesi Pelatihan / Ujian"
                description={`Memperbarui jadwal, konfigurasi, dan daftar peserta untuk sesi "${title}".`}
                icon={<Calendar02Icon size={28} />}
            />

            {error && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl flex items-start gap-3 text-sm font-medium border border-destructive/20">
                    <AlertCircleIcon size={18} className="mt-0.5 shrink-0" />
                    <div>
                        <p>{error}</p>
                        {sessionType === 'remedial' && error.includes('exam') && (
                            <p className="mt-1 text-xs font-normal opacity-80">
                                Pastikan setiap exam di modul remedial dapat dipetakan ke exam di modul sesi induk. Jika menggunakan modul yang sama, aktifkan &quot;Izinkan Pelaksanaan Remidi Ujian&quot; di halaman{' '}
                                <Link href="/admin/exams" className="underline font-semibold hover:opacity-100">Edit Ujian</Link>.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Bagian 1: Info Dasar */}
                <GlassCard className="p-6 md:p-8">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-black/5 pb-4">
                        <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                            1
                        </span>
                        Informasi Dasar Sesi
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-foreground">
                                Judul Sesi <span className="text-destructive">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Jenis Sesi</label>
                            <select value={sessionType} onChange={(event) => setSessionType(event.target.value as 'regular' | 'remedial')} className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium">
                                <option value="regular">Sesi Utama</option>
                                <option value="remedial">Sesi Remedial</option>
                            </select>
                        </div>

                        {sessionType === 'remedial' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Sesi Induk <span className="text-destructive">*</span></label>
                                    <select required value={parentSessionId} onChange={(event) => setParentSessionId(event.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium">
                                        <option value="">-- Pilih Sesi Utama --</option>
                                        {availableParentSessions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Siklus Remedial</label>
                                    <input type="number" min={1} max={20} value={remedialCycle} onChange={(event) => setRemedialCycle(Number(event.target.value) || 1)} className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                                    <p className="text-xs text-muted-foreground">Modul remedial harus memakai exam yang telah dipilih sebagai paket remedial pada exam sesi induk.</p>
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                                Modul / Materi Ujian <span className="text-destructive">*</span>
                            </label>
                            <select
                                required
                                value={moduleId}
                                onChange={(e) => setModuleId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
                            >
                                <option value="" disabled>
                                    -- Pilih Modul --
                                </option>
                                {availableModules.map((mod) => (
                                    <option key={mod.id} value={mod.id}>
                                        {mod.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col justify-end space-y-2 pb-2">
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-black/10 bg-white/50 hover:bg-black/5 transition-colors">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={requireSeb}
                                        onChange={(e) => setRequireSeb(e.target.checked)}
                                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary appearance-none checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                                    />
                                    <Tick02Icon
                                        size={14}
                                        className={`absolute text-white pointer-events-none transition-opacity left-0.5 top-0.5 ${
                                            requireSeb ? 'opacity-100' : 'opacity-0'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Aktifkan Safe Exam Browser (SEB)
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Mewajibkan peserta menggunakan aplikasi SEB untuk mencegah kecurangan ujian.
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="flex flex-col justify-end space-y-2 pb-2">
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-black/10 bg-white/50 hover:bg-black/5 transition-colors">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={showScore}
                                        disabled
                                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary appearance-none checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                                    />
                                    <Tick02Icon
                                        size={14}
                                        className={`absolute text-white pointer-events-none transition-opacity left-0.5 top-0.5 ${
                                            showScore ? 'opacity-100' : 'opacity-0'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Visibilitas Dikelola dari Session Manager
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Gunakan Publikasikan Hasil atau Buka Revisi pada halaman detail sesi.
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="flex flex-col justify-end space-y-2 pb-2">
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-black/10 bg-white/50 hover:bg-black/5 transition-colors">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={enableProctoring}
                                        onChange={(e) => setEnableProctoring(e.target.checked)}
                                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary appearance-none checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                                    />
                                    <Tick02Icon
                                        size={14}
                                        className={`absolute text-white pointer-events-none transition-opacity left-0.5 top-0.5 ${
                                            enableProctoring ? 'opacity-100' : 'opacity-0'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Aktifkan Kamera Proctoring (Webcam)
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Mengambil foto webcam peserta secara periodik selama ujian berlangsung untuk pengawasan daring.
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-foreground">
                                    Waktu Mulai <span className="text-destructive">*</span>
                                </label>
                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                    WIB (UTC+7)
                                </span>
                            </div>
                            <input
                                type="datetime-local"
                                required
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Mengacu pada WIB. Peserta di WITA (+1 jam) dan WIT (+2 jam) otomatis disinkronkan.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-foreground">
                                    Waktu Selesai <span className="text-destructive">*</span>
                                </label>
                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                    WIB (UTC+7)
                                </span>
                            </div>
                            <input
                                type="datetime-local"
                                required
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            />
                        </div>
                    </div>
                </GlassCard>

                {/* Bagian 2: Enrollment Peserta (Modular & Rich Filtering) */}
                {sessionType === 'regular' ? (
                    <ParticipantEnrollmentPicker
                        participants={availableUsers}
                        selectedUserIds={selectedUserIds}
                        onSelectionChange={setSelectedUserIds}
                        isLoading={isLoadingParticipants}
                        stepNumber={2}
                        title="Enrollment Peserta"
                        description="Pilih dan tandai peserta yang berhak mengikuti sesi ini dengan filter cerdas."
                    />
                ) : (
                    <GlassCard className="p-5 border-amber-200 bg-amber-50/60">
                        <h2 className="font-bold text-amber-950">Enrollment remedial dikelola otomatis</h2>
                        <p className="mt-1 text-sm text-amber-800">Peserta dan exam yang ditugaskan berasal dari publikasi hasil sesi induk dan tidak dapat diedit manual.</p>
                    </GlassCard>
                )}

                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4">
                    <Link
                        href={`/admin/sessions/${resolvedParams.id}`}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 text-sm font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                    >
                        Batal
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-xs hover:shadow-sm border border-blue-700/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <FloppyDiskIcon size={18} />
                                <span>Perbarui Sesi & Peserta</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
