'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
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
    Activity01Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
    FolderLibraryIcon,
    UserCheck01Icon,
    Certificate01Icon
} from 'hugeicons-react';
import type { AuthPayload } from '@/types';

interface AdminSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    user: AuthPayload | null;
}

export function AdminSidebar({ isOpen, onClose, user }: AdminSidebarProps) {
    const pathname = usePathname();
    const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState<number>(0);

    useEffect(() => {
        if (window.matchMedia('(max-width: 767px)').matches) {
            onClose();
        }
    }, [pathname, onClose]);

    // Fetch pending registration count periodically or on route change
    useEffect(() => {
        let isMounted = true;
        const fetchPendingCount = async () => {
            try {
                const res = await fetch('/api/admin/registrations?status=pending&limit=1');
                const data = await res.json();
                if (isMounted && data.success && typeof data.pendingCount === 'number') {
                    setPendingRegistrationsCount(data.pendingCount);
                }
            } catch { }
        };
        fetchPendingCount();
        return () => { isMounted = false; };
    }, [pathname]);

    const isLearningActive =
        pathname.startsWith('/admin/content') ||
        pathname.startsWith('/admin/exams') ||
        pathname.startsWith('/admin/modules');

    const [isLearningExpanded, setIsLearningExpanded] = useState<boolean>(false);
    const showLearningItems = isLearningActive || isLearningExpanded;

    const isParticipantsGroupActive =
        pathname.startsWith('/admin/registrations') ||
        pathname.startsWith('/admin/certifications') ||
        pathname.startsWith('/admin/participants');

    const [isParticipantsGroupExpanded, setIsParticipantsGroupExpanded] = useState<boolean>(false);
    const showParticipantsGroupItems = isParticipantsGroupActive || isParticipantsGroupExpanded;

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <button
                    type="button"
                    aria-label="Tutup menu navigasi"
                    className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Pane */}
            <aside
                className={`${
                    isOpen ? 'translate-x-0 md:w-72' : '-translate-x-full md:w-20 md:translate-x-0'
                } fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,calc(100vw-3rem))] shrink-0 flex-col overflow-hidden glass-sidebar transition-[transform,width] duration-300 ease-in-out md:relative md:inset-auto md:h-full`}
            >
                {/* Logo Area */}
                <div className={`flex items-center ${isOpen ? 'justify-between px-6' : 'justify-center'} py-4 border-b border-black/5`}>
                    {isOpen ? (
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-xs border border-black/5 shrink-0 p-1">
                                <Image
                                    src="/logo-nusamitra-tr.png"
                                    alt="Logo Nusamitra Consulting"
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-sm font-bold tracking-tight text-foreground truncate leading-tight">LMS Nusamitra</h1>
                                <p className="text-[11px] text-muted-foreground font-medium truncate">Admin Hub</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-xs border border-black/5 p-1">
                            <Image
                                src="/logo-nusamitra-tr.png"
                                alt="Logo Nusamitra Consulting"
                                width={32}
                                height={32}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )}

                    <button
                        type="button"
                        aria-label="Tutup menu navigasi"
                        className="md:hidden text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-black/5"
                        onClick={onClose}
                    >
                        <Cancel01Icon size={20} />
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto overflow-x-hidden">
                    <NavLink href="/admin" label="Overview" icon={<DashboardSquare01Icon size={20} />} isOpen={isOpen} active={pathname === '/admin'} />

                    {/* Group Menu: Manajemen Pembelajaran */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setIsLearningExpanded((prev) => !prev)}
                            title={!isOpen ? 'Manajemen Pembelajaran' : undefined}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group active:scale-95 ${
                                isLearningActive
                                    ? 'bg-primary/10 text-primary font-semibold'
                                    : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'
                            } ${!isOpen && 'justify-center'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`${isLearningActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'} transition-colors shrink-0`}>
                                    <FolderLibraryIcon size={20} />
                                </span>
                                {isOpen && <span className="truncate">Manajemen Pembelajaran</span>}
                            </div>
                            {isOpen && (
                                <span className="text-muted-foreground text-xs">
                                    {showLearningItems ? <ArrowUp01Icon size={16} /> : <ArrowDown01Icon size={16} />}
                                </span>
                            )}
                        </button>

                        {/* Submenu Items */}
                        {(showLearningItems || !isOpen) && (
                            <div className={`space-y-1 transition-all ${isOpen ? 'pl-4 border-l-2 border-primary/15 ml-4 mt-1' : ''}`}>
                                <NavLink
                                    href="/admin/content"
                                    label="Trainings (Materi)"
                                    icon={<Book01Icon size={18} />}
                                    isOpen={isOpen}
                                    active={pathname.startsWith('/admin/content')}
                                />
                                <NavLink
                                    href="/admin/exams"
                                    label="Exams (Bank Soal)"
                                    icon={<Edit01Icon size={18} />}
                                    isOpen={isOpen}
                                    active={pathname.startsWith('/admin/exams')}
                                />
                                <NavLink
                                    href="/admin/modules"
                                    label="Module Builder"
                                    icon={<CubeIcon size={18} />}
                                    isOpen={isOpen}
                                    active={pathname.startsWith('/admin/modules')}
                                />
                            </div>
                        )}
                    </div>

                    <NavLink href="/admin/sessions" label="Session Manager" icon={<Calendar01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/sessions')} />
                    <NavLink href="/admin/monitoring" label="Live Proctoring" icon={<Camera01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/monitoring')} />

                    {/* Group Menu: Manajemen Kepesertaan & Sertifikasi */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setIsParticipantsGroupExpanded((prev) => !prev)}
                            title={!isOpen ? 'Manajemen Kepesertaan' : undefined}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group active:scale-95 ${
                                isParticipantsGroupActive
                                    ? 'bg-primary/10 text-primary font-semibold'
                                    : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'
                            } ${!isOpen && 'justify-center relative'}`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className={`${isParticipantsGroupActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'} transition-colors shrink-0`}>
                                    <UserGroupIcon size={20} />
                                </span>
                                {isOpen && <span className="truncate">Manajemen Kepesertaan</span>}
                            </div>
                            {isOpen ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {pendingRegistrationsCount > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold text-[10px]">
                                            {pendingRegistrationsCount}
                                        </span>
                                    )}
                                    <span className="text-muted-foreground text-xs">
                                        {showParticipantsGroupItems ? <ArrowUp01Icon size={16} /> : <ArrowDown01Icon size={16} />}
                                    </span>
                                </div>
                            ) : (
                                pendingRegistrationsCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                )
                            )}
                        </button>

                        {/* Submenu Items */}
                        {(showParticipantsGroupItems || !isOpen) && (
                            <div className={`space-y-1 transition-all ${isOpen ? 'pl-4 border-l-2 border-primary/15 ml-4 mt-1' : ''}`}>
                                <NavLink
                                    href="/admin/registrations"
                                    label="Persetujuan Pendaftaran"
                                    icon={<UserCheck01Icon size={18} />}
                                    isOpen={isOpen}
                                    active={pathname.startsWith('/admin/registrations')}
                                    badge={
                                        pendingRegistrationsCount > 0 ? (
                                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px]">
                                                {pendingRegistrationsCount}
                                            </span>
                                        ) : undefined
                                    }
                                />
                                <NavLink
                                    href="/admin/certifications"
                                    label="Program Sertifikasi"
                                    icon={<Certificate01Icon size={18} />}
                                    isOpen={isOpen}
                                    active={pathname.startsWith('/admin/certifications')}
                                />
                                <NavLink
                                    href="/admin/participants"
                                    label="Kelola Peserta"
                                    icon={<UserCircleIcon size={18} />}
                                    isOpen={isOpen}
                                    active={pathname.startsWith('/admin/participants')}
                                />
                            </div>
                        )}
                    </div>
                    
                    {/* Hide User Management from Trainers */}
                    {user?.role === 'admin' && (
                        <>
                            <NavLink href="/admin/users" label="Kelola Pengguna (Admin)" icon={<UserGroupIcon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/users')} />
                            <NavLink href="/admin/audit-logs" label="Audit Trail" icon={<Activity01Icon size={20} />} isOpen={isOpen} active={pathname.startsWith('/admin/audit-logs')} />
                        </>
                    )}
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
