'use client';

import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
    Menu01Icon,
    Cancel01Icon,
    DashboardSquare01Icon,
    Book01Icon,
    Edit01Icon,
    CubeIcon,
    Calendar01Icon,
    Camera01Icon,
    UserCircleIcon,
    Notification01Icon,
    UserGroupIcon
} from 'hugeicons-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const pathname = usePathname();

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">

            {/* Mobile Sidebar Overlay */}
            {!isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(true)}
                />
            )}

            {/* Sidebar: Glassmorphism themed */}
            <aside
                className={`${isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'} 
          fixed md:relative z-50 h-full flex flex-col glass-sidebar transition-all duration-300 ease-in-out shrink-0`}
            >
                <div className={`flex items-center ${isSidebarOpen ? 'justify-between px-6' : 'justify-center'} py-5 border-b border-black/5`}>
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-md">
                                <CubeIcon size={18} />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight">LMS Admin</h1>
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-md">
                            <CubeIcon size={18} />
                        </div>
                    )}

                    <button
                        className="md:hidden text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-black/5"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <Cancel01Icon size={20} />
                    </button>
                </div>

                <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto overflow-x-hidden">
                    <NavLink href="/admin" label="Overview" icon={<DashboardSquare01Icon size={20} />} isOpen={isSidebarOpen} active={pathname === '/admin'} />
                    <NavLink href="/admin/content" label="Trainings (Materi)" icon={<Book01Icon size={20} />} isOpen={isSidebarOpen} active={pathname.startsWith('/admin/content')} />
                    <NavLink href="/admin/exams" label="Exams (Bank Soal)" icon={<Edit01Icon size={20} />} isOpen={isSidebarOpen} active={pathname.startsWith('/admin/exams')} />
                    <NavLink href="/admin/modules" label="Module Builder" icon={<CubeIcon size={20} />} isOpen={isSidebarOpen} active={pathname.startsWith('/admin/modules')} />
                    <NavLink href="/admin/sessions" label="Session Manager" icon={<Calendar01Icon size={20} />} isOpen={isSidebarOpen} active={pathname.startsWith('/admin/sessions')} />
                    <NavLink href="/admin/monitoring" label="Live Proctoring" icon={<Camera01Icon size={20} />} isOpen={isSidebarOpen} active={pathname.startsWith('/admin/monitoring')} />
                    <NavLink href="/admin/users" label="Kelola Pengguna" icon={<UserGroupIcon size={20} />} isOpen={isSidebarOpen} active={pathname.startsWith('/admin/users')} />
                </nav>

                <div className={`mt-auto p-4 m-3 glass-card border-none bg-white/40 overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 h-0 p-0 m-0'}`}>
                    <div className="flex items-center gap-3">
                        <UserCircleIcon size={32} className="text-muted-foreground" />
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold truncate">Administrator</p>
                            <p className="text-xs text-muted-foreground truncate">admin@system.local</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Pane */}
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
                {/* Top Header */}
                <header className="h-16 flex items-center justify-between px-6 border-b border-black/5 bg-white/60 backdrop-blur-md shrink-0 z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                        >
                            <Menu01Icon size={22} />
                        </button>
                        <h2 className="text-lg font-semibold tracking-tight hidden sm:block">Administrator Hub</h2>
                    </div>
                    <div className="flex items-center gap-5">
                        <button className="text-muted-foreground hover:text-foreground transition-colors relative">
                            <Notification01Icon size={22} />
                            <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full border-2 border-white"></span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white">
                            <UserCircleIcon size={20} />
                        </div>
                    </div>
                </header>

                {/* Dynamic Page Content */}
                <div className="flex-1 overflow-auto p-6 md:p-10 page-transition bg-transparent relative">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavLink({ href, label, icon, isOpen, active }: { href: string; label: string; icon: ReactNode; isOpen: boolean; active: boolean }) {
    return (
        <Link
            href={href}
            title={!isOpen ? label : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group active:scale-95 ${active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'
                } ${!isOpen && 'justify-center'}`}
        >
            <span className={`${active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'} transition-colors shrink-0`}>
                {icon}
            </span>
            {isOpen && <span className="truncate">{label}</span>}
        </Link>
    );
}
