'use client';

import { useState, useEffect, FormEvent, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft01Icon, FloppyDiskIcon, AlertCircleIcon, Tick02Icon, Calendar02Icon } from 'hugeicons-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';

type User = { id: string; username: string; full_name: string; role: string };
type Module = { id: string; title: string };

export default function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form Data
    const [title, setTitle] = useState('');
    const [moduleId, setModuleId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [requireSeb, setRequireSeb] = useState(false);

    // Enrollments
    const [availableModules, setAvailableModules] = useState<Module[]>([]);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [searchUser, setSearchUser] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch Modules
                const modRes = await fetch('/api/modules?limit=100');
                const modData = await modRes.json();
                if (modData.success) setAvailableModules(modData.data);

                // Fetch Users (Participants only)
                const usrRes = await fetch('/api/users?limit=1000');
                const usrData = await usrRes.json();
                if (usrData.success) {
                    const participants = usrData.data.filter((u: User) => u.role === 'participant');
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
                        // Convert to local YYYY-MM-DDTHH:mm format
                        const localStart = new Date(startObj.getTime() - startObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                        setStartTime(localStart);
                    }
                    if (session.end_time) {
                        const endObj = new Date(session.end_time);
                        const localEnd = new Date(endObj.getTime() - endObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                        setEndTime(localEnd);
                    }

                    setRequireSeb(!!session.require_seb);

                    if (session.participants && Array.isArray(session.participants)) {
                        setSelectedUserIds(session.participants.map((p: any) => p.id));
                    }
                } else {
                    setError('Sesi tidak ditemukan atau gagal dimuat');
                }
            } catch (err) {
                console.error("Failed to fetch reference data");
                setError('Kesalahan jaringan saat memuat data referensi');
            } finally {
                setInitialLoading(false);
            }
        };
        fetchInitialData();
    }, [resolvedParams.id]);

    const handleSelectAllUsers = (checked: boolean) => {
        if (checked) {
            setSelectedUserIds(filteredUsers.map(u => u.id));
        } else {
            setSelectedUserIds([]);
        }
    };

    const handleUserCheckboxChange = (userId: string, checked: boolean) => {
        if (checked) {
            setSelectedUserIds(prev => [...prev, userId]);
        } else {
            setSelectedUserIds(prev => prev.filter(id => id !== userId));
        }
    };

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
                start_time: startTime, // String dari form: YYYY-MM-DDTHH:mm
                end_time: endTime,
                require_seb: requireSeb,
                participant_ids: selectedUserIds
            };

            const res = await fetch(`/api/sessions/${resolvedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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

    const filteredUsers = availableUsers.filter(u =>
        u.username.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.full_name.toLowerCase().includes(searchUser.toLowerCase())
    );

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <Link href="/admin/sessions" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                <ArrowLeft01Icon size={16} />
                Kembali ke Daftar Sesi
            </Link>

            <PageHeader
                title="Edit Sesi"
                description="Perbarui jadwal ujian dan sesuaikan peserta yang terdaftar."
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
                        <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                        Informasi Dasar Sesi
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-foreground">Judul Sesi <span className="text-destructive">*</span></label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                placeholder="Contoh: Ujian Akhir Semester Ganjil 2026"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Modul / Materi Ujian <span className="text-destructive">*</span></label>
                            <select
                                required
                                value={moduleId}
                                onChange={(e) => setModuleId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
                            >
                                <option value="" disabled>-- Pilih Modul --</option>
                                {availableModules.map(mod => (
                                    <option key={mod.id} value={mod.id}>{mod.title}</option>
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
                                    <Tick02Icon size={14} className={`absolute text-white pointer-events-none transition-opacity left-0.5 top-0.5 ${requireSeb ? 'opacity-100' : 'opacity-0'}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Aktifkan Safe Exam Browser (SEB)</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Mewajibkan peserta menggunakan aplikasi SEB untuk mencegah kecurangan ujian.</p>
                                </div>
                            </label>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Waktu Mulai <span className="text-destructive">*</span></label>
                            <input
                                type="datetime-local"
                                required
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Waktu Selesai <span className="text-destructive">*</span></label>
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

                {/* Bagian 2: Enrolment */}
                <GlassCard className="p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4 mb-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            Enrollment Peserta
                        </h2>
                        <span className="bg-black/5 px-3 py-1 rounded-full text-xs font-semibold text-muted-foreground">
                            Terpilih: {selectedUserIds.length} dari {filteredUsers.length} Peserta
                        </span>
                    </div>

                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Cari nama atau username peserta..."
                            value={searchUser}
                            onChange={(e) => setSearchUser(e.target.value)}
                            className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                        />
                    </div>

                    <div className="border border-black/10 rounded-xl overflow-hidden bg-white/50 max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-black/5 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-3 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                                            onChange={(e) => handleSelectAllUsers(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-3 font-medium">Username</th>
                                    <th className="px-4 py-3 font-medium">Nama Lengkap</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">
                                            Tidak ada peserta yang ditemukan.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="border-b border-black/5 last:border-0 hover:bg-black/5 transition-colors">
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUserIds.includes(user.id)}
                                                    onChange={(e) => handleUserCheckboxChange(user.id, e.target.checked)}
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium">{user.username}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{user.full_name}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-6 py-3 mr-auto md:mr-0 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 min-w-[200px]"
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
