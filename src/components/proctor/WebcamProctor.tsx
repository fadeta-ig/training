'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minimize2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SNAPSHOT_INTERVAL_MS = 3 * 60 * 1000;

interface WebcamProctorProps {
    sessionId: string;
    isActive: boolean;
    onSnapshotSent?: () => void;
    onError?: (error: string) => void;
}

export default function WebcamProctor({
    sessionId,
    isActive,
    onSnapshotSent,
    onError,
}: WebcamProctorProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [minimized, setMinimized] = useState(false);

    useEffect(() => {
        setMinimized(window.matchMedia('(max-width: 767px)').matches);
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: 'user' },
                audio: false,
            });
            if (videoRef.current) videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setIsStreaming(true);
        } catch {
            onError?.('Akses webcam ditolak atau kamera tidak tersedia.');
            setIsStreaming(false);
        }
    }, [onError]);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsStreaming(false);
    }, []);

    const captureSnapshot = useCallback((): string | null => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return null;

        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.6);
    }, []);

    const sendSnapshot = useCallback(async () => {
        const imageBase64 = captureSnapshot();
        if (!imageBase64) return;
        try {
            const response = await fetch('/api/proctor/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, imageBase64 }),
            });
            if (!response.ok) throw new Error(`Snapshot API returned ${response.status}`);
            onSnapshotSent?.();
        } catch (error) {
            console.error('[PROCTOR]', error instanceof Error ? error.message : 'Snapshot gagal dikirim');
        }
    }, [captureSnapshot, onSnapshotSent, sessionId]);

    useEffect(() => {
        if (isActive && isStreaming) {
            // The video element needs time to become ready (readyState >= 2)
            // after the stream starts. Wait briefly before attempting the first snapshot.
            let cancelled = false;
            let retryCount = 0;
            const MAX_RETRIES = 3;
            const INITIAL_DELAY_MS = 1500;
            const RETRY_DELAY_MS = 1000;

            const attemptInitialSnapshot = () => {
                if (cancelled) return;
                const video = videoRef.current;
                if (video && video.readyState >= 2) {
                    sendSnapshot();
                    intervalRef.current = setInterval(sendSnapshot, SNAPSHOT_INTERVAL_MS);
                } else if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    setTimeout(attemptInitialSnapshot, RETRY_DELAY_MS);
                } else {
                    // Video never became ready — start interval anyway so future snapshots can still attempt
                    intervalRef.current = setInterval(sendSnapshot, SNAPSHOT_INTERVAL_MS);
                }
            };

            const initialTimer = setTimeout(attemptInitialSnapshot, INITIAL_DELAY_MS);

            return () => {
                cancelled = true;
                clearTimeout(initialTimer);
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            };
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isActive, isStreaming, sendSnapshot]);

    useEffect(() => {
        if (isActive) startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [isActive, startCamera, stopCamera]);

    return (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-40 sm:right-4">
            {minimized ? (
                <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="relative rounded-lg bg-background shadow-md"
                    onClick={() => setMinimized(false)}
                    aria-label="Tampilkan kamera proctoring"
                    title="Tampilkan kamera proctoring"
                >
                    <Video />
                    {isActive && isStreaming && (
                        <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500 ring-2 ring-background" />
                    )}
                </Button>
            ) : (
                <div className="w-40 overflow-hidden rounded-lg border bg-background shadow-lg sm:w-44">
                    <div className="flex h-8 items-center justify-between border-b px-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                            <span className={`size-1.5 rounded-full ${isActive && isStreaming ? 'bg-red-500' : 'bg-muted-foreground/40'}`} />
                            Proctoring
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setMinimized(true)}
                            aria-label="Minimalkan kamera proctoring"
                            title="Minimalkan kamera proctoring"
                        >
                            <Minimize2 />
                        </Button>
                    </div>
                    <div className="relative aspect-[4/3] bg-black">
                        <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
                        {!isStreaming && (
                            <div className="absolute inset-0 grid place-items-center text-white/60">
                                <Video className="size-5" />
                            </div>
                        )}
                    </div>
                </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
