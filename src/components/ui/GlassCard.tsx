import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> { }

export function GlassCard({ className, ...props }: GlassCardProps) {
    return (
        <div
            className={cn(
                "bg-white/70 backdrop-blur-xl border border-black/[0.08] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl",
                className
            )}
            {...props}
        />
    )
}
