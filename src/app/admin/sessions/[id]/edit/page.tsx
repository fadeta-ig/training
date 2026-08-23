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

type Module = { id: string; title: string };

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

    // Enrollments
    const [availableModules, setAvailableModules] = useState<Module[]>([]);
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

                    // Because dates from DB are sent as ISO but we want to show local time in the input
                    if (session.start_time) {
                        const startObj = new Date(session.start_time);
                        const localStart = new Date(
                            startObj.getTime() - startObj.getTimezoneOffset() * 60000
                        )
                            .toISOString()
                            .slice(0, 16);
                        setStartTime(localStart);
                    }
                    if (session.end_time) {
                        const endObj = new Date(session.end_time);
                        const localEnd = new Date(
                            endObj.getTime() - endObj.getTimezoneOffset() * 60000
                        )
                            .toISOString()
                            .slice(0, 16);
                        setEndTime(localEnd);
                    }

                    setRequireSeb(!!session.require_seb);
                    setShowScore(session.show_score !== false);
                    setEnableProctoring(session.enable_proctoring !== false);

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
            }
        };
        fetchInitialData();
    }, [resolvedParams.id]);

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
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
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
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium border border-destructive/20">
                    <AlertCircleIcon size={18} />
                    {error}
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
                                        onChange={(e) => setShowScore(e.target.checked)}
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
                                        Tampilkan Nilai ke Peserta
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Jika dinonaktifkan, peserta tidak akan dapat melihat skor/nilai ujian mereka.
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
                            <label className="text-sm font-medium text-foreground">
                                Waktu Mulai <span className="text-destructive">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                                Waktu Selesai <span className="text-destructive">*</span>
                            </label>
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
                <ParticipantEnrollmentPicker
                    participants={availableUsers}
                    selectedUserIds={selectedUserIds}
                    onSelectionChange={setSelectedUserIds}
                    isLoading={isLoadingParticipants}
                    stepNumber={2}
                    title="Enrollment Peserta"
                    description="Pilih dan tandai peserta yang berhak mengikuti sesi ini dengan filter cerdas."
                />

                <div className="flex justify-stretch pt-4 sm:justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg disabled:opacity-50 sm:w-auto sm:min-w-[200px] cursor-pointer"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <FloppyDiskIcon size={20} />
                                Perbarui Sesi & Peserta
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
