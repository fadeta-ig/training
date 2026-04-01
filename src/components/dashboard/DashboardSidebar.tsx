import { NavLink } from '@/components/ui/NavLink';
import { usePathname } from 'next/navigation';
import {
    Mortarboard01Icon,
    Cancel01Icon,
    DashboardSquare01Icon,
    Clock01Icon,
    UserCircleIcon,
    CrownIcon,
} from 'hugeicons-react';
import type { AuthPayload } from '@/types';

interface DashboardSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    user: AuthPayload | null;
}

export function DashboardSidebar({ isOpen, onClose, user }: DashboardSidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile Overlay */}
            {!isOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Pane */}
            <aside
                className={`${
                    isOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'
                } fixed md:relative z-50 h-full flex flex-col glass-sidebar transition-all duration-300 ease-in-out shrink-0`}
            >
                {/* Logo Area */}
                <div className={`flex items-center ${isOpen ? 'justify-between px-6' : 'justify-center'} py-5 border-b border-black/5`}>
                    {isOpen ? (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md shrink-0">
                                <Mortarboard01Icon size={18} />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight truncate">Portal Peserta</h1>
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
                            <Mortarboard01Icon size={18} />
                        </div>
                    )}

                    <button
                        className="md:hidden text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-black/5"
                        onClick={onClose}
                    >
                        <Cancel01Icon size={20} />
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto overflow-x-hidden">
                    <NavLink href="/dashboard" label="Overview" icon={<DashboardSquare01Icon size={20} />} isOpen={isOpen} active={pathname === '/dashboard'} />
                    <NavLink href="/dashboard/sesi" label="Sesi Pelatihan" icon={<Mortarboard01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/dashboard/sesi')} />
                    <NavLink href="/dashboard/leaderboard" label="Klasemen Top 100" icon={<CrownIcon size={20} />} isOpen={isOpen} active={pathname.startsWith('/dashboard/leaderboard')} />
                    <NavLink href="/dashboard/riwayat" label="Riwayat Ujian" icon={<Clock01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/dashboard/riwayat')} />
                    <NavLink href="/dashboard/profil" label="Profil & Pengaturan" icon={<UserCircleIcon size={20} />} isOpen={isOpen} active={pathname.startsWith('/dashboard/profil')} />
                </nav>

                {/* Fixed User Profile at Bottom */}
                <div className={`mt-auto border-t border-black/5 transition-all duration-300 ${isOpen ? 'p-4' : 'p-2'}`}>
                    <div className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'}`}>
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <UserCircleIcon size={22} />
                        </div>
                        {isOpen && (
                            <div className="overflow-hidden flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{user?.full_name || 'Memuat...'}</p>
                                <p className="text-xs text-muted-foreground truncate">{user?.username || ''}</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}
