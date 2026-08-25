import React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Props = {
    href?: string
    onClick?: () => void
    icon?: React.ReactNode
    children?: React.ReactNode
    variant?: "default" | "destructive" | "primary" | "secondary"
    className?: string
    title?: string
}

export function ActionButton({ href, onClick, icon, children, variant = "default", className, title }: Props) {
    const baseClasses = "inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors border shadow-xs active:scale-95 cursor-pointer"

    const variants = {
        default: "text-muted-foreground hover:text-foreground bg-white hover:bg-black/5 border-black/10",
        secondary: "text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-200 border-slate-200",
        primary: "text-white bg-foreground hover:bg-foreground/90 border-transparent shadow-sm",
        destructive: "text-destructive/80 hover:text-destructive bg-white hover:bg-destructive/10 border-black/10 hover:border-destructive/20"
    }

    const paddingClasses = children ? "px-3 py-2" : "p-2"
    const classes = cn(baseClasses, paddingClasses, variants[variant], className)

    if (href) {
        return (
            <Link href={href} className={classes} title={title}>
                {icon}
                {children}
            </Link>
        )
    }

    return (
        <button onClick={onClick} className={classes} title={title} type="button">
            {icon}
            {children}
        </button>
    )
}

