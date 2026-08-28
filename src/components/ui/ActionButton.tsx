import React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type ActionButtonVariant =
    | "default"
    | "destructive"
    | "primary"
    | "create"
    | "filter"
    | "secondary"
    | "success"
    | "warning"
    | "ghost"

type Props = {
    href?: string
    onClick?: (e: React.MouseEvent) => void
    icon?: React.ReactNode
    children?: React.ReactNode
    variant?: ActionButtonVariant
    className?: string
    title?: string
    disabled?: boolean
    isLoading?: boolean
    type?: "button" | "submit" | "reset"
}

export function ActionButton({
    href,
    onClick,
    icon,
    children,
    variant = "default",
    className,
    title,
    disabled = false,
    isLoading = false,
    type = "button"
}: Props) {
    const baseClasses =
        "inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-150 border shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100"

    const variants: Record<ActionButtonVariant, string> = {
        default:
            "text-slate-800 hover:text-slate-950 bg-white hover:bg-slate-50 border-slate-300 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-200 dark:border-white/10 dark:hover:bg-slate-800",
        secondary:
            "text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/90 border-slate-300/80 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
        primary:
            "text-white bg-blue-600 hover:bg-blue-700 border-blue-700/30 shadow-xs hover:shadow-sm",
        create:
            "text-white bg-blue-600 hover:bg-blue-700 border-blue-700/30 shadow-xs hover:shadow-sm",
        filter:
            "text-blue-900 bg-blue-50/80 hover:bg-blue-100 border-blue-300/80 hover:border-blue-400 shadow-2xs hover:shadow-xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
        success:
            "text-white bg-emerald-600 hover:bg-emerald-700 border-emerald-700/30 shadow-xs hover:shadow-sm",
        warning:
            "text-white bg-amber-600 hover:bg-amber-700 border-amber-700/30 shadow-xs hover:shadow-sm",
        destructive:
            "text-rose-800 hover:text-white bg-rose-50 hover:bg-rose-600 border-rose-300 hover:border-rose-600 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-700",
        ghost:
            "text-muted-foreground hover:text-foreground bg-transparent hover:bg-slate-100 border-transparent shadow-none dark:hover:bg-slate-800"
    }

    const paddingClasses = children ? "px-3 py-1.5" : "p-2"
    const classes = cn(baseClasses, paddingClasses, variants[variant], className)

    const content = (
        <>
            {isLoading ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : icon}
            {children}
        </>
    )

    if (href && !disabled && !isLoading) {
        return (
            <Link href={href} className={classes} title={title}>
                {content}
            </Link>
        )
    }

    return (
        <button
            onClick={onClick}
            className={classes}
            title={title}
            type={type}
            disabled={disabled || isLoading}
        >
            {content}
        </button>
    )
}
