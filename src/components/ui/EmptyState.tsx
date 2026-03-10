import React from "react"
import Link from "next/link"
import { PlusSignIcon } from "hugeicons-react"

interface EmptyStateProps {
    icon: React.ReactNode
    title: string
    description: string
    actionLabel?: string
    actionHref?: string
}

export function EmptyState({ icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
    return (
        <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
            {icon}
            <div>
                <h3 className="text-base font-bold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {description}
                </p>
            </div>
            {actionLabel && actionHref && (
                <Link
                    href={actionHref}
                    className="mt-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                >
                    <PlusSignIcon size={16} /> {actionLabel}
                </Link>
            )}
        </div>
    )
}
