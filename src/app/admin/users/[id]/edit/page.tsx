'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck01Icon, FloppyDiskIcon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'participant'
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const resolvedParams = await params;
                const id = resolvedParams.id;
                setUserId(id);

                const res = await fetch(`/api/users/${id}`);
                if (!res.ok) throw new Error('Pengguna tidak ditemukan');
                const result = await res.json();

                if (result.success) {
                    setFormData({
                        username: result.data.username,
                        password: '', // deliberate empty password for updates
                        full_name: result.data.full_name,
                        role: result.data.role,
                    });
                } else {
                    throw new Error(result.error);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsFetching(false);
            }
        };
        loadUser();
    }, [params]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        setIsLoading(true);
        setError(null);

        // Allow empty password to be undefined or empty so backend doesn't update it
        const submitData = { ...formData };
        if (!submitData.password.trim()) {
            submitData.password = '';
        }

        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                router.push('/admin/users');
                router.refresh();
            } else {
                let errorMsg = result.error || 'Gagal memperbarui pengguna';
                if (result.details) {
                    const firstKey = Object.keys(result.details)[0];
                    if (firstKey) errorMsg = result.details[firstKey][0];
                }
                throw new Error(errorMsg);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
                <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-3xl">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
                <Link
                    href="/admin/users"
                    className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <UserCheck01Icon size={28} className="text-muted-foreground" />
                        Edit Pengguna
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Perbarui informasi akun, ganti password, atau ubah hak akses.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Nama Lengkap <span className="text-destructive">*</span></label>
                        <input
                            type="text"
                            required
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Username <span className="text-destructive">*</span></label>
                        <input
                            type="text"
                            required
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Password Baru</label>
                        <input
                            type="password"
                            minLength={6}
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            placeholder="Biarkan kosong jika tidak ingin mengubah"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Kosongkan kolom ini jika password tidak ingin diubah.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Peran (Role) <span className="text-destructive">*</span></label>
                        <select
                            required
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none appearance-none"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="participant">Peserta Ujian</option>
                            <option value="admin">Administrator</option>
                        </select>

                        {userId === 'admin-uuid-001' && (
                            <p className="text-xs text-orange-600 mt-1 font-semibold flex items-center gap-1">Peringatan: Administrator default tidak dapat diturunkan hak aksesnya.</p>
                        )}
                    </div>
                </div>

                <div className="pt-6 border-t border-black/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <FloppyDiskIcon size={18} />
                        {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </form>
        </div>
    );
}
