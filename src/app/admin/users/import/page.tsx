'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
    CloudUploadIcon,
    Download01Icon,
    ArrowLeft01Icon,
    Tick01Icon,
    Alert02Icon,
    Key01Icon,
    MailSend01Icon,
    RefreshIcon,
    UserGroupIcon
} from 'hugeicons-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { objectsToCsv, parseCsvToObjects } from '@/lib/csv';

interface ParsedUserRow {
    index: number;
    name: string;
    email: string;
    role: 'admin' | 'trainer';
    password?: string;
    phone_number: string;
    institution: string;
    isValid: boolean;
    errorReason?: string;
}

interface UserCredentialResult {
    name: string;
    email: string;
    password: string;
    role: string;
}

interface FailedResult {
    name: string;
    email: string;
    reason: string;
}

export default function BulkImportUsersPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [fileName, setFileName] = useState<string>('');
    const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
    const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'invalid'>('all');
    const [sendEmail, setSendEmail] = useState<boolean>(true);

    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [importResults, setImportResults] = useState<{
        importedCount: number;
        failedCount: number;
        credentials: UserCredentialResult[];
        failed: FailedResult[];
    } | null>(null);

    // Step 1: Handle File Selection & Parse
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        processFile(file);
    };

    const processFile = async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            toast.error('Format file tidak didukung. Gunakan file .csv dari template sistem.');
            return;
        }

        setFileName(file.name);
        try {
            const data = parseCsvToObjects(await file.text());

            if (!data || data.length === 0) {
                toast.error('File kosong atau format tidak sesuai');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const seenEmails = new Set<string>();

            const rows: ParsedUserRow[] = data.map((item, idx) => {
                const normalized: Record<string, string> = {};
                Object.keys(item).forEach(key => {
                    const cleanKey = key.trim().toLowerCase();
                    normalized[cleanKey] = String(item[key]).trim();
                });

                const name = normalized['nama lengkap'] || normalized['nama'] || normalized['name'] || '';
                const email = (normalized['email aktif (username)'] || normalized['email aktif'] || normalized['username'] || normalized['email'] || '').toLowerCase();
                const rawRole = (normalized['role (admin/trainer)'] || normalized['role'] || normalized['peran'] || 'trainer').toLowerCase();
                const role: 'admin' | 'trainer' = (rawRole.includes('admin') || rawRole === 'administrator') ? 'admin' : 'trainer';
                const password = normalized['password (opsional)'] || normalized['password'] || '';
                const phone_number = normalized['no hp'] || normalized['telepon'] || normalized['phone'] || '';
                const institution = normalized['institusi'] || normalized['instansi'] || normalized['institution'] || '';

                let isValid = true;
                let errorReason = '';

                if (!name || name.length < 3) {
                    isValid = false;
                    errorReason = 'Nama lengkap minimal 3 karakter';
                } else if (!email || !emailRegex.test(email)) {
                    isValid = false;
                    errorReason = 'Format email (username) tidak valid';
                } else if (seenEmails.has(email)) {
                    isValid = false;
                    errorReason = 'Duplikasi email dalam file';
                } else {
                    seenEmails.add(email);
                }

                return {
                    index: idx + 1,
                    name,
                    email,
                    role,
                    password,
                    phone_number,
                    institution,
                    isValid,
                    errorReason,
                };
            });

            setParsedRows(rows);
            setStep(2);
            toast.success(`Berhasil membaca ${rows.length} baris data dari file`);
        } catch (err) {
            console.error(err);
            toast.error('Gagal membaca file CSV. Pastikan format file sesuai.');
        }
    };

    // Step 2: Submit Valid Rows to Backend
    const handleExecuteImport = async () => {
        const validRows = parsedRows.filter(r => r.isValid);
        if (validRows.length === 0) {
            toast.error('Tidak ada data valid untuk diimport');
            return;
        }

        setIsProcessing(true);
        try {
            const res = await fetch('/api/admin/users/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    users: validRows.map(r => ({
                        name: r.name,
                        email: r.email,
                        role: r.role,
                        password: r.password,
                        phone_number: r.phone_number,
                        institution: r.institution,
                    })),
                    sendEmail,
                }),
            });

            const result = await res.json();
            if (res.ok && result.success) {
                setImportResults({
                    importedCount: result.importedCount,
                    failedCount: result.failedCount + (parsedRows.length - validRows.length),
                    credentials: result.credentials || [],
                    failed: [...(result.failed || []), ...parsedRows.filter(r => !r.isValid).map(r => ({ name: r.name, email: r.email, reason: r.errorReason || 'Format tidak valid' }))],
                });
                setStep(3);
                toast.success(`Import selesai! ${result.importedCount} pengguna berhasil dibuat.`);
            } else {
                toast.error('Gagal memproses import', { description: result.error });
            }
        } catch (err: any) {
            toast.error('Terjadi kesalahan koneksi', { description: err.message });
        } finally {
            setIsProcessing(false);
        }
    };

    // Download Credentials Report (.csv)
    const handleDownloadReport = () => {
        if (!importResults || importResults.credentials.length === 0) return;

        const reportData = importResults.credentials.map((c, idx) => ({
            'No': idx + 1,
            'Nama Lengkap': c.name,
            'Username (Email)': c.email,
            'Peran (Role)': c.role,
            'Password Baru': c.password,
            'Status': 'Berhasil Diimport'
        }));

        const csv = objectsToCsv(reportData, ['No', 'Nama Lengkap', 'Username (Email)', 'Peran (Role)', 'Password Baru', 'Status']);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rekap_Kredensial_Pengguna_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Rekap kredensial pengguna berhasil diunduh');
    };

    const validCount = parsedRows.filter(r => r.isValid).length;
    const invalidCount = parsedRows.filter(r => !r.isValid).length;

    const displayedRows = parsedRows.filter(r => {
        if (filterTab === 'valid') return r.isValid;
        if (filterTab === 'invalid') return !r.isValid;
        return true;
    });

    return (
        <div className="space-y-8 max-w-6xl">
            {/* Header */}
            <div className="flex items-start gap-3 border-b border-black/5 pb-5 sm:items-center sm:gap-4 sm:pb-6">
                <Link
                    href="/admin/users"
                    className="shrink-0 p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <UserGroupIcon size={28} className="text-muted-foreground" />
                        Import Massal Pengguna (Admin & Trainer)
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Unggah berkas CSV untuk mendaftarkan akun Administrator atau Pelatih (Trainer) secara sekaligus.
                    </p>
                </div>
            </div>

            {/* Stepper Progress */}
            <div className="grid grid-cols-3 gap-2 text-center sm:gap-4">
                <div className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition-all sm:flex-row sm:gap-2 sm:p-3 sm:text-sm ${step === 1 ? 'bg-foreground text-background border-foreground shadow-sm' : 'bg-black/5 border-transparent text-muted-foreground'}`}>
                    <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-xs">1</span>
                    Unggah Berkas
                </div>
                <div className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition-all sm:flex-row sm:gap-2 sm:p-3 sm:text-sm ${step === 2 ? 'bg-foreground text-background border-foreground shadow-sm' : 'bg-black/5 border-transparent text-muted-foreground'}`}>
                    <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-xs">2</span>
                    Pratinjau & Validasi
                </div>
                <div className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition-all sm:flex-row sm:gap-2 sm:p-3 sm:text-sm ${step === 3 ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-black/5 border-transparent text-muted-foreground'}`}>
                    <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-xs">3</span>
                    Hasil & Kredensial
                </div>
            </div>

            {/* STEP 1: Upload & Download Template */}
            {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <GlassCard className="space-y-6 p-4 sm:p-6 md:col-span-2 md:p-8">
                        <div>
                            <h2 className="text-xl font-bold">Unggah File Data Pengguna</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Mendukung format <strong>.csv</strong> dari template sistem.
                            </p>
                        </div>

                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer space-y-4 rounded-2xl border-2 border-dashed border-black/15 p-6 text-center transition-all hover:border-foreground/50 hover:bg-black/[0.02] sm:p-10"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-black/5 text-muted-foreground flex items-center justify-center mx-auto">
                                <CloudUploadIcon size={32} />
                            </div>
                            <div>
                                <p className="text-base font-semibold">Tarik & Lepaskan File di Sini</p>
                                <p className="text-xs text-muted-foreground mt-1">atau klik untuk memilih berkas dari komputer Anda</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>
                    </GlassCard>

                    <GlassCard className="flex flex-col justify-between space-y-6 p-4 sm:p-6 md:p-8">
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                                <Download01Icon size={24} />
                            </div>
                            <h3 className="text-lg font-bold">Belum Punya Template?</h3>
                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                Unduh contoh berkas CSV resmi untuk pendaftaran Admin/Trainer agar format data langsung sesuai dengan sistem.
                            </p>
                        </div>

                        <a
                            href="/api/admin/users/import/template"
                            download
                            className="w-full px-5 py-3 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                        >
                            <Download01Icon size={18} />
                            Unduh Template (.csv)
                        </a>
                    </GlassCard>
                </div>
            )}

            {/* STEP 2: Preview & Validation */}
            {step === 2 && (
                <div className="space-y-6">
                    {/* Summary Bar */}
                    <GlassCard className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase">File Terbaca</p>
                                <p className="text-base font-bold text-foreground mt-0.5">{fileName}</p>
                            </div>
                            <div className="h-8 w-px bg-black/10 hidden md:block" />
                            <div className="flex items-center gap-4">
                                <span className="px-3 py-1.5 rounded-lg bg-black/5 text-xs font-bold">
                                    Total: {parsedRows.length}
                                </span>
                                <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                                    Valid: {validCount}
                                </span>
                                {invalidCount > 0 && (
                                    <span className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold">
                                        Error: {invalidCount}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-black/10 hover:bg-black/5 transition-colors"
                            >
                                Ganti File
                            </button>

                            <button
                                onClick={handleExecuteImport}
                                disabled={isProcessing || validCount === 0}
                                className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    <>
                                        <RefreshIcon size={16} className="animate-spin" />
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <Tick01Icon size={16} />
                                        Proses {validCount} Data Valid
                                    </>
                                )}
                            </button>
                        </div>
                    </GlassCard>

                    {/* Email Option Checkbox */}
                    <GlassCard className="flex flex-col items-stretch justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={sendEmail}
                                onChange={(e) => setSendEmail(e.target.checked)}
                                className="w-5 h-5 rounded border-black/20 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                                <p className="text-sm font-bold flex items-center gap-2">
                                    <MailSend01Icon size={16} className="text-emerald-600" />
                                    Kirim Kredensial via Email Otomatis
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Sistem akan langsung mengirim email berisi Username & Password ke setiap pengguna yang berhasil diimport.
                                </p>
                            </div>
                        </label>
                    </GlassCard>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 border-b border-black/5 pb-2">
                        <button
                            onClick={() => setFilterTab('all')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${filterTab === 'all' ? 'bg-black/10 text-foreground' : 'text-muted-foreground hover:bg-black/5'}`}
                        >
                            Semua Data ({parsedRows.length})
                        </button>
                        <button
                            onClick={() => setFilterTab('valid')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${filterTab === 'valid' ? 'bg-emerald-100 text-emerald-800' : 'text-muted-foreground hover:bg-black/5'}`}
                        >
                            Hanya Valid ({validCount})
                        </button>
                        <button
                            onClick={() => setFilterTab('invalid')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${filterTab === 'invalid' ? 'bg-rose-100 text-rose-800' : 'text-muted-foreground hover:bg-black/5'}`}
                        >
                            Hanya Error ({invalidCount})
                        </button>
                    </div>

                    {/* Preview Table */}
                    <GlassCard className="overflow-hidden">
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-black/5 border-b border-black/5 text-muted-foreground font-medium uppercase text-xs tracking-wider sticky top-0 bg-white">
                                    <tr>
                                        <th className="px-4 py-3">No</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Nama Lengkap</th>
                                        <th className="px-4 py-3">Username (Email)</th>
                                        <th className="px-4 py-3">Role</th>
                                        <th className="px-4 py-3">Password</th>
                                        <th className="px-4 py-3">Keterangan / Error</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5">
                                    {displayedRows.map((r) => (
                                        <tr key={r.index} className={`transition-colors ${r.isValid ? 'hover:bg-black/5' : 'bg-rose-50/50 hover:bg-rose-50'}`}>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.index}</td>
                                            <td className="px-4 py-3">
                                                {r.isValid ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                                        <Tick01Icon size={12} /> Valid
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold">
                                                        <Alert02Icon size={12} /> Error
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-foreground">{r.name || '-'}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{r.email || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${r.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                    {r.role === 'admin' ? 'Administrator' : 'Trainer'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                {r.password ? r.password : <span className="italic text-muted-foreground/60">(Auto Generate)</span>}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {r.isValid ? (
                                                    <span className="text-emerald-700 font-medium">Siap diimport</span>
                                                ) : (
                                                    <span className="text-rose-700 font-bold">{r.errorReason}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* STEP 3: Results & Download Credentials Report */}
            {step === 3 && importResults && (
                <GlassCard className="mx-auto max-w-2xl space-y-8 p-4 text-center sm:p-6 md:p-8">
                    <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                        <Key01Icon size={40} />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Proses Import Pengguna Selesai!</h2>
                        <p className="text-sm text-muted-foreground mt-2">
                            Berikut adalah ringkasan hasil proses eksekusi import massal akun pengguna:
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                            <p className="text-xs font-bold text-emerald-700 uppercase">Berhasil Diimport</p>
                            <p className="text-3xl font-extrabold text-emerald-900 mt-1">{importResults.importedCount}</p>
                            <p className="text-xs text-emerald-700 mt-1">Akun pengguna dibuat</p>
                        </div>
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                            <p className="text-xs font-bold text-rose-700 uppercase">Gagal / Dilewati</p>
                            <p className="text-3xl font-extrabold text-rose-900 mt-1">{importResults.failedCount}</p>
                            <p className="text-xs text-rose-700 mt-1">Baris duplikat/invalid</p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-4 pt-2">
                        {importResults.credentials.length > 0 && (
                            <button
                                onClick={handleDownloadReport}
                                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                            >
                                <Download01Icon size={18} />
                                Unduh Rekap Kredensial Pengguna (.csv)
                            </button>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    setStep(1);
                                    setParsedRows([]);
                                    setFileName('');
                                    setImportResults(null);
                                }}
                                className="flex-1 py-3 px-4 rounded-xl border border-black/10 hover:bg-black/5 font-semibold text-sm transition-colors active:scale-95"
                            >
                                Import File Lain
                            </button>
                            <Link
                                href="/admin/users"
                                className="flex-1 py-3 px-4 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold text-sm transition-colors text-center active:scale-95"
                            >
                                Ke Daftar Pengguna
                            </Link>
                        </div>
                    </div>
                </GlassCard>
            )}
        </div>
    );
}
