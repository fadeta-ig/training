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
    ArrowLeft,
    Loader2,
    ChevronDown,
    Check,
    ShieldCheck,
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

const STEPS = [
    { id: 1, title: 'Akun', subtitle: 'Akses & Login' },
    { id: 2, title: 'Instansi', subtitle: 'Kontak & Kerja' },
    { id: 3, title: 'Profil', subtitle: 'Data Diri' },
    { id: 4, title: 'Program', subtitle: 'Peminatan & Jadwal' },
] as const;

export default function RegisterPage() {
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [stepError, setStepError] = useState<string>('');
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
        if (stepError) setStepError('');
    };

    // Validation per step
    const validateCurrentStep = (step: number): boolean => {
        setStepError('');

        if (step === 1) {
            if (!formData.full_name.trim()) {
                setStepError('Nama Lengkap & Gelar wajib diisi.');
                return false;
            }
            if (formData.full_name.trim().length < 2) {
                setStepError('Nama lengkap minimal 2 karakter.');
                return false;
            }
            if (!formData.username.trim()) {
                setStepError('Alamat email wajib diisi.');
                return false;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.username.trim())) {
                setStepError('Format email tidak valid (contoh: nama@email.com).');
                return false;
            }
            if (!formData.password) {
                setStepError('Password wajib diisi.');
                return false;
            }
            if (formData.password.length < 8) {
                setStepError('Password minimal harus 8 karakter.');
                return false;
            }
            if (formData.password !== formData.confirm_password) {
                setStepError('Konfirmasi password tidak cocok dengan password yang dimasukkan.');
                return false;
            }
            return true;
        }

        if (step === 2) {
            if (!formData.institution.trim()) {
                setStepError('Nama instansi / unit kerja wajib diisi.');
                return false;
            }
            if (!formData.phone_number.trim()) {
                setStepError('Nomor WhatsApp / HP aktif wajib diisi.');
                return false;
            }
            if (formData.phone_number.trim().length < 6) {
                setStepError('Nomor telepon minimal 6 digit.');
                return false;
            }
            return true;
        }

        if (step === 3) {
            if (!formData.gender) {
                setStepError('Silakan pilih Jenis Kelamin Anda.');
                return false;
            }
            return true;
        }

        if (step === 4) {
            if (!formData.target_certification_id) {
                setStepError('Silakan pilih Program Sertifikasi yang ingin diikuti.');
                return false;
            }
            if (!formData.target_month) {
                setStepError('Silakan pilih rencana Bulan pelaksanaan sertifikasi.');
                return false;
            }
            return true;
        }

        return true;
    };

    const handleNextStep = () => {
        if (validateCurrentStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 4));
        }
    };

    const handlePrevStep = () => {
        setStepError('');
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleStepClick = (targetStep: number) => {
        // Can only jump to previous steps or next step if current is valid
        if (targetStep < currentStep) {
            setStepError('');
            setCurrentStep(targetStep);
        } else if (targetStep === currentStep + 1 && validateCurrentStep(currentStep)) {
            setCurrentStep(targetStep);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            if (currentStep < 4) {
                handleNextStep();
            } else {
                handleSubmit();
            }
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setStepError('');

        // Validate all 4 steps
        for (let s = 1; s <= 4; s++) {
            if (!validateCurrentStep(s)) {
                setCurrentStep(s);
                return;
            }
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: formData.full_name.trim(),
                    username: formData.username.trim().toLowerCase(),
                    password: formData.password,
                    phone_number: formData.phone_number.trim() || null,
                    institution: formData.institution.trim(),
                    gender: formData.gender || null,
                    date_of_birth: formData.date_of_birth || null,
                    address: formData.address.trim() || null,
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
                setStepError(result.error || 'Terjadi kesalahan saat memproses pendaftaran. Silakan periksa kembali data Anda.');
            }
        } catch {
            setStepError('Gagal terhubung ke server. Silakan periksa koneksi internet Anda.');
        } finally {
            setIsLoading(false);
        }
    };

    const progressPercentage = ((currentStep - 1) / (STEPS.length - 1)) * 100;

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50/50 font-sans antialiased selection:bg-primary/20 selection:text-primary">
            {/* ── Left Hero Panel (Branding & Atmosphere) ── */}
            <div className="hidden lg:flex lg:w-[42%] xl:w-[40%] relative overflow-hidden bg-slate-950 select-none flex-col justify-between p-10 xl:p-12">
                <Image
                    src="/images/auth-hero.jpg"
                    alt="Pendaftaran Sertifikasi Profesi Nusamitra"
                    fill
                    sizes="(min-width: 1024px) 42vw, 100vw"
                    priority
                    className="object-cover object-center transform scale-105 transition-transform duration-1000 ease-out opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/70" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-950/40" />

                {/* Top Logo */}
                <div className="relative z-10">
                    <Image
                        src="/logo-nusamitra-tr.png"
                        alt="Nusamitra Consulting"
                        width={180}
                        height={52}
                        priority
                        className="h-11 w-auto object-contain brightness-0 invert"
                    />
                </div>

                {/* Bottom Highlight */}
                <div className="relative z-10 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Pendaftaran Peserta & Asesi Baru
                    </div>
                    <h2 className="text-2xl xl:text-3xl font-bold text-white tracking-tight leading-snug">
                        Langkah Mudah Menuju Pengakuan Kompetensi Profesional.
                    </h2>
                    <p className="text-slate-300 text-xs xl:text-sm leading-relaxed max-w-sm">
                        Lengkapi formulir terpandu 4 langkah ini. Administrator kami akan memverifikasi dan menerbitkan Nomor Induk Peserta (NIP) Anda.
                    </p>

                    <div className="pt-2 flex items-center gap-5 text-xs text-slate-400 border-t border-white/10">
                        <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Data Aman & Terenkripsi
                        </span>
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-sky-400" /> Verifikasi Cepat
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Right Wizard Panel (Compact, Focused, No-Scroll Flow) ── */}
            <div className="w-full lg:w-[58%] xl:w-[60%] flex flex-col justify-between min-h-screen bg-slate-50/50 p-4 sm:p-6 md:p-8 lg:p-8 xl:p-10">
                <div className="w-full max-w-xl mx-auto my-auto py-2">
                    {/* Header Mobile Brand */}
                    <div className="mb-4 lg:hidden flex justify-between items-center">
                        <Image
                            src="/logo-nusamitra-tr.png"
                            alt="Nusamitra Consulting"
                            width={140}
                            height={40}
                            priority
                            className="h-9 w-auto object-contain"
                        />
                        <Link
                            href="/auth/login"
                            className="text-xs font-semibold text-slate-600 hover:text-foreground transition-colors"
                        >
                            Masuk
                        </Link>
                    </div>

                    {!isSuccess ? (
                        <div className="space-y-4">
                            {/* Header Titles */}
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                    Pendaftaran Akun Peserta
                                </h1>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                                    Ikuti 4 langkah mudah untuk mengajukan keikutsertaan pelatihan & sertifikasi.
                                </p>
                            </div>

                            {/* ── PROGRESS STEPPER ── */}
                            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                                    <span className="text-foreground font-bold">
                                        Langkah {currentStep} dari 4: <span className="text-primary">{STEPS[currentStep - 1].title}</span>
                                    </span>
                                    <span className="text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                                        {Math.round(((currentStep) / 4) * 100)}% Selesai
                                    </span>
                                </div>

                                {/* Progress Bar Track */}
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                                        style={{ width: `${((currentStep) / 4) * 100}%` }}
                                    />
                                </div>

                                {/* Stepper Badges */}
                                <div className="grid grid-cols-4 gap-1 sm:gap-2 pt-1">
                                    {STEPS.map((s) => {
                                        const isCompleted = s.id < currentStep;
                                        const isActive = s.id === currentStep;
                                        const isUpcoming = s.id > currentStep;

                                        return (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => handleStepClick(s.id)}
                                                disabled={isUpcoming}
                                                className={`flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl text-left transition-all ${
                                                    isActive
                                                        ? 'bg-primary/10 border border-primary/20 text-primary cursor-default'
                                                        : isCompleted
                                                        ? 'bg-slate-50 hover:bg-slate-100 text-foreground cursor-pointer'
                                                        : 'opacity-40 text-muted-foreground cursor-not-allowed'
                                                }`}
                                            >
                                                <div
                                                    className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold transition-colors ${
                                                        isCompleted
                                                            ? 'bg-emerald-600 text-white'
                                                            : isActive
                                                            ? 'bg-primary text-white'
                                                            : 'bg-slate-200 text-slate-600'
                                                    }`}
                                                >
                                                    {isCompleted ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : s.id}
                                                </div>
                                                <div className="min-w-0 hidden sm:block">
                                                    <div className="text-xs font-bold truncate leading-tight">{s.title}</div>
                                                    <div className="text-[10px] text-muted-foreground truncate leading-tight">{s.subtitle}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── ERROR ALERT ── */}
                            {stepError && (
                                <div
                                    role="alert"
                                    className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
                                >
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span className="font-medium">{stepError}</span>
                                </div>
                            )}

                            {/* ── STEP CONTENT CARD (No Long Scroll) ── */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs" onKeyDown={handleKeyDown}>
                                {/* STEP 1: AKUN & AKSES */}
                                {currentStep === 1 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                                        <div>
                                            <h2 className="text-sm font-bold text-foreground">Informasi Akun & Akses Masuk</h2>
                                            <p className="text-xs text-muted-foreground">Kredensial ini digunakan untuk masuk ke portal LMS.</p>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Nama Lengkap */}
                                            <div className="space-y-1">
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
                                                        autoFocus
                                                        className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all"
                                                        placeholder="Contoh: Ahmad Fauzi, S.Kom"
                                                        value={formData.full_name}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, full_name: e.target.value });
                                                            if (stepError) setStepError('');
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Email */}
                                            <div className="space-y-1">
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
                                                        className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all"
                                                        placeholder="nama@email.com"
                                                        value={formData.username}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, username: e.target.value });
                                                            if (stepError) setStepError('');
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Password & Confirm */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
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
                                                            className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all"
                                                            placeholder="Min. 8 karakter"
                                                            value={formData.password}
                                                            onChange={(e) => {
                                                                setFormData({ ...formData, password: e.target.value });
                                                                if (stepError) setStepError('');
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-2.5 text-muted-foreground hover:text-foreground p-1 transition-colors"
                                                            tabIndex={-1}
                                                        >
                                                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                        Ulangi Password <span className="text-destructive">*</span>
                                                    </label>
                                                    <div className="relative flex items-center">
                                                        <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                            <Lock className="w-4 h-4" />
                                                        </span>
                                                        <input
                                                            type={showConfirmPassword ? 'text' : 'password'}
                                                            required
                                                            className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all"
                                                            placeholder="Konfirmasi password"
                                                            value={formData.confirm_password}
                                                            onChange={(e) => {
                                                                setFormData({ ...formData, confirm_password: e.target.value });
                                                                if (stepError) setStepError('');
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                            className="absolute right-2.5 text-muted-foreground hover:text-foreground p-1 transition-colors"
                                                            tabIndex={-1}
                                                        >
                                                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: INSTANSI & KONTAK */}
                                {currentStep === 2 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                                        <div>
                                            <h2 className="text-sm font-bold text-foreground">Data Instansi & Nomor Kontak</h2>
                                            <p className="text-xs text-muted-foreground">Informasi asal unit kerja dan jalur komunikasi aktif.</p>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Instansi */}
                                            <div className="space-y-1">
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
                                                        autoFocus
                                                        className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all"
                                                        placeholder="Contoh: PT Telkom Indonesia / BKPSDM"
                                                        value={formData.institution}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, institution: e.target.value });
                                                            if (stepError) setStepError('');
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Telepon */}
                                            <div className="space-y-1">
                                                <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                    Nomor WhatsApp / HP Aktif <span className="text-destructive">*</span>
                                                </label>
                                                <div className="relative flex items-center">
                                                    <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                        <Phone className="w-4 h-4" />
                                                    </span>
                                                    <input
                                                        type="tel"
                                                        required
                                                        className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all"
                                                        placeholder="Contoh: 081234567890"
                                                        value={formData.phone_number}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, phone_number: e.target.value });
                                                            if (stepError) setStepError('');
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Alamat Domisili */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                        Alamat Domisili
                                                    </label>
                                                    <span className="text-[11px] text-muted-foreground">Opsional</span>
                                                </div>
                                                <div className="relative flex items-center">
                                                    <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                        <MapPin className="w-4 h-4" />
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all"
                                                        placeholder="Kota atau alamat lengkap domisili..."
                                                        value={formData.address}
                                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: PROFIL PRIBADI */}
                                {currentStep === 3 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                                        <div>
                                            <h2 className="text-sm font-bold text-foreground">Data Profil Pribadi</h2>
                                            <p className="text-xs text-muted-foreground">Data diri pendukung untuk penerbitan sertifikasi.</p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Jenis Kelamin (Interactive Cards) */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                    Jenis Kelamin <span className="text-destructive">*</span>
                                                </label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, gender: 'L' });
                                                            if (stepError) setStepError('');
                                                        }}
                                                        className={`h-14 rounded-xl border flex items-center justify-center gap-2.5 transition-all font-semibold text-sm ${
                                                            formData.gender === 'L'
                                                                ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs'
                                                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                                                        }`}
                                                    >
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                            formData.gender === 'L' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
                                                        }`}>
                                                            {formData.gender === 'L' ? <Check className="w-3.5 h-3.5" /> : 'L'}
                                                        </div>
                                                        <span>Laki-Laki</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, gender: 'P' });
                                                            if (stepError) setStepError('');
                                                        }}
                                                        className={`h-14 rounded-xl border flex items-center justify-center gap-2.5 transition-all font-semibold text-sm ${
                                                            formData.gender === 'P'
                                                                ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs'
                                                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                                                        }`}
                                                    >
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                            formData.gender === 'P' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
                                                        }`}>
                                                            {formData.gender === 'P' ? <Check className="w-3.5 h-3.5" /> : 'P'}
                                                        </div>
                                                        <span>Perempuan</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Tanggal Lahir */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                        Tanggal Lahir
                                                    </label>
                                                    <span className="text-[11px] text-muted-foreground">Opsional</span>
                                                </div>
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="date"
                                                        className="w-full h-10 px-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all"
                                                        value={formData.date_of_birth}
                                                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-muted-foreground pt-0.5">
                                                    Digunakan untuk verifikasi keaslian sertifikat kompetensi.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 4: PEMINATAN PROGRAM & JADWAL */}
                                {currentStep === 4 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                                        <div>
                                            <h2 className="text-sm font-bold text-foreground">Peminatan Sertifikasi & Rencana Pelaksanaan</h2>
                                            <p className="text-xs text-muted-foreground">Tentukan skema pelatihan dan target bulan ujian Anda.</p>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Program Dropdown */}
                                            <div className="space-y-1">
                                                <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                    Program Sertifikasi <span className="text-destructive">*</span>
                                                </label>
                                                <div className="relative flex items-center">
                                                    <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                                        <Award className="w-4 h-4" />
                                                    </span>
                                                    <select
                                                        required
                                                        autoFocus
                                                        className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all appearance-none cursor-pointer"
                                                        value={formData.target_certification_id}
                                                        onChange={handleCertificationChange}
                                                        disabled={isLoadingCerts}
                                                    >
                                                        <option value="">
                                                            {isLoadingCerts ? 'Memuat daftar skema...' : '-- Pilih Program Sertifikasi --'}
                                                        </option>
                                                        {certifications.map((cert) => (
                                                            <option key={cert.id} value={cert.id}>
                                                                {cert.name} {cert.code ? `(${cert.code})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 pointer-events-none" />
                                                </div>
                                            </div>

                                            {/* Target Periode (Bulan & Tahun) */}
                                            <div className="space-y-1">
                                                <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                                                    Target Waktu Pelaksanaan <span className="text-destructive">*</span>
                                                </label>
                                                <div className="grid grid-cols-2 gap-2.5">
                                                    <div className="relative flex items-center">
                                                        <span className="absolute left-3 text-muted-foreground pointer-events-none">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                        </span>
                                                        <select
                                                            required
                                                            className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-50/70 border border-slate-200 text-xs sm:text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all appearance-none cursor-pointer"
                                                            value={formData.target_month}
                                                            onChange={(e) => {
                                                                setFormData({ ...formData, target_month: e.target.value });
                                                                if (stepError) setStepError('');
                                                            }}
                                                        >
                                                            <option value="">-- Pilih Bulan --</option>
                                                            {MONTH_OPTIONS.map((m) => (
                                                                <option key={m} value={m}>{m}</option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
                                                    </div>

                                                    <div className="relative flex items-center">
                                                        <select
                                                            required
                                                            className="w-full h-10 px-3 rounded-xl bg-slate-50/70 border border-slate-200 text-xs sm:text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground focus:ring-3 focus:ring-foreground/5 transition-all cursor-pointer"
                                                            value={formData.target_year}
                                                            onChange={(e) => setFormData({ ...formData, target_year: e.target.value })}
                                                        >
                                                            {YEAR_OPTIONS.map((y) => (
                                                                <option key={y} value={String(y)}>Tahun {y}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mini Review Snapshot Card */}
                                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 text-xs space-y-1.5 mt-2">
                                                <div className="font-bold text-slate-700 flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                    Ringkasan Pendaftaran:
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-600 text-[11px]">
                                                    <div className="truncate"><b>Nama:</b> {formData.full_name || '-'}</div>
                                                    <div className="truncate"><b>Email:</b> {formData.username || '-'}</div>
                                                    <div className="truncate"><b>Instansi:</b> {formData.institution || '-'}</div>
                                                    <div className="truncate"><b>No. HP:</b> {formData.phone_number || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP NAVIGATION CONTROLS ── */}
                                <div className="flex items-center justify-between pt-5 mt-4 border-t border-slate-100 gap-3">
                                    {currentStep === 1 ? (
                                        <div className="text-xs text-muted-foreground">
                                            Sudah punya akun?{' '}
                                            <Link href="/auth/login" className="font-semibold text-primary hover:underline">
                                                Masuk
                                            </Link>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handlePrevStep}
                                            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                            <span>Kembali</span>
                                        </button>
                                    )}

                                    {currentStep < 4 ? (
                                        <button
                                            type="button"
                                            onClick={handleNextStep}
                                            className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ml-auto"
                                        >
                                            <span>Lanjut</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleSubmit()}
                                            disabled={isLoading}
                                            className="h-10 px-5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ml-auto"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Memproses...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>Kirim Pendaftaran</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── SUCCESS CONFIRMATION STATE ── */
                        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs text-center space-y-5 animate-in fade-in zoom-in-95 duration-300 my-auto">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center mx-auto shadow-xs">
                                <CheckCircle2 className="w-7 h-7" />
                            </div>

                            <div className="space-y-1.5">
                                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                                    Pendaftaran Berhasil Dikirim!
                                </h2>
                                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                                    Terima kasih, <strong>{formData.full_name}</strong>. Pengajuan akun Anda telah tersimpan dan menunggu persetujuan dari tim Administrator.
                                </p>
                            </div>

                            {/* Summary Box */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-left space-y-2 text-xs max-w-md mx-auto">
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                                    <span className="text-muted-foreground">Email Login:</span>
                                    <span className="font-semibold text-foreground">{formData.username}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                                    <span className="text-muted-foreground">Instansi:</span>
                                    <span className="font-semibold text-foreground">{formData.institution}</span>
                                </div>
                                {formData.target_certification_name && (
                                    <div className="flex justify-between items-start py-1 border-b border-slate-200/50 gap-3">
                                        <span className="text-muted-foreground shrink-0">Program:</span>
                                        <span className="font-semibold text-foreground text-right">{formData.target_certification_name}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                                    <span className="text-muted-foreground">Rencana:</span>
                                    <span className="font-semibold text-foreground">{formData.target_month} {formData.target_year}</span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-muted-foreground">Status:</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                        Menunggu Persetujuan Admin
                                    </span>
                                </div>
                            </div>

                            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                                Setelah pendaftaran disetujui, Nomor Induk Peserta (NIP) dan batch ujian akan otomatis diterbitkan.
                            </p>

                            <div className="pt-2">
                                <Link
                                    href="/auth/login"
                                    className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-xs"
                                >
                                    <span>Lanjut ke Halaman Login</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="w-full max-w-xl mx-auto pt-4 text-center border-t border-slate-200/60">
                    <p className="text-[11px] text-muted-foreground">
                        © {new Date().getFullYear()} Nusamitra Consulting. Portal Sertifikasi & Pelatihan Resmi.
                    </p>
                </div>
            </div>
        </div>
    );
}
