'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    Boxes,
    CalendarDays,
    Eye,
    ListTree,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { ManagementPageHeader } from '@/components/admin/ManagementPageHeader';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type LearningModule = {
    id: string;
    title: string;
    description: string | null;
    created_at: string;
};

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function ModulesManagerPage() {
    const [modules, setModules] = useState<LearningModule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [userRole, setUserRole] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchModules = useCallback(async (targetPage: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/modules?page=${targetPage}&limit=10`);
            if (!response.ok) throw new Error('Gagal mengambil data modul');
            const body = await response.json();
            if (!body.success) throw new Error(body.error || 'Terjadi kesalahan sistem');
            setModules(body.data);
            setTotalPages(body.pagination?.totalPages || 1);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Gagal mengambil data modul');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchModules(page);
    }, [page, fetchModules]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((body) => {
                if (body.success) setUserRole(body.data.role);
            })
            .catch(() => undefined);
    }, []);

    const deleteModule = async (id: string, title: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Modul?',
            message: `Apakah Anda yakin ingin menghapus modul "${title}" secara permanen? Sesi yang menggunakan modul ini dapat terdampak.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus Modul',
            cancelLabel: 'Batal',
        });
        if (!isConfirmed) return;

        try {
            const response = await fetch(`/api/modules/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Gagal menghapus modul');
            toast.success('Modul berhasil dihapus');
            fetchModules(page);
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus modul');
        }
    };

    return (
        <div className="relative max-w-6xl space-y-8 pb-12">
            <ConfirmComponent />
            <ManagementPageHeader
                title="Modul Pembelajaran"
                description="Susun materi dan ujian menjadi alur pembelajaran yang terurut sebelum digunakan pada sesi peserta."
                icon={<Boxes className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Modul Baru' : undefined}
                actionHref={userRole === 'admin' ? '/admin/modules/new' : undefined}
                onRefresh={() => fetchModules(page)}
                isRefreshing={isLoading}
            />

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <div>
                        <h2 className="text-sm font-medium">Modul tidak dapat dimuat</h2>
                        <p className="mt-1 text-sm opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-64 rounded-lg" />)}
                </div>
            ) : modules.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                    <ListTree className="mx-auto size-9 text-muted-foreground/50" />
                    <h2 className="mt-4 font-medium">Belum ada modul pembelajaran</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                        Buat modul pertama, kemudian tentukan urutan materi dan ujian yang harus diselesaikan peserta.
                    </p>
                    {userRole === 'admin' && (
                        <Link href="/admin/modules/new" className={cn(buttonVariants({ size: 'lg' }), 'mt-5')}>
                            <Plus /> Buat Modul Pertama
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {modules.map((module) => (
                        <Card key={module.id} className="gap-0 rounded-lg py-0 shadow-none">
                            <CardHeader className="gap-4 px-5 pb-4 pt-5">
                                <div className="flex items-center justify-between gap-3">
                                    <Badge variant="outline" className="rounded-md text-muted-foreground">
                                        <ListTree /> Modul
                                    </Badge>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <CalendarDays className="size-3.5" /> {formatDate(module.created_at)}
                                    </span>
                                </div>
                                <div>
                                    <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">{module.title}</CardTitle>
                                    <p className="mt-2 line-clamp-3 min-h-12 text-sm leading-6 text-muted-foreground">
                                        {module.description || 'Belum ada deskripsi. Buka modul untuk melihat dan menyusun urutan pembelajarannya.'}
                                    </p>
                                </div>
                            </CardHeader>

                            <CardContent className="border-t px-5 py-4">
                                <dl className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Struktur</dt>
                                        <dd className="mt-1 font-medium">Alur pembelajaran terurut</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Dibuat pada</dt>
                                        <dd className="mt-1 font-medium">{formatDate(module.created_at)}</dd>
                                    </div>
                                </dl>
                            </CardContent>

                            <CardFooter className="justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3">
                                <Link href={`/admin/modules/${module.id}`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                                    <Eye /> Buka modul
                                </Link>
                                {userRole === 'admin' && (
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/modules/${module.id}/edit`}
                                            className={buttonVariants({ variant: 'outline', size: 'icon' })}
                                            aria-label={`Edit modul ${module.title}`}
                                            title="Edit modul"
                                        >
                                            <Pencil />
                                        </Link>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => deleteModule(module.id, module.title)}
                                            aria-label={`Hapus modul ${module.title}`}
                                            title="Hapus modul"
                                        >
                                            <Trash2 />
                                        </Button>
                                    </div>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
    );
}
