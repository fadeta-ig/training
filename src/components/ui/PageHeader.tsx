import React from "react"
import Link from "next/link"
import { PlusSignIcon, RefreshIcon } from "hugeicons-react"
import { cn } from "@/lib/utils"

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
    actionsPosition?: 'right' | 'below'
    className?: string
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
    isRefreshing = false,
    actionsPosition = 'right',
    className = '',
}: PageHeaderProps) {
    const descText = description || subtitle || ''
    const hasActions = Boolean(actions || onRefresh || (actionLabel && actionHref))

    const renderActionButtons = () => (
        <div className="flex flex-wrap items-center gap-2.5">
            {actions}

            {onRefresh && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-xs active:scale-[0.98] cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                    <RefreshIcon size={16} className={isRefreshing ? 'animate-spin text-slate-500' : 'text-slate-500'} />
                    <span>Segarkan</span>
                </button>
            )}

            {actionLabel && actionHref && (
                <Link
                    href={actionHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4.5 py-2.5 text-xs sm:text-sm font-semibold shadow-xs hover:shadow-sm border border-blue-700/30 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
                >
                    <PlusSignIcon size={16} />
                    <span>{actionLabel}</span>
                </Link>
            )}
        </div>
    )

    if (actionsPosition === 'below') {
        return (
            <div className={cn("space-y-4 border-b border-black/5 pb-5 sm:pb-6", className)}>
                <div className="flex min-w-0 items-start gap-3.5">
                    {icon && (
                        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60">
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl break-words">
                            {title}
                        </h1>
                        {descText && (
                            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                                {descText}
                            </p>
                        )}
                    </div>
                </div>

                {hasActions && (
                    <div className="pt-1">
                        {renderActionButtons()}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={cn("flex min-w-0 flex-col gap-4 border-b border-black/5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pb-6", className)}>
            <div className="min-w-0 flex-1">
                <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
                    <span className="min-w-0 break-words">{title}</span>
                </h1>
                {descText && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {descText}
                    </p>
                )}
            </div>

            {hasActions && (
                <div className="shrink-0">
                    {renderActionButtons()}
                </div>
            )}
        </div>
    )
}

