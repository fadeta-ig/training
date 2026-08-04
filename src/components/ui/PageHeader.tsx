import React from "react"
import Link from "next/link"
import { PlusSignIcon, RefreshIcon } from "hugeicons-react"

interface PageHeaderProps {
    title: string
    description: string
    icon: React.ReactNode
    actionLabel?: string
    actionHref?: string
    onRefresh?: () => void
    isRefreshing?: boolean
}

export function PageHeader({
    title,
    description,
    icon,
    actionLabel,
    actionHref,
    onRefresh,
    isRefreshing = false
}: PageHeaderProps) {
    return (
        <div className="flex min-w-0 flex-col gap-4 border-b border-black/5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pb-6">
            <div className="min-w-0">
                <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    <span className="mt-0.5 shrink-0">{icon}</span>
                    <span className="min-w-0 break-words">{title}</span>
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    {description}
                </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-ring active:scale-95 sm:w-auto"
                    >
                        <RefreshIcon size={18} className={isRefreshing ? 'animate-spin' : ''} />
                        Segarkan
                    </button>
                )}

                {actionLabel && actionHref && (
                    <Link
                        href={actionHref}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-ring active:scale-95 sm:w-auto"
                    >
                        <PlusSignIcon size={18} />
                        {actionLabel}
                    </Link>
                )}
            </div>
        </div>
    )
}
