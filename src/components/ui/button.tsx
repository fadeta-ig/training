import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white hover:bg-slate-800 shadow-xs hover:shadow-sm border border-slate-950/20 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
        primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-xs hover:shadow-sm border border-slate-950/20 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs hover:shadow-sm border border-emerald-700/30 active:scale-95 focus-visible:ring-emerald-500/30",
        warning: "bg-amber-600 text-white hover:bg-amber-700 shadow-xs hover:shadow-sm border border-amber-700/30 active:scale-95 focus-visible:ring-amber-500/30",
        destructive: "bg-rose-600 text-white hover:bg-rose-700 shadow-xs hover:shadow-sm border border-rose-700/30 active:scale-95 focus-visible:ring-rose-500/30",
        "destructive-outline": "bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100/90 hover:border-rose-400 shadow-2xs hover:shadow-xs active:scale-95 focus-visible:ring-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
        outline:
          "border border-slate-300/90 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-950 hover:border-slate-400 shadow-2xs hover:shadow-xs active:scale-95 aria-expanded:bg-muted aria-expanded:text-foreground dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        secondary:
          "bg-slate-100 text-slate-800 hover:bg-slate-200/90 hover:text-slate-950 border border-slate-300/80 hover:border-slate-400 shadow-2xs hover:shadow-xs active:scale-95 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700",
        ghost:
          "hover:bg-slate-100 hover:text-slate-900 active:scale-95 aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-slate-800",
        link: "text-primary underline-offset-4 hover:underline",
        "subtle-emerald": "bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs hover:shadow-xs active:scale-95 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
        "subtle-amber": "bg-amber-50 text-amber-950 border border-amber-300 hover:bg-amber-100 hover:border-amber-400 shadow-2xs hover:shadow-xs active:scale-95 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
      },
      size: {
        default:
          "h-8.5 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7.5 gap-1.5 rounded-lg px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 text-sm rounded-xl has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-12 gap-2.5 px-6 text-base rounded-2xl has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 font-bold",
        icon: "size-8.5",
        "icon-xs":
          "size-6 rounded-lg in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7.5 rounded-lg in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  loadingText?: string
}

function Button({
  className,
  variant = "default",
  size = "default",
  isLoading = false,
  loadingText,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || isLoading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin shrink-0" />
          {loadingText ? <span>{loadingText}</span> : children}
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
