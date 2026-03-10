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
        <div className="flex justify-between items-end border-b border-black/5 pb-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    {icon}
                    {title}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    {description}
                </p>
            </div>

            <div className="flex gap-3">
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-white border border-black/10 text-foreground hover:bg-black/5 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm"
                    >
                        <RefreshIcon size={18} className={isRefreshing ? 'animate-spin' : ''} />
                        Segarkan
                    </button>
                )}

                {actionLabel && actionHref && (
                    <Link
                        href={actionHref}
                        className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm"
                    >
                        <PlusSignIcon size={18} />
                        {actionLabel}
                    </Link>
                )}
            </div>
        </div>
    )
}
