'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    User,
    Mail,
    Lock,
    Eye,
    EyeOff,
    Building,
    Phone,
    Calendar,
    Award,
    MapPin,
    AlertCircle,
    CheckCircle2,
    ArrowRight,
    Loader2,
    ChevronDown,
} from 'lucide-react';

interface CertificationOption {
    id: string;
    name: string;
    code?: string | null;
    description?: string | null;
}

const MONTH_OPTIONS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

export default function RegisterPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [certifications, setCertifications] = useState<CertificationOption[]>([]);
    const [isLoadingCerts, setIsLoadingCerts] = useState(true);

    const [formData, setFormData] = useState({
        full_name: '',
        username: '', // email
        password: '',
        confirm_password: '',
        phone_number: '',
        institution: '',
        gender: '' as 'L' | 'P' | '',
        date_of_birth: '',
        address: '',
        target_certification_id: '',
        target_certification_name: '',
        target_month: '',
        target_year: String(CURRENT_YEAR),
    });

    // Fetch dynamic certification programs
    useEffect(() => {
        let isMounted = true;
        async function loadCertifications() {
            try {
                const res = await fetch('/api/public/certifications');
                const json = await res.json();
                if (isMounted && json.success && Array.isArray(json.data)) {
                    setCertifications(json.data);
                }
            } catch (err) {
                console.error('Failed to load certifications:', err);
            } finally {
                if (isMounted) setIsLoadingCerts(false);
            }
        }
        loadCertifications();
        return () => { isMounted = false; };
    }, []);

    const handleCertificationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedCert = certifications.find(c => c.id === selectedId);
        setFormData(prev => ({
            ...prev,
            target_certification_id: selectedId,
            target_certification_name: selectedCert ? selectedCert.name : ''
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirm_password) {
            setError('Konfirmasi password tidak cocok dengan password yang Anda masukkan.');
            return;
        }

        if (formData.password.length < 8) {
            setError('Password minimal harus terdiri dari 8 karakter.');
            return;
        }

        if (!formData.gender) {
            setError('Jenis kelamin wajib dipilih (Laki-laki atau Perempuan).');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: formData.full_name,
                    username: formData.username,
                    password: formData.password,
                    phone_number: formData.phone_number || null,
                    institution: formData.institution,
                    gender: formData.gender || null,
                    date_of_birth: formData.date_of_birth || null,
                    address: formData.address || null,
                    target_certification_id: formData.target_certification_id || null,
                    target_certification_name: formData.target_certification_name || null,
                    target_month: formData.target_month || null,
                    target_year: formData.target_year || null,
                })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                setIsSuccess(true);
            } else {
                setError(result.error || 'Terjadi kesalahan saat memproses pendaftaran. Silakan periksa data Anda.');
            }
        } catch {
            setError('Gagal terhubung ke server. Silakan periksa koneksi internet Anda.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background font-sans antialiased selection:bg-primary/20 selection:text-primary">
            {/* ── Left Hero Panel (Pure Branding & Atmosphere) ── */}
            <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden bg-slate-950 select-none">
                <Image
                    src="/images/auth-hero.jpg"
                    alt="Pendaftaran Sertifikasi Profesi Nusamitra"
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    priority
                    className="object-cover object-center transform scale-105 transition-transform duration-1000 ease-out opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-slate-950/70" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-950/50" />

                {/* Hero Info Overlay */}
                <div className="absolute top-10 left-10 right-10 z-10">
                    <Image
                        src="/logo-nusamitra-tr.png"
                        alt="Nusamitra Consulting"
                        width={180}
                        height={52}
                        priority
                        className="h-12 w-auto object-contain brightness-0 invert"
                    />
                </div>

                <div className="absolute bottom-10 left-10 right-10 z-10 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 text-xs font-medium tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Pendaftaran Peserta & Calon Asesi Resmi
                    </div>
                    <h2 className="text-2xl xl:text-3xl font-bold text-white tracking-tight leading-snug">
                        Tingkatkan Standar Kompetensi & Integritas Profesional Bersama Nusamitra.
                    </h2>
                    <p className="text-slate-300 text-xs xl:text-sm leading-relaxed max-w-md">
                        Daftarkan data diri Anda untuk mengikuti program sertifikasi kompetensi. Nomor Induk Peserta (NIP) dan penetapan batch akan diterbitkan langsung oleh Administrator.
                    </p>
                </div>
            </div>

            {/* ── Right Form Panel (High Usability & Form Flow) ── */}
            <div className="w-full lg:w-[55%] xl:w-[58%] flex flex-col justify-between min-h-screen bg-slate-50/50 p-5 sm:p-8 md:p-12 lg:p-10 xl:p-14 overflow-y-auto">
                <div className="w-full max-w-2xl mx-auto py-4">
                    {/* Header Mobile Brand */}
                    <div className="mb-6 lg:hidden">
                        <Image
                            src="/logo-nusamitra-tr.png"
                            alt="Nusamitra Consulting"
                            width={160}
                            height={46}
                            priority
                            className="h-10 w-auto object-contain"
                        />
                    </div>

                    {!isSuccess ? (
                        <>
                            {/* Page Header */}
                            <div className="space-y-1.5 mb-8">
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                    Pendaftaran Akun Peserta
                                </h1>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Lengkapi formulir di bawah ini untuk mengajukan pendaftaran akun dan rencana keikutsertaan sertifikasi Anda.
                                </p>
                            </div>

                            {/* Error Alert */}
                            {error && (
                                <div
                                    role="alert"
                                    className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
                                >
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <span className="font-medium">{error}</span>
                                </div>
                            )}

                            {/* Main Registration Form */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* SECTION 1: KREDENSIAL & AKUN */}
                                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                            1
                                        </div>
                                        <h3 className="text-sm font-bold text-foreground tracking-tight">
                                            Informasi Akun & Akses Masuk
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Nama Lengkap */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Nama Lengkap & Gelar <span className="text-destructive">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                    <User className="w-4 h-4" />
                                                </span>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                    placeholder="Contoh: Ahmad Fauzi, S.Kom"
                                                    value={formData.full_name}
                                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Email / Username */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Alamat Email (Username Login) <span className="text-destructive">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                    <Mail className="w-4 h-4" />
                                                </span>
                                                <input
                                                    type="email"
                                                    required
                                                    autoComplete="email"
                                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                    placeholder="nama@email.com"
                                                    value={formData.username}
                                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Password */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Password <span className="text-destructive">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                    <Lock className="w-4 h-4" />
                                                </span>
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    autoComplete="new-password"
                                                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                    placeholder="Minimal 8 karakter"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 text-muted-foreground hover:text-foreground p-1 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Confirm Password */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Konfirmasi Password <span className="text-destructive">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                    <Lock className="w-4 h-4" />
                                                </span>
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    required
                                                    autoComplete="new-password"
                                                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                    placeholder="Ulangi password"
                                                    value={formData.confirm_password}
                                                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3 text-muted-foreground hover:text-foreground p-1 transition-colors"
                                                >
                                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 2: INSTANSI & KONTAK */}
                                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                            2
                                        </div>
                                        <h3 className="text-sm font-bold text-foreground tracking-tight">
                                            Data Instansi & Nomor Kontak
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Instansi / Unit Kerja */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Instansi / Perusahaan / Unit Kerja <span className="text-destructive">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                    <Building className="w-4 h-4" />
                                                </span>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                    placeholder="Contoh: PT Telkom Indonesia / BKPSDM"
                                                    value={formData.institution}
                                                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Nomor WhatsApp / Telepon */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Nomor WhatsApp / HP <span className="text-destructive">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                    <Phone className="w-4 h-4" />
                                                </span>
                                                <input
                                                    type="tel"
                                                    required
                                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                    placeholder="081234567890"
                                                    value={formData.phone_number}
                                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 3: DATA PRIBADI */}
                                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                            3
                                        </div>
                                        <h3 className="text-sm font-bold text-foreground tracking-tight">
                                            Data Profil Pribadi
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Jenis Kelamin */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Jenis Kelamin <span className="text-destructive">*</span>
                                            </label>
                                            <select
                                                required
                                                className="w-full h-11 px-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                value={formData.gender}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'L' | 'P' | '' })}
                                            >
                                                <option value="">-- Pilih Jenis Kelamin --</option>
                                                <option value="L">Laki-Laki</option>
                                                <option value="P">Perempuan</option>
                                            </select>
                                        </div>

                                        {/* Tanggal Lahir */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Tanggal Lahir
                                            </label>
                                            <div className="relative flex items-center">
                                                <input
                                                    type="date"
                                                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                    value={formData.date_of_birth}
                                                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Alamat Lengkap */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Alamat Domisili
                                            </label>
                                            <div className="relative flex items-start">
                                                <span className="absolute left-3.5 top-3 text-muted-foreground pointer-events-none">
                                                    <MapPin className="w-4 h-4" />
                                                </span>
                                                <textarea
                                                    rows={2}
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                                    placeholder="Alamat domisili lengkap peserta..."
                                                    value={formData.address}
                                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 4: PILIHAN PROGRAM SERTIFIKASI & JADWAL */}
                                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                            4
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground tracking-tight">
                                                Peminatan Program Sertifikasi & Rencana Pelaksanaan
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                Pilih program yang ingin diikuti dan target bulan pelaksanaan uji kompetensi.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Dropdown Program Sertifikasi */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Program Sertifikasi yang Ingin Diikuti <span className="text-destructive">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                    <Award className="w-4 h-4" />
                                                </span>
                                                <select
                                                    required
                                                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all appearance-none cursor-pointer"
                                                    value={formData.target_certification_id}
                                                    onChange={handleCertificationChange}
                                                    disabled={isLoadingCerts}
                                                >
                                                    <option value="">
                                                        {isLoadingCerts ? 'Memuat daftar program...' : '-- Pilih Program Sertifikasi --'}
                                                    </option>
                                                    {certifications.map((cert) => (
                                                        <option key={cert.id} value={cert.id}>
                                                            {cert.name} {cert.code ? `(${cert.code})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3.5 pointer-events-none" />
                                            </div>
                                        </div>

                                        {/* Target Periode (Bulan & Tahun) */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                Rencana Pelaksanaan Sertifikasi <span className="text-destructive">*</span>
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="relative flex items-center">
                                                    <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                        <Calendar className="w-4 h-4" />
                                                    </span>
                                                    <select
                                                        required
                                                        className="w-full h-11 pl-10 pr-8 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all appearance-none cursor-pointer"
                                                        value={formData.target_month}
                                                        onChange={(e) => setFormData({ ...formData, target_month: e.target.value })}
                                                    >
                                                        <option value="">-- Pilih Bulan --</option>
                                                        {MONTH_OPTIONS.map((m) => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 pointer-events-none" />
                                                </div>

                                                <div className="relative flex items-center">
                                                    <select
                                                        required
                                                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all cursor-pointer"
                                                        value={formData.target_year}
                                                        onChange={(e) => setFormData({ ...formData, target_year: e.target.value })}
                                                    >
                                                        {YEAR_OPTIONS.map((y) => (
                                                            <option key={y} value={String(y)}>Tahun {y}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground italic pt-1">
                                                * Tim Administrator akan menetapkan jadwal batch dan sesi ujian yang paling sesuai berdasarkan rencana yang Anda pilih.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-12 rounded-xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-foreground/10"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Memproses Pendaftaran...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Kirim Pengajuan Pendaftaran</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>

                                {/* Back to Login Link */}
                                <div className="text-center pt-1">
                                    <p className="text-sm text-muted-foreground">
                                        Sudah memiliki akun terdaftar?{' '}
                                        <Link
                                            href="/auth/login"
                                            className="font-semibold text-foreground hover:underline transition-colors"
                                        >
                                            Masuk di sini
                                        </Link>
                                    </p>
                                </div>
                            </form>
                        </>
                    ) : (
                        /* SUCCESS CONFIRMATION STATE */
                        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm text-center space-y-6 animate-in fade-in zoom-in-95 duration-300 my-8">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center mx-auto shadow-sm">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                    Pendaftaran Berhasil Dikirim!
                                </h2>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                                    Terima kasih, <strong>{formData.full_name}</strong>. Pengajuan akun Anda telah tersimpan dan saat ini sedang menunggu verifikasi serta persetujuan dari tim Administrator.
                                </p>
                            </div>

                            {/* Summary Box */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left space-y-3 text-xs max-w-lg mx-auto">
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                    <span className="text-muted-foreground">Email Akun:</span>
                                    <span className="font-semibold text-foreground">{formData.username}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                    <span className="text-muted-foreground">Instansi:</span>
                                    <span className="font-semibold text-foreground">{formData.institution}</span>
                                </div>
                                {formData.target_certification_name && (
                                    <div className="flex justify-between items-start py-1 border-b border-slate-200/60 gap-4">
                                        <span className="text-muted-foreground shrink-0">Program Pilihan:</span>
                                        <span className="font-semibold text-foreground text-right">{formData.target_certification_name}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                    <span className="text-muted-foreground">Rencana Pelaksanaan:</span>
                                    <span className="font-semibold text-foreground">{formData.target_month} {formData.target_year}</span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-muted-foreground">Status Akun:</span>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                        Menunggu Persetujuan Admin
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                                Setelah pendaftaran disetujui, <strong>Nomor Induk Peserta (NIP)</strong> dan <strong>Batch Pelatihan</strong> resmi akan otomatis diterbitkan oleh sistem dan akun Anda dapat langsung digunakan untuk login.
                            </p>

                            <div className="pt-2">
                                <Link
                                    href="/auth/login"
                                    className="inline-flex items-center justify-center gap-2 h-11 px-8 rounded-xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all shadow-sm"
                                >
                                    <span>Kembali ke Halaman Login</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="w-full max-w-2xl mx-auto pt-6 text-center border-t border-slate-100">
                    <p className="text-xs text-muted-foreground">
                        © {new Date().getFullYear()} Nusamitra Consulting. Hak Cipta Dilindungi.
                    </p>
                </div>
            </div>
        </div>
    );
}
