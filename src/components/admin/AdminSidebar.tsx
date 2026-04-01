import { NavLink } from '@/components/ui/NavLink';
import { usePathname } from 'next/navigation';
import {
    CubeIcon,
    Cancel01Icon,
    DashboardSquare01Icon,
    Book01Icon,
    Edit01Icon,
    Calendar01Icon,
    Camera01Icon,
    UserCircleIcon,
    UserGroupIcon,
} from 'hugeicons-react';
import type { AuthPayload } from '@/types';

interface AdminSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    user: AuthPayload | null;
}

export function AdminSidebar({ isOpen, onClose, user }: AdminSidebarProps) {
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
                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-md shrink-0">
                                <CubeIcon size={18} />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight truncate">LMS Admin</h1>
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-md">
                            <CubeIcon size={18} />
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
                    <NavLink href="/admin" label="Overview" icon={<DashboardSquare01Icon size={20} />} isOpen={isOpen} active={pathname === '/admin'} />
                    <NavLink href="/admin/content" label="Trainings (Materi)" icon={<Book01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/content')} />
                    <NavLink href="/admin/exams" label="Exams (Bank Soal)" icon={<Edit01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/exams')} />
                    <NavLink href="/admin/modules" label="Module Builder" icon={<CubeIcon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/modules')} />
                    <NavLink href="/admin/sessions" label="Session Manager" icon={<Calendar01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/sessions')} />
                    <NavLink href="/admin/monitoring" label="Live Proctoring" icon={<Camera01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/monitoring')} />
                    
                    {/* Hide User Management from Trainers */}
                    {user?.role === 'admin' && (
                        <NavLink href="/admin/users" label="Kelola Pengguna (Admin)" icon={<UserGroupIcon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/users')} />
                    )}
                    <NavLink href="/admin/participants" label="Kelola Peserta" icon={<UserCircleIcon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/participants')} />
                </nav>

                {/* Fixed User Profile at Bottom */}
                <div className={`mt-auto p-4 m-3 rounded-2xl bg-black/5 border border-black/5 overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 p-0 m-0'}`}>
                    <div className="flex items-center gap-3">
                        <UserCircleIcon size={32} className="text-muted-foreground shrink-0" />
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold truncate">{user?.full_name || 'Loading...'}</p>
                            <p className="text-xs text-muted-foreground truncate">
                                @{user?.username || 'admin'} 
                                {user?.role === 'trainer' && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Trainer</span>}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
