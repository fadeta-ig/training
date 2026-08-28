import type { ReactNode } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ManagementPageHeaderProps = {
    title: string;
    description: string;
    icon: ReactNode;
    actionLabel?: string;
    actionHref?: string;
    onRefresh: () => void;
    isRefreshing: boolean;
};

export function ManagementPageHeader({
    title,
    description,
    icon,
    actionLabel,
    actionHref,
    onRefresh,
    isRefreshing,
}: ManagementPageHeaderProps) {
    return (
        <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                    <span className="text-muted-foreground">{icon}</span>
                    <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">{title}</h1>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            </div>

            <div className="grid shrink-0 grid-cols-1 gap-2.5 sm:flex sm:items-center">
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto font-bold"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                >
                    <RefreshCw className={cn('size-4 text-slate-600', isRefreshing && 'animate-spin')} />
                    <span>Segarkan</span>
                </Button>
                {actionLabel && actionHref && (
                    <Link
                        href={actionHref}
                        className={cn(
                            buttonVariants({ size: 'lg', variant: 'default' }),
                            'w-full sm:w-auto font-bold shadow-xs hover:shadow-sm'
                        )}
                    >
                        <Plus className="size-4.5" />
                        <span>{actionLabel}</span>
                    </Link>
                )}
            </div>
        </header>
    );
}
