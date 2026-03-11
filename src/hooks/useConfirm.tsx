import { useState, useCallback } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface UseConfirmOptions {
    title: string;
    message: string | React.ReactNode;
    isDestructive?: boolean;
    confirmLabel?: string;
    cancelLabel?: string;
}

export function useConfirm() {
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        title: string;
        message: string | React.ReactNode;
        isDestructive: boolean;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm: () => void;
        onCancel: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        isDestructive: false,
        onConfirm: () => { },
        onCancel: () => { },
    });

    const confirm = useCallback((options: UseConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setDialogState({
                isOpen: true,
                title: options.title,
                message: options.message,
                isDestructive: options.isDestructive || false,
                confirmLabel: options.confirmLabel,
                cancelLabel: options.cancelLabel,
                onConfirm: () => {
                    setDialogState(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setDialogState(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                }
            });
        });
    }, []);

    const ConfirmComponent = useCallback(() => (
        <ConfirmDialog
            isOpen={dialogState.isOpen}
            title={dialogState.title}
            message={dialogState.message}
            onConfirm={dialogState.onConfirm}
            onCancel={dialogState.onCancel}
            isDestructive={dialogState.isDestructive}
            confirmLabel={dialogState.confirmLabel}
            cancelLabel={dialogState.cancelLabel}
        />
    ), [dialogState]);

    return { confirm, ConfirmComponent };
}
