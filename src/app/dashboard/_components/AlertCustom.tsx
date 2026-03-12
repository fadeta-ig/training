'use client';

import { useState, useEffect } from 'react';
import {
    AlertCircleIcon,
    Tick01Icon,
    InformationCircleIcon,
    Cancel01Icon
} from 'hugeicons-react';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

interface AlertProps {
    message: string;
    type: AlertType;
    onClose: () => void;
    duration?: number;
}

export default function AlertCustom({ message, type, onClose, duration = 5000 }: AlertProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for fade out animation
    };

    const icons = {
        success: <Tick01Icon className="text-emerald-500" size={20} />,
        error: <Cancel01Icon className="text-rose-500" size={20} />,
        info: <InformationCircleIcon className="text-blue-500" size={20} />,
        warning: <AlertCircleIcon className="text-amber-500" size={20} />
    };

    const styles = {
        success: 'border-emerald-100 bg-emerald-50/50',
        error: 'border-rose-100 bg-rose-50/50',
        info: 'border-blue-100 bg-blue-50/50',
        warning: 'border-amber-100 bg-amber-50/50'
    };

    return (
        <div
            className={`fixed top-6 right-6 z-50 transition-all duration-300 transform ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
                }`}
        >
            <div className={`glass-card p-4 min-w-[300px] max-w-md border-2 shadow-2xl flex items-start gap-3 backdrop-blur-xl ${styles[type]}`}>
                <div className="shrink-0 mt-0.5">
                    {icons[type]}
                </div>
                <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800 leading-tight">
                        {type === 'error' ? 'Gagal' : type === 'success' ? 'Berhasil' : 'Informasi'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 font-medium italic">
                        {message}
                    </p>
                </div>
                <button
                    onClick={handleClose}
                    className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <Cancel01Icon size={16} />
                </button>
            </div>
        </div>
    );
}

// Hook to manage alerts easily
export function useAlert() {
    const [alert, setAlert] = useState<{ message: string; type: AlertType } | null>(null);

    const showAlert = (message: string, type: AlertType) => {
        setAlert({ message, type });
    };

    const hideAlert = () => {
        setAlert(null);
    };

    const AlertComponent = alert ? (
        <AlertCustom
            message={alert.message}
            type={alert.type}
            onClose={hideAlert}
        />
    ) : null;

    return { showAlert, AlertComponent };
}
