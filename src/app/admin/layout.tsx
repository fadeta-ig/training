'use client';

import Link from 'next/link';
import { ReactNode, useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
    UserGroupIcon,
    Logout01Icon,
    Settings01Icon,
    CheckmarkBadge01Icon
} from 'hugeicons-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const pathname = usePathname();
    const router = useRouter();

    const profileRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                const data = await res.json();
                if (data.success) {
                    setUser(data.data);
                }
            } catch (err) { }
        };
        fetchUser();
        fetchNotifications();

        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsNotificationOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/auth/login');
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            if (data.success) {
                setNotifications(data.data);
                setUnreadCount(data.unreadCount);
            }
        } catch (err) { }
    };

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications', { method: 'PUT' });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch (err) { }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Baru saja';
        if (diffMin < 60) return `${diffMin} menit lalu`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour} jam lalu`;
        const diffDay = Math.floor(diffHour / 24);
        if (diffDay === 1) return 'Kemarin';
        return `${diffDay} hari lalu`;
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

                <div className={`mt-auto p-4 m-3 rounded-2xl bg-black/5 border border-black/5 overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 h-0 p-0 m-0'}`}>
                    <div className="flex items-center gap-3">
                        <UserCircleIcon size={32} className="text-muted-foreground shrink-0" />
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold truncate">{user?.full_name || 'Loading...'}</p>
                            <p className="text-xs text-muted-foreground truncate">@{user?.username || 'admin'}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Pane */}
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
                {/* Top Header */}
                <header className="h-16 flex items-center justify-between px-6 border-b border-black/5 bg-white/95 backdrop-blur-md shrink-0 z-30 relative">
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
                        {/* Notifications */}
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                                className={`text-muted-foreground hover:text-foreground transition-colors relative p-1.5 rounded-lg ${isNotificationOpen ? 'bg-black/5' : ''}`}
                            >
                                <Notification01Icon size={22} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-white"></span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            {isNotificationOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white border border-black/10 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="px-4 py-3 border-b border-black/10 bg-[#f8f9fa] flex justify-between items-center">
                                        <h3 className="font-semibold text-sm">Notifikasi {unreadCount > 0 && <span className="text-xs font-bold text-destructive">({unreadCount})</span>}</h3>
                                        {unreadCount > 0 && (
                                            <button onClick={markAllAsRead} className="text-xs text-primary font-medium hover:underline">Tandai semua dibaca</button>
                                        )}
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                                                Belum ada notifikasi.
                                            </div>
                                        ) : (
                                            notifications.map((notif) => (
                                                <div key={notif.id} className={`px-4 py-3 hover:bg-black/5 transition-colors cursor-pointer border-b border-black/5 last:border-0 ${!notif.is_read ? 'bg-primary/5' : ''}`}>
                                                    <p className="text-sm font-semibold">{notif.title}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                                                    <p className="text-[10px] text-muted-foreground/70 mt-1.5">{formatTime(notif.created_at)}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile Dropdown */}
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-black text-white hover:scale-105 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                <span className="text-sm font-bold">{user ? user.username.charAt(0).toUpperCase() : 'A'}</span>
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-black/10 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="px-4 py-4 border-b border-black/5 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-black/5 flex flex-col items-center justify-center text-foreground">
                                            <UserCircleIcon size={24} />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-bold truncate text-foreground">{user?.full_name || 'Administrator'}</p>
                                            <p className="text-xs font-medium text-muted-foreground truncate">@{user?.username || 'admin'}</p>
                                        </div>
                                    </div>

                                    <div className="p-2 flex flex-col gap-1">
                                        <Link href={user ? `/admin/users/${user.id}/edit` : '#'} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 active:bg-black/10 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">
                                            <Settings01Icon size={18} />
                                            Pengaturan Profil
                                        </Link>
                                    </div>

                                    <div className="p-2 border-t border-black/5">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 active:bg-destructive/20 transition-colors text-sm font-medium text-destructive"
                                        >
                                            <Logout01Icon size={18} />
                                            Keluar Sistem
                                        </button>
                                    </div>
                                </div>
                            )}
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
