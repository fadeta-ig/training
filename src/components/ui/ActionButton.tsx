import React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Props = {
    href?: string
    onClick?: () => void
    icon: React.ReactNode
    variant?: "default" | "destructive"
    className?: string
    title?: string
}

export function ActionButton({ href, onClick, icon, variant = "default", className, title }: Props) {
    const baseClasses = "inline-flex items-center justify-center p-2 rounded-lg transition-colors border shadow-sm"

    const variants = {
        default: "text-muted-foreground hover:text-foreground bg-white hover:bg-black/5 border-black/10",
        destructive: "text-destructive/60 hover:text-destructive bg-white hover:bg-destructive/10 border-black/10 hover:border-destructive/20"
    }

    const classes = cn(baseClasses, variants[variant], className)

    if (href) {
        return (
            <Link href={href} className={classes} title={title}>
                {icon}
            </Link>
        )
    }

    return (
        <button onClick={onClick} className={classes} title={title} type="button">
            {icon}
        </button>
    )
}
