'use client';

import { forwardRef } from 'react';

type CertificateProps = {
    participantName: string;
    courseName: string;
    completionDate: string;
    certificateId: string;
};

export const CertificateTemplate = forwardRef<HTMLDivElement, CertificateProps>(
    ({ participantName, courseName, completionDate, certificateId }, ref) => {
        return (
            <div
                ref={ref}
                style={{
                    backgroundColor: '#ffffff',
                    width: '1123px',
                    height: '794px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    textAlign: 'center',
                    paddingTop: '40px',
                    paddingBottom: '32px',
                    paddingLeft: '96px',
                    paddingRight: '96px',
                    boxSizing: 'border-box',
                    backgroundImage: 'radial-gradient(circle at center, #ffffff 0%, #fefcf3 100%)'
                }}
            >
                {/* Outer Border */}
                <div style={{
                    position: 'absolute',
                    inset: '16px',
                    border: '4px solid rgba(217, 119, 6, 0.8)',
                    pointerEvents: 'none'
                }}></div>

                {/* Inner Border */}
                <div style={{
                    position: 'absolute',
                    inset: '24px',
                    border: '1px solid rgba(217, 119, 6, 0.3)',
                    pointerEvents: 'none'
                }}></div>

                {/* Corner Ornaments */}
                <div style={{ position: 'absolute', top: '32px', left: '32px', width: '64px', height: '64px', borderTop: '4px solid #f59e0b', borderLeft: '4px solid #f59e0b', opacity: 0.5 }}></div>
                <div style={{ position: 'absolute', top: '32px', right: '32px', width: '64px', height: '64px', borderTop: '4px solid #f59e0b', borderRight: '4px solid #f59e0b', opacity: 0.5 }}></div>
                <div style={{ position: 'absolute', bottom: '32px', left: '32px', width: '64px', height: '64px', borderBottom: '4px solid #f59e0b', borderLeft: '4px solid #f59e0b', opacity: 0.5 }}></div>
                <div style={{ position: 'absolute', bottom: '32px', right: '32px', width: '64px', height: '64px', borderBottom: '4px solid #f59e0b', borderRight: '4px solid #f59e0b', opacity: 0.5 }}></div>

                {/* Header Logo & Title */}
                <div style={{ marginBottom: '32px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '24px',
                        marginBottom: '24px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                    }}>
                        <span style={{ opacity: 0.9 }}>WIG</span>
                    </div>
                    <h1 style={{
                        fontSize: '48px',
                        fontWeight: 800,
                        color: '#1e293b',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                        fontFamily: 'Georgia, serif'
                    }}>
                        Certificate of Completion
                    </h1>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#d97706', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                        This proudly certifies that
                    </p>
                </div>

                {/* Participant Name */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px', zIndex: 10 }}>
                    <h2 style={{
                        fontSize: '60px',
                        fontWeight: 700,
                        fontStyle: 'italic',
                        color: '#1e293b',
                        paddingBottom: '8px',
                        paddingLeft: '48px',
                        paddingRight: '48px',
                        textTransform: 'capitalize',
                        fontFamily: "'Times New Roman', serif"
                    }}>
                        {participantName}
                    </h2>
                    <div style={{
                        width: '66%',
                        height: '2px',
                        background: 'linear-gradient(to right, transparent, #f59e0b, transparent)',
                        opacity: 0.6
                    }}></div>
                </div>

                {/* Body Text */}
                <div style={{ maxWidth: '768px', zIndex: 10, marginBottom: '80px' }}>
                    <p style={{ fontSize: '16px', color: '#475569', letterSpacing: '0.05em', marginBottom: '16px' }}>
                        Has successfully fulfilled the requirements and completed the training program entitled:
                    </p>
                    <h3 style={{ fontSize: '30px', fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
                        {courseName}
                    </h3>
                </div>

                {/* Footer Signatures & Date */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: '64px', paddingRight: '64px', zIndex: 10, marginTop: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', borderBottom: '1px solid rgba(0,0,0,0.2)', paddingBottom: '4px', width: '192px' }}>
                            {completionDate}
                        </span>
                        <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>Date Awarded</span>
                    </div>

                    {/* Seal Placeholder */}
                    <div style={{
                        width: '128px',
                        height: '128px',
                        position: 'absolute',
                        bottom: '48px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        opacity: 0.2,
                        background: 'radial-gradient(circle at center, #d97706 0%, transparent 70%)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            width: '96px',
                            height: '96px',
                            border: '2px dashed #b45309',
                            borderRadius: '50%'
                        }}></div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ height: '40px', borderBottom: '1px solid rgba(0,0,0,0.2)', width: '192px', marginBottom: '8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                            <span style={{ fontSize: '30px', opacity: 0.7, fontStyle: 'italic', color: '#1e293b', fontFamily: 'Brush Script MT, cursive' }}>Director</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>Training Director</span>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>WIG Academy</span>
                    </div>
                </div>

                {/* Verification ID */}
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '40px',
                    fontSize: '9px',
                    fontFamily: 'monospace',
                    color: '#94a3b8',
                    opacity: 0.6,
                    textAlign: 'left'
                }}>
                    <p>VERIFICATION ID: {certificateId}</p>
                    <p style={{ marginTop: '2px', opacity: 0.5 }}>This document verifies completion in accordance with institutional standards.</p>
                </div>
            </div>
        );
    }
);

CertificateTemplate.displayName = 'CertificateTemplate';
