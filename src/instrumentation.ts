declare global {
    var __emailOutboxWorkerStarted: boolean | undefined;
}

export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs' || global.__emailOutboxWorkerStarted) return;
    global.__emailOutboxWorkerStarted = true;
    const { processEmailOutbox } = await import('@/lib/email-outbox');
    const run = () => processEmailOutbox().catch((error) => {
        console.error('[EMAIL_OUTBOX_WORKER]', error instanceof Error ? error.message : error);
    });
    void run();
    setInterval(run, 15_000).unref();
}
