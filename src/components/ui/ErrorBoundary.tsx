'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert02Icon, RefreshIcon, Home01Icon } from 'hugeicons-react';
import Link from 'next/link';

interface Props {
    children: ReactNode;
    fallbackMessage?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[React Error Boundary Caught]:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[400px] flex items-center justify-center p-6 text-center">
                    <div className="max-w-md w-full glass-card p-8 rounded-3xl space-y-6 shadow-xl border border-black/10">
                        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                            <Alert02Icon size={32} />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground">
                                Terjadi Kesalahan Tampilan
                            </h2>
                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                {this.props.fallbackMessage || 'Komponen aplikasi mengalami masalah saat menampilkan data. Jangan khawatir, data Anda tetap aman.'}
                            </p>
                        </div>

                        {this.state.error?.message && (
                            <div className="bg-rose-50 text-rose-800 p-3 rounded-xl text-xs font-mono text-left break-all border border-rose-200">
                                <strong>Detail Error:</strong> {this.state.error.message}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 py-3 px-4 text-xs font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                            >
                                <RefreshIcon size={16} />
                                Muat Ulang Halaman
                            </button>
                            <Link
                                href="/dashboard"
                                onClick={() => this.setState({ hasError: false, error: null })}
                                className="flex-1 py-3 px-4 text-xs font-semibold rounded-xl border border-black/10 hover:bg-black/5 transition-colors flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Home01Icon size={16} />
                                Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
