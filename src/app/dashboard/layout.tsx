'use client';

import Link from 'next/link';
import { ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    Menu01Icon,
    Cancel01Icon,
    DashboardSquare01Icon,
    Clock01Icon,
    UserCircleIcon,
    Notification01Icon,
    Mortarboard01Icon,
    Logout01Icon,
} from 'hugeicons-react';

type UserInfo = {
    id: string;
    username: string;
    full_name: string;
    role: string;
};

export default function UserLayout({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [user, setUser] = useState<UserInfo | null>(null);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setUser(data.data);
            })
            .catch(() => { });
    }, []);

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.replace('/auth/login');
        } catch {
            router.replace('/auth/login');
        }
    };

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">

            {/* Mobile Sidebar Overlay */}
            {!isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(true)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`${isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'} 
          fixed md:relative z-50 h-full flex flex-col glass-sidebar transition-all duration-300 ease-in-out shrink-0`}
            >
                <div className={`flex items-center ${isSidebarOpen ? 'justify-between px-6' : 'justify-center'} py-5 border-b border-black/5`}>
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
                                <Mortarboard01Icon size={18} />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight">Portal Peserta</h1>
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
                            <Mortarboard01Icon size={18} />
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
                    <NavLink href="/dashboard" label="Sesi Saya" icon={<DashboardSquare01Icon size={20} />} isOpen={isSidebarOpen} active={pathname === '/dashboard'} />
                    <NavLink href="/dashboard/riwayat" label="Riwayat Ujian" icon={<Clock01Icon size={20} />} isOpen={isSidebarOpen} active={pathname.startsWith('/dashboard/riwayat')} />
                </nav>

                {/* User Profile */}
                <div className={`mt-auto border-t border-black/5 transition-all duration-300 ${isSidebarOpen ? 'p-4' : 'p-2'}`}>
                    <div className={`flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center'}`}>
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <UserCircleIcon size={22} />
                        </div>
                        {isSidebarOpen && (
                            <div className="overflow-hidden flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{user?.full_name || 'Memuat...'}</p>
                                <p className="text-xs text-muted-foreground truncate">{user?.username || ''}</p>
                            </div>
                        )}
                    </div>
                    {isSidebarOpen && (
                        <button
                            onClick={handleLogout}
                            className="mt-3 w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 px-3 py-2 rounded-lg transition-colors"
                        >
                            <Logout01Icon size={14} />
                            <span>Keluar</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
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
                        <h2 className="text-lg font-semibold tracking-tight hidden sm:block">
                            Selamat datang, {user?.full_name?.split(' ')[0] || 'Peserta'}!
                        </h2>
                    </div>
                    <div className="flex items-center gap-5">
                        <button className="text-muted-foreground hover:text-foreground transition-colors relative">
                            <Notification01Icon size={22} />
                        </button>
                        <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background text-xs font-bold">
                            {user?.full_name?.charAt(0)?.toUpperCase() || 'P'}
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
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'
                } ${!isOpen && 'justify-center'}`}
        >
            <span className={`${active ? 'text-background' : 'text-muted-foreground group-hover:text-foreground'} transition-colors shrink-0`}>
                {icon}
            </span>
            {isOpen && <span className="truncate">{label}</span>}
        </Link>
    );
}
