'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const SNAPSHOT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

interface WebcamProctorProps {
    sessionId: string;
    userId: string;
    /** Whether proctoring is actively capturing snapshots */
    isActive: boolean;
    /** Callback when a snapshot is successfully sent */
    onSnapshotSent?: () => void;
    /** Callback on error (permission denied, camera unavailable) */
    onError?: (error: string) => void;
}

/**
 * WebcamProctor Component
 *
 * Renders a small live preview of the user's webcam.
 * When `isActive` is true, captures a Base64 snapshot every 3 minutes
 * and sends it to `/api/proctor/snapshot`.
 */
export default function WebcamProctor({
    sessionId,
    userId,
    isActive,
    onSnapshotSent,
    onError,
}: WebcamProctorProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    /** Initialize webcam stream */
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: 'user' },
                audio: false,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            streamRef.current = stream;
            setIsStreaming(true);
        } catch {
            const message = 'Webcam access denied or unavailable.';
            onError?.(message);
            setIsStreaming(false);
        }
    }, [onError]);

    /** Stop webcam stream */
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsStreaming(false);
    }, []);

    /** Capture a single frame as Base64 JPEG */
    const captureSnapshot = useCallback((): string | null => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || video.readyState < 2) {
            return null;
        }

        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.6);
    }, []);

    /** Send snapshot to the proctor API */
    const sendSnapshot = useCallback(async () => {
        const imageBase64 = captureSnapshot();
        if (!imageBase64) return;

        try {
            const response = await fetch('/api/proctor/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    userId,
                    imageBase64,
                }),
            });

            if (!response.ok) {
                throw new Error(`Snapshot API returned ${response.status}`);
            }

            onSnapshotSent?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Snapshot send failed';
            console.error('[PROCTOR]', message);
        }
    }, [captureSnapshot, sessionId, userId, onSnapshotSent]);

    /** Start/stop the periodic capture interval */
    useEffect(() => {
        if (isActive && isStreaming) {
            // Send first snapshot immediately
            sendSnapshot();

            intervalRef.current = setInterval(sendSnapshot, SNAPSHOT_INTERVAL_MS);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isActive, isStreaming, sendSnapshot]);

    /** Manage camera lifecycle */
    useEffect(() => {
        if (isActive) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => stopCamera();
    }, [isActive, startCamera, stopCamera]);

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Live Preview */}
            <div className="glass-card overflow-hidden w-[200px] shadow-lg">
                <div className="relative">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-auto rounded-t-2xl object-cover"
                    />
                    {/* Recording indicator */}
                    {isActive && isStreaming && (
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-red-500/80 text-white text-[10px] font-semibold rounded-full backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            PROCTORING
                        </div>
                    )}
                </div>
                <div className="px-3 py-2 text-[11px] text-muted-foreground text-center">
                    Kamera aktif — snapshot setiap 3 menit
                </div>
            </div>

            {/* Hidden canvas for capturing frames */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
