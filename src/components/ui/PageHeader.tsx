import React from "react"
import Link from "next/link"
import { PlusSignIcon, RefreshIcon } from "hugeicons-react"

interface PageHeaderProps {
    title: string
    description?: string
    subtitle?: string
    icon?: React.ReactNode
    actions?: React.ReactNode
    actionLabel?: string
    actionHref?: string
    onRefresh?: () => void
    isRefreshing?: boolean
}

export function PageHeader({
    title,
    description,
    subtitle,
    icon,
    actions,
    actionLabel,
    actionHref,
    onRefresh,
    isRefreshing = false
}: PageHeaderProps) {
    const descText = description || subtitle || ''

    return (
        <div className="flex min-w-0 flex-col gap-4 border-b border-black/5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pb-6">
            <div className="min-w-0">
                <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
                    <span className="min-w-0 break-words">{title}</span>
                </h1>
                {descText && (
                    <p className="text-muted-foreground mt-2 text-sm">
                        {descText}
                    </p>
                )}
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                {actions}

                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-400 hover:shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 sm:w-auto"
                    >
                        <RefreshIcon size={17} className={isRefreshing ? 'animate-spin text-slate-600' : 'text-slate-600'} />
                        <span>Segarkan</span>
                    </button>
                )}

                {actionLabel && actionHref && (
                    <Link
                        href={actionHref}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm border border-blue-700/30 transition-all active:scale-95 cursor-pointer sm:w-auto"
                    >
                        <PlusSignIcon size={17} />
                        <span>{actionLabel}</span>
                    </Link>
                )}
            </div>
        </div>
    )
}
