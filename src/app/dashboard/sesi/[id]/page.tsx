'use client';

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    PlayIcon,
    Clock01Icon,
    Tick01Icon,
    LockIcon,
    Book01Icon,
    Edit01Icon,
    AlertCircleIcon,
    Award01Icon,
    Download01Icon,
    Logout01Icon,
} from 'hugeicons-react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { CertificateTemplate } from '@/app/dashboard/_components/CertificateTemplate';
import AlertCustom, { useAlert } from '@/app/dashboard/_components/AlertCustom';

type ModuleItem = {
    module_item_id: string;
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
    item_title: string;
    duration_minutes: number | null;
    progress_status: 'locked' | 'open' | 'completed';
    score: number | null;
};

type SessionDetail = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    module_title: string;
    module_id: string;
    items: ModuleItem[];
};

export default function ParticipantSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSEB, setIsSEB] = useState(false);
    const { showAlert, AlertComponent } = useAlert();

    // Certificate States
    const [downloading, setDownloading] = useState(false);
    const [userName, setUserName] = useState('');
    const certificateRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsSEB(navigator.userAgent.includes('SafeExamBrowser'));

        // Fetch User Name for Certificate
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.success) setUserName(data.data.full_name);
            }).catch(() => { });

        fetch(`/api/participant/sessions/${id}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setSession(data.data);
                else setError(data.error || 'Gagal memuat sesi');
            })
            .catch(() => setError('Kesalahan jaringan'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleDownloadCertificate = async () => {
        if (downloading || !session || !certificateRef.current) return;

        try {
            setDownloading(true);
            const element = certificateRef.current;

            // Clone to avoid layout shift and ensure perfect rendering
            const clone = element.cloneNode(true) as HTMLElement;
            clone.style.position = 'fixed';
            clone.style.top = '0px';
            clone.style.left = '0px';
            clone.style.zIndex = '-9999';
            clone.style.opacity = '1';
            clone.style.display = 'flex';
            document.body.appendChild(clone);

            // Wait a tick for fonts/DOM to paint
            await new Promise((r) => setTimeout(r, 150));

            const imgData = await toJpeg(clone, {
                quality: 1.0,
                pixelRatio: 2, // Double resolution for sharpness
                backgroundColor: '#ffffff',
                width: 1123,
                height: 794
            });

            document.body.removeChild(clone);

            // Landscape A4
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
            pdf.save(`Sertifikat_${session.title.replace(/\s+/g, '_')}_${userName}.pdf`);
            showAlert('Sertifikat berhasil diunduh. Selamat!', 'success');

        } catch (error) {
            console.error('Failed to generate PDF:', error);
            showAlert('Gagal membuat sertifikat PDF. Pastikan koneksi stabil.', 'error');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={14} /> Kembali
                </Link>
                <div className="glass-card p-8 text-center">
                    <AlertCircleIcon size={36} className="mx-auto text-destructive mb-3" />
                    <p className="text-sm text-destructive font-semibold">{error || 'Sesi tidak ditemukan'}</p>
                </div>
            </div>
        );
    }

    const now = new Date();
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    const completedCount = session.items.filter((i) => i.progress_status === 'completed').length;
    const totalItems = session.items.length;
    const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

    // Auto-complete: 100% = Selesai regardless of time
    const isFullyCompleted = progress === 100 && totalItems > 0;
    const isActive = !isFullyCompleted && now >= start && now <= end;

    const statusLabel = isFullyCompleted ? 'Selesai' : isActive ? 'Berlangsung' : now < start ? 'Akan Datang' : 'Berakhir';
    const statusColor = isFullyCompleted ? 'bg-emerald-500' : isActive ? 'bg-emerald-500 animate-pulse' : now < start ? 'bg-blue-400' : 'bg-gray-300';

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-12">
            {AlertComponent}

            {/* Hidden Certificate Canvas */}
            {isFullyCompleted && (
                <div style={{ pointerEvents: 'none', position: 'absolute', left: '-99999px', top: '-99999px' }}>
                    <CertificateTemplate
                        ref={certificateRef}
                        participantName={userName}
                        courseName={session.title}
                        completionDate={now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        certificateId={`WIG-${session.id.split('-')[0].toUpperCase()}-${now.getFullYear()}`}
                    />
                </div>
            )}

            <div className="flex items-center justify-between gap-4">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={14} /> Kembali
                </Link>

                <div className="flex items-center gap-2">
                    {session.require_seb && !isSEB && (
                        <a
                            href={`/api/participant/sessions/${session.id}/seb-config`}
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full border border-slate-700 transition-all active:scale-95 shadow-sm"
                        >
                            <Download01Icon size={12} />
                            Download Config SEB
                        </a>
                    )}
                    
                    {isSEB && (
                        <Link
                            href="/quit-seb"
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-100 transition-all active:scale-95"
                        >
                            <Logout01Icon size={12} />
                            Keluar Aplikasi SEB
                        </Link>
                    )}
                </div>
            </div>

            {/* Compact Header */}
            <div className="glass-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{statusLabel}</span>
                        </div>
                        <h1 className="text-lg font-bold tracking-tight truncate">{session.title}</h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                            {session.module_title && <span>{session.module_title}</span>}
                            <span className="flex items-center gap-1">
                                <Clock01Icon size={10} />
                                {start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                {' — '}
                                {end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    {/* Progress Circle */}
                    <div className="shrink-0 w-14 h-14 relative">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="3" className="text-black/5" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" strokeWidth="3" strokeDasharray={`${progress}, 100`} strokeLinecap="round"
                                className={progress === 100 ? 'text-emerald-500' : 'text-foreground'}
                                style={{ transition: 'stroke-dasharray 1s ease' }} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{progress}%</span>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-black/5">
                    <span>{completedCount}/{totalItems} item selesai</span>
                    {isFullyCompleted && (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold">
                            <Award01Icon size={12} /> Semua selesai!
                        </span>
                    )}
                </div>
            </div>

            {/* 100% Completed Banner with Download Action */}
            {isFullyCompleted && (
                <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm border border-emerald-200">
                            <Award01Icon size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-800">Selamat! Sesi Selesai!</p>
                            <p className="text-xs text-emerald-600 mt-0.5">Anda telah berhasil menyelesaikan semua kurikulum dalam pelatihan ini.</p>
                        </div>
                    </div>

                    <button
                        onClick={handleDownloadCertificate}
                        disabled={downloading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold tracking-wide transition-colors shadow-sm"
                    >
                        {downloading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : <Download01Icon size={16} />}
                        {downloading ? 'Memproses PDF...' : 'Unduh Sertifikat PDF'}
                    </button>
                </div>
            )}

            {/* Module Items */}
            <div>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Daftar Materi & Ujian</h2>

                {session.items.length === 0 ? (
                    <div className="glass-card p-6 text-center text-xs text-muted-foreground">
                        Modul ini belum memiliki item.
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {session.items.map((item, idx) => (
                            <ItemRow
                                key={item.module_item_id}
                                item={item}
                                index={idx + 1}
                                sessionId={session.id}
                                isSessionActive={isActive}
                                requireSeb={session.require_seb}
                                isSeb={isSEB}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ItemRow({ item, index, sessionId, isSessionActive, requireSeb, isSeb }: {
    item: ModuleItem; index: number; sessionId: string; isSessionActive: boolean; requireSeb: boolean; isSeb: boolean;
}) {
    const isCompleted = item.progress_status === 'completed';
    const isLocked = item.progress_status === 'locked';
    const isExam = item.item_type === 'exam';
    const isTraining = item.item_type === 'training';
    const requireSebForThisItem = isExam && requireSeb;
    const sebLocked = requireSebForThisItem && !isSeb;

    // A completed training is ALWAYS accessible regardless of session status
    // A completed exam is accessible ONLY if it has can_retake = true AND session is active AND SEB is valid
    const canAccess = (isTraining && isCompleted) ||
        (isSessionActive && !isLocked && !sebLocked) ||
        (isExam && isCompleted && (item as any).can_retake && isSessionActive && !sebLocked);

    const href = isExam
        ? `/dashboard/sesi/${sessionId}/ujian/${item.item_id}`
        : `/dashboard/sesi/${sessionId}/materi/${item.item_id}`;

    const inner = (
        <div className={`glass-card px-4 py-3 flex flex-col gap-2 transition-all ${canAccess ? 'glass-card-hover group cursor-pointer' : ''} ${(isLocked || sebLocked) && !(isTraining && isCompleted) ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-3">
                {/* Step indicator */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold ${isCompleted
                    ? 'bg-emerald-100 text-emerald-600'
                    : canAccess ? 'bg-foreground text-background'
                        : 'bg-black/5 text-muted-foreground'
                    }`}>
                    {isCompleted ? <Tick01Icon size={14} /> : (isLocked || sebLocked) ? <LockIcon size={10} /> : index}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        {isExam ? <Edit01Icon size={11} className="text-muted-foreground shrink-0" />
                            : <Book01Icon size={11} className="text-muted-foreground shrink-0" />}
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            {isExam ? 'Ujian' : 'Materi'}
                        </span>
                        {isExam && (item as any).max_attempts > 1 && (
                            <span className="text-[9px] bg-black/5 px-1.5 py-0.5 rounded text-muted-foreground font-semibold ml-1">
                                {(item as any).attempts_count}/{(item as any).max_attempts} Percobaan
                            </span>
                        )}
                        {isExam && isCompleted && (item as any).can_retake && (
                            <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold ml-1">
                                Remidi
                            </span>
                        )}
                    </div>
                    <h3 className="text-sm font-semibold truncate leading-tight">{item.item_title || 'Untitled'}</h3>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 shrink-0">
                    {isExam && item.duration_minutes && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock01Icon size={9} /> {item.duration_minutes}m
                        </span>
                    )}
                    {isCompleted && item.score !== null && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {item.score}
                        </span>
                    )}
                    {isCompleted && !(isExam && (item as any).can_retake) && (
                        <Tick01Icon size={14} className="text-emerald-500" />
                    )}
                    {canAccess && (
                        <div className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center">
                            <PlayIcon size={10} />
                        </div>
                    )}
                </div>
            </div>

            {/* SEB Warning */}
            {sebLocked && (!isCompleted || (item as any).can_retake) && (
                <div className="flex items-center gap-1.5 text-[10px] text-destructive bg-destructive/10 px-2.5 py-1.5 rounded-md mt-1 w-fit">
                    <AlertCircleIcon size={12} />
                    <span>Ujian ini hanya dapat diakses melalui Safe Exam Browser (SEB).</span>
                </div>
            )}
        </div>
    );

    if (canAccess) {
        return <Link href={href}>{inner}</Link>;
    }

    return inner;
}
