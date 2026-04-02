'use client';

import React, { forwardRef } from 'react';

interface CertificateTemplateProps {
    participantName: string;
    courseName: string;
    completionDate: string;
    certificateId: string;
    finalScore: number;
}

export const CertificateTemplate = forwardRef<HTMLDivElement, CertificateTemplateProps>(
    ({ participantName, courseName, completionDate, certificateId, finalScore }, ref) => {
        return (
            <div
                ref={ref}
                className="relative bg-white flex flex-col items-center overflow-hidden font-sans"
                style={{
                    width: '794px',   // Portrait A4 width
                    height: '1123px', // Portrait A4 height
                    padding: '40px',
                    boxSizing: 'border-box'
                }}
            >
                {/* Thin elegant Outer Borders */}
                <div className="absolute inset-5 border-[1.5px] border-[#333] pointer-events-none" />
                <div className="absolute inset-7 border-[0.5px] border-[#666] pointer-events-none" />

                {/* Content Container */}
                <div className="flex-1 w-full flex flex-col grow justify-between py-12 px-6">

                    {/* Header */}
                    <div className="text-center mb-16">
                        <p className="text-xs font-semibold tracking-[0.2em] text-[#555] uppercase mb-4">
                            LMS System Training Center
                        </p>
                        <hr className="w-16 border-[#999] mx-auto" />
                    </div>

                    {/* Title */}
                    <div className="text-center mb-16">
                        <h1 className="text-4xl font-serif font-bold text-[#111] uppercase tracking-[0.15em] mb-8 leading-snug">
                            Tanda Selesai<br />Sertifikasi
                        </h1>
                        <p className="text-xs tracking-[0.25em] font-bold uppercase text-[#555]">
                            Diberikan Kepada
                        </p>
                    </div>

                    {/* Name */}
                    <div className="text-center mb-16">
                        <h2 className="text-[2.75rem] font-serif font-black text-[#111] capitalize px-4">
                            {participantName}
                        </h2>
                        <div className="w-full h-[1.5px] bg-[#333] mt-3 mx-auto max-w-sm" />
                    </div>

                    {/* Description */}
                    <div className="text-center px-12 mb-16">
                        <p className="text-base leading-relaxed text-[#444] italic font-serif">
                            Untuk keberhasilannya menyelesaikan seluruh kurikulum pelatihan dan
                            lulus evaluasi wajib pada spesialisasi modul:
                        </p>
                        <h3 className="text-3xl font-bold font-serif text-[#111] mt-8 tracking-wide">
                            &quot;{courseName}&quot;
                        </h3>
                    </div>

                    {/* Score section */}
                    <div className="text-center mb-auto pt-6">
                        <div className="inline-block border-[1px] border-[#ddd] px-14 py-6 bg-[#fafafa]">
                            <p className="text-[10px] font-bold tracking-[0.25em] text-[#666] uppercase mb-3">Skor Akhir</p>
                            <p className="text-5xl font-black font-serif text-[#111] tracking-tighter">{finalScore.toFixed(0)}</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-end border-t border-[#ddd] pt-8 mt-16 px-4">
                        <div className="text-left w-48">
                            <p className="text-[9px] text-[#666] font-bold tracking-widest uppercase mb-1">Tanggal Disahkan</p>
                            <p className="text-sm font-semibold text-[#111]">{completionDate}</p>
                        </div>

                        <div className="text-center flex-1 px-4">
                            <p className="text-[8px] text-[#888] font-bold tracking-[0.15em] uppercase mb-1">ID Verifikasi Registrasi</p>
                            <p className="text-[10px] font-mono text-[#555]">{certificateId}</p>
                        </div>

                        <div className="text-right w-48 pb-1">
                            <div className="w-full border-b-[1.5px] border-[#333] mb-2 relative h-12">
                                <span className="absolute bottom-1 right-0 left-0 text-center text-4xl opacity-50 font-serif italic text-[#111]" style={{ fontFamily: 'Georgia, serif' }}>
                                    LMS Admin
                                </span>
                            </div>
                            <p className="text-[9px] text-[#666] font-bold uppercase tracking-widest">Otorisasi Resmi</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

CertificateTemplate.displayName = 'CertificateTemplate';
