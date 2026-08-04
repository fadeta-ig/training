import { ReactNode } from 'react';
import { Alert02Icon } from 'hugeicons-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDestructive?: boolean;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Ya, Lanjutkan',
    cancelLabel = 'Batal',
    onConfirm,
    onCancel,
    isDestructive = false
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-black/10 bg-background shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 sm:max-h-[calc(100dvh-2rem)]"
                role="dialog"
                aria-modal="true"
            >
                <div className="p-4 sm:p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                            <Alert02Icon size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
                            <div className="text-muted-foreground text-sm leading-relaxed">
                                {message}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col-reverse gap-2 bg-black/5 px-4 py-4 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-black/10 outline-none focus:ring-2 focus:ring-ring dark:hover:bg-white/10 sm:w-auto"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-auto ${isDestructive
                                ? 'bg-destructive hover:bg-destructive/90'
                                : 'bg-primary hover:bg-primary/90'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
