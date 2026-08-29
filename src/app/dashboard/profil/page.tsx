'use client';

import { useState, useEffect } from 'react';
import {
    UserCircleIcon,
    Tick01Icon,
    AlertCircleIcon,
    Copy01Icon,
    Building02Icon,
    Calendar01Icon,
    SecurityLockIcon,
    Mail01Icon,
    Call02Icon,
    InformationCircleIcon,
    CheckmarkCircle02Icon,
    IdIcon,
} from 'hugeicons-react';
import { toast } from 'sonner';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' });
    const [copiedNip, setCopiedNip] = useState(false);

    const [participantInfo, setParticipantInfo] = useState<{
        nip: string | null;
        institution_code: string | null;
        batch: number | null;
        registration_date: string | null;
        created_at: string | null;
    }>({
        nip: null,
        institution_code: null,
        batch: null,
        registration_date: null,
        created_at: null,
    });

    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        phone_number: '',
        address: '',
        date_of_birth: '',
        gender: '',
        institution: '',
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    useEffect(() => {
        fetch('/api/participant/profile')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data) {
                    const d = data.data;
                    setParticipantInfo({
                        nip: d.nip || null,
                        institution_code: d.institution_code || null,
                        batch: d.batch || 1,
                        registration_date: d.registration_date || null,
                        created_at: d.created_at || null,
                    });
                    setFormData((prev) => ({
                        ...prev,
                        full_name: d.full_name || '',
                        username: d.username || '',
                        phone_number: d.phone_number || '',
                        address: d.address || '',
                        date_of_birth: d.date_of_birth ? d.date_of_birth.split('T')[0] : '',
                        gender: d.gender || '',
                        institution: d.institution || '',
                    }));
                }
            })
            .catch(() => {
                setMessage({ type: 'error', text: 'Gagal memuat data profil. Periksa koneksi jaringan Anda.' });
                toast.error('Gagal Memuat Profil', { description: 'Periksa koneksi jaringan Anda dan coba muat ulang halaman.' });
            })
            .finally(() => setLoading(false));
    }, []);

    const handleCopyNip = async () => {
        if (!participantInfo.nip) return;
        await navigator.clipboard.writeText(participantInfo.nip);
        setCopiedNip(true);
        toast.success('NIP disalin ke clipboard');
        setTimeout(() => setCopiedNip(false), 2000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (formData.new_password && formData.new_password !== formData.confirm_password) {
            setMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok' });
            toast.warning('Peringatan', { description: 'Konfirmasi password baru tidak cocok dengan password baru yang Anda masukkan.' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/participant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Profil berhasil diperbarui' });
                toast.success('Profil Berhasil Diperbarui', { description: 'Perubahan data profil dan keamanan akun Anda telah tersimpan.' });
                setFormData((prev) => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
            } else {
                const errMsg = data.error || 'Terjadi kesalahan saat menyimpan perubahan';
                setMessage({ type: 'error', text: errMsg });
                toast.error('Gagal Menyimpan Profil', { description: errMsg });
            }
        } catch {
            setMessage({ type: 'error', text: 'Terjadi kesalahan koneksi jaringan' });
            toast.error('Kesalahan Jaringan', { description: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-24">
                <div className="w-7 h-7 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            </div>
        );
    }

    const registrationDateFormatted = participantInfo.registration_date
        ? new Date(participantInfo.registration_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : participantInfo.created_at
        ? new Date(participantInfo.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';

    const getInitials = (name: string) => {
        if (!name) return 'PS';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            {/* Page Header */}
            <div>
                <h1 className="text-xl font-bold text-slate-900">Profil & Identitas Peserta</h1>
                <p className="text-xs text-slate-500 mt-1">Kelola informasi data diri resmi, instansi, dan keamanan akun pelatihan Anda.</p>
            </div>

            {/* Notification Banner */}
            {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold border ${
                    message.type === 'error'
                        ? 'bg-red-50 text-red-800 border-red-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                    {message.type === 'error' ? <AlertCircleIcon size={18} className="shrink-0" /> : <Tick01Icon size={18} className="shrink-0" />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Clean Light Participant Header Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* User Identity Info */}
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-lg shrink-0">
                            {getInitials(formData.full_name)}
                        </div>
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                                    {formData.full_name || 'Peserta Pelatihan'}
                                </h2>
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                                    <CheckmarkCircle02Icon size={13} />
                                    Terverifikasi
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                                <span className="font-mono">{formData.username}</span>
                                <span>•</span>
                                <span>{formData.institution || 'Instansi Peserta'}</span>
                            </div>
                        </div>
                    </div>

                    {/* NIP Card */}
                    {participantInfo.nip && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-4 self-start lg:self-auto shrink-0">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor Induk Peserta (NIP)</p>
                                <p className="text-sm font-mono font-bold text-slate-900 mt-0.5 tracking-wider">{participantInfo.nip}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyNip}
                                className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
                                title="Salin NIP"
                            >
                                {copiedNip ? <Tick01Icon size={16} className="text-emerald-600" /> : <Copy01Icon size={16} />}
                            </button>
                        </div>
                    )}
                </div>

                {/* Identity Metadata Strip */}
                <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                        <span className="text-slate-500 block text-[11px] font-medium">Institusi / Instansi</span>
                        <p className="font-semibold text-slate-800 truncate mt-0.5">{formData.institution || '-'}</p>
                    </div>
                    <div>
                        <span className="text-slate-500 block text-[11px] font-medium">Batch Pelatihan</span>
                        <p className="font-semibold text-emerald-700 mt-0.5">Batch {participantInfo.batch || 1}</p>
                    </div>
                    <div>
                        <span className="text-slate-500 block text-[11px] font-medium">Tanggal Registrasi</span>
                        <p className="font-semibold text-slate-800 mt-0.5">{registrationDateFormatted}</p>
                    </div>
                    <div>
                        <span className="text-slate-500 block text-[11px] font-medium">Status Akun</span>
                        <p className="font-semibold text-slate-800 mt-0.5">Peserta Aktif</p>
                    </div>
                </div>
            </div>

            {/* Main Content Form Grid */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Forms Section (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Form Section 1: Data Diri & Kontak */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                                    <Building02Icon size={16} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-900">Data Diri & Kontak</h2>
                                    <p className="text-[11px] text-slate-500">Informasi resmi yang digunakan pada dokumen kelulusan dan sertifikasi.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">
                                    Nama Lengkap <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    required
                                    placeholder="Masukkan nama lengkap sesuai identitas"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Email Akun Login</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.username}
                                        disabled
                                        className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs font-mono cursor-not-allowed"
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-slate-200 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded">
                                        Terkunci
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Nomor Telepon / WhatsApp</label>
                                <input
                                    type="tel"
                                    name="phone_number"
                                    value={formData.phone_number}
                                    onChange={handleChange}
                                    placeholder="Contoh: 081234567890"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">
                                    Jenis Kelamin <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors cursor-pointer"
                                >
                                    <option value="">Pilih Jenis Kelamin</option>
                                    <option value="L">Laki-Laki</option>
                                    <option value="P">Perempuan</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Tanggal Lahir</label>
                                <input
                                    type="date"
                                    name="date_of_birth"
                                    value={formData.date_of_birth}
                                    onChange={handleChange}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Institusi / Unit Kerja</label>
                                <input
                                    type="text"
                                    name="institution"
                                    value={formData.institution}
                                    onChange={handleChange}
                                    placeholder="Nama instansi atau organisasi"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Alamat Domisili</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Alamat lengkap tempat tinggal"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Form Section 2: Keamanan Kata Sandi */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                                    <SecurityLockIcon size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Keamanan Kata Sandi</h3>
                                    <p className="text-[11px] text-slate-500">Kosongkan kolom jika Anda tidak bermaksud mengubah kata sandi akun.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Kata Sandi Saat Ini</label>
                                <input
                                    type="password"
                                    name="current_password"
                                    value={formData.current_password}
                                    onChange={handleChange}
                                    placeholder="Masukkan kata sandi saat ini untuk verifikasi"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Kata Sandi Baru</label>
                                <input
                                    type="password"
                                    name="new_password"
                                    value={formData.new_password}
                                    onChange={handleChange}
                                    placeholder="Minimal 8 karakter"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Konfirmasi Kata Sandi Baru</label>
                                <input
                                    type="password"
                                    name="confirm_password"
                                    value={formData.confirm_password}
                                    onChange={handleChange}
                                    placeholder="Ulangi kata sandi baru"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:border-slate-400 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Bar */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Tick01Icon size={16} />
                            )}
                            <span>Simpan Perubahan</span>
                        </button>
                    </div>
                </div>

                {/* Right Information Sidebar Section (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Information Guide Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                            <InformationCircleIcon size={16} className="text-slate-600" />
                            <span>Ketentuan Data Profil</span>
                        </div>
                        <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                <span><strong>Nama Lengkap:</strong> Akan dicantumkan persis pada Surat Keterangan Lulus (SKL) dan Sertifikat Kompetensi Resmi.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                <span><strong>NIP Peserta:</strong> Berfungsi sebagai kode identifikasi tunggal pada portal audit verifikasi keaslian dokumen.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                <span><strong>Email Login:</strong> Bersifat permanen dan tidak dapat diganti demi integritas riwayat sesi pembelajaran Anda.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                <span><strong>Kontak Aktif:</strong> Pastikan nomor WhatsApp selalu aktif untuk konfirmasi kelulusan dan jadwal ujian.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Account Status Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                        <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">Status Akun Pelatihan</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-600">
                                <span>Tipe Akses</span>
                                <span className="font-semibold text-slate-900">Peserta (Trainee)</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                                <span>Status Keaktifan</span>
                                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Aktif
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                                <span>Enkripsi Kata Sandi</span>
                                <span className="font-semibold text-slate-900">Bcrypt Terproteksi</span>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
