'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface NavLinkProps {
    href: string;
    label: string;
    icon: ReactNode;
    isOpen: boolean;
    active: boolean;
    /** Optional: override active/inactive color scheme */
    activeClassName?: string;
    inactiveClassName?: string;
}

/**
 * Shared sidebar navigation link used by both Admin and Dashboard layouts.
 * Previously duplicated in admin/layout.tsx (L267) and dashboard/layout.tsx (L222).
 */
export function NavLink({
    href,
    label,
    icon,
    isOpen,
    active,
    activeClassName = 'bg-primary text-primary-foreground shadow-sm',
    inactiveClassName = 'text-muted-foreground hover:bg-black/5 hover:text-foreground',
}: NavLinkProps) {
    const iconActiveClass = active
        ? 'text-primary-foreground'
        : 'text-muted-foreground group-hover:text-foreground';

    return (
        <Link
            href={href}
            title={!isOpen ? label : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group active:scale-95 ${
                active ? activeClassName : inactiveClassName
            } ${!isOpen && 'justify-center'}`}
        >
            <span className={`${iconActiveClass} transition-colors shrink-0`}>
                {icon}
            </span>
            {isOpen && <span className="truncate">{label}</span>}
        </Link>
    );
}
