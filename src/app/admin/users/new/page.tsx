'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserAdd01Icon, FloppyDiskIcon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';

export default function NewUserPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'participant'
    });
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                router.push('/admin/users');
                router.refresh();
            } else {
                let errorMsg = result.error || 'Gagal menyimpan pengguna';
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
                        <UserAdd01Icon size={28} className="text-muted-foreground" />
                        Tambah Pengguna Baru
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Buat akun untuk Administrator atau Peserta Ujian baru.
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
                            placeholder="Contoh: Budi Santoso"
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
                            placeholder="Contoh: budi_s"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Password <span className="text-destructive">*</span></label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                            placeholder="Minimal 6 karakter"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
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
                    </div>
                </div>

                <div className="pt-6 border-t border-black/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <FloppyDiskIcon size={18} />
                        {isLoading ? 'Menyimpan...' : 'Simpan Pengguna'}
                    </button>
                </div>
            </form>
        </div>
    );
}
