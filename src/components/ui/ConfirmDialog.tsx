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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-background border border-black/10 dark:border-white/10 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
            >
                <div className="p-6">
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
                <div className="bg-black/5 dark:bg-white/5 px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-semibold rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-foreground transition-colors outline-none focus:ring-2 focus:ring-ring"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors shadow-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${isDestructive
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
