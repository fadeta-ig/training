'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    BookOpen,
    CalendarDays,
    Eye,
    FileText,
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

type Training = {
    id: string;
    title: string;
    created_at: string;
};

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function ContentManagerPage() {
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [userRole, setUserRole] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchTrainings = useCallback(async (targetPage: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/trainings?page=${targetPage}&limit=10`);
            if (!response.ok) throw new Error('Gagal mengambil data materi');
            const body = await response.json();
            if (!body.success) throw new Error(body.error || 'Terjadi kesalahan sistem');
            setTrainings(body.data);
            setTotalPages(body.pagination?.totalPages || 1);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Gagal mengambil data materi');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrainings(page);
    }, [page, fetchTrainings]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((body) => {
                if (body.success) setUserRole(body.data.role);
            })
            .catch(() => undefined);
    }, []);

    const deleteTraining = async (id: string, title: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Materi?',
            message: `Apakah Anda yakin ingin menghapus materi "${title}" secara permanen? Aksi ini tidak dapat dibatalkan.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus Materi',
            cancelLabel: 'Batal',
        });
        if (!isConfirmed) return;

        try {
            const response = await fetch(`/api/trainings/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Gagal menghapus materi');
            toast.success('Materi berhasil dihapus');
            fetchTrainings(page);
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus materi');
        }
    };

    return (
        <div className="relative max-w-6xl space-y-8 pb-12">
            <ConfirmComponent />
            <ManagementPageHeader
                title="Materi Pelatihan"
                description="Kelola bacaan, artikel, video, dan bahan pembelajaran yang akan digunakan dalam modul."
                icon={<BookOpen className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Materi Baru' : undefined}
                actionHref={userRole === 'admin' ? '/admin/content/new' : undefined}
                onRefresh={() => fetchTrainings(page)}
                isRefreshing={isLoading}
            />

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <div>
                        <h2 className="text-sm font-medium">Materi tidak dapat dimuat</h2>
                        <p className="mt-1 text-sm opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-60 rounded-lg" />)}
                </div>
            ) : trainings.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                    <FileText className="mx-auto size-9 text-muted-foreground/50" />
                    <h2 className="mt-4 font-medium">Belum ada materi pelatihan</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                        Buat materi pertama agar dapat digunakan saat menyusun alur pembelajaran pada Modul Builder.
                    </p>
                    {userRole === 'admin' && (
                        <Link href="/admin/content/new" className={cn(buttonVariants({ size: 'lg' }), 'mt-5')}>
                            <Plus /> Buat Materi Pertama
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {trainings.map((training) => (
                        <Card key={training.id} className="gap-0 rounded-lg py-0 shadow-none">
                            <CardHeader className="gap-4 px-5 pb-4 pt-5">
                                <div className="flex items-center justify-between gap-3">
                                    <Badge variant="outline" className="rounded-md text-muted-foreground">
                                        <FileText /> Materi
                                    </Badge>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <CalendarDays className="size-3.5" /> {formatDate(training.created_at)}
                                    </span>
                                </div>
                                <div>
                                    <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">{training.title}</CardTitle>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        Bahan pembelajaran yang siap ditambahkan ke dalam modul pelatihan.
                                    </p>
                                </div>
                            </CardHeader>

                            <CardContent className="border-t px-5 py-4">
                                <dl className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Jenis konten</dt>
                                        <dd className="mt-1 font-medium">Materi pembelajaran</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Dibuat pada</dt>
                                        <dd className="mt-1 font-medium">{formatDate(training.created_at)}</dd>
                                    </div>
                                </dl>
                            </CardContent>

                            <CardFooter className="justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3">
                                <Link href={`/admin/content/${training.id}`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                                    <Eye /> Lihat materi
                                </Link>
                                {userRole === 'admin' && (
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/content/${training.id}/edit`}
                                            className={buttonVariants({ variant: 'outline', size: 'icon' })}
                                            aria-label={`Edit materi ${training.title}`}
                                            title="Edit materi"
                                        >
                                            <Pencil />
                                        </Link>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => deleteTraining(training.id, training.title)}
                                            aria-label={`Hapus materi ${training.title}`}
                                            title="Hapus materi"
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
