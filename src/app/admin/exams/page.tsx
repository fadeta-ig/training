'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    CalendarDays,
    FileQuestion,
    ListChecks,
    Pencil,
    Plus,
    Target,
    Timer,
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

type Exam = {
    id: string;
    title: string;
    duration_minutes: number;
    passing_grade: number;
    created_at: string;
};

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function ExamsManagerPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [userRole, setUserRole] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchExams = useCallback(async (targetPage: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/exams?page=${targetPage}&limit=10`);
            if (!response.ok) throw new Error('Gagal memuat data ujian');
            const body = await response.json();
            if (!body.success) throw new Error(body.error || 'Terjadi kesalahan server');
            setExams(body.data);
            setTotalPages(body.pagination?.totalPages || 1);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Gagal memuat data ujian');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExams(page);
    }, [page, fetchExams]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((body) => {
                if (body.success) setUserRole(body.data.role);
            })
            .catch(() => undefined);
    }, []);

    const deleteExam = async (id: string, title: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Ujian?',
            message: `Apakah Anda yakin ingin menghapus ujian "${title}" beserta seluruh soalnya secara permanen? Aksi ini tidak dapat dibatalkan.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus Ujian',
            cancelLabel: 'Batal',
        });
        if (!isConfirmed) return;

        try {
            const response = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Gagal menghapus ujian');
            toast.success('Ujian berhasil dihapus');
            fetchExams(page);
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus ujian');
        }
    };

    return (
        <div className="relative max-w-6xl space-y-8 pb-12">
            <ConfirmComponent />
            <ManagementPageHeader
                title="Ujian & Bank Soal"
                description="Atur durasi dan nilai kelulusan, lalu susun pertanyaan yang akan digunakan dalam evaluasi peserta."
                icon={<FileQuestion className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Ujian Baru' : undefined}
                actionHref={userRole === 'admin' ? '/admin/exams/new' : undefined}
                onRefresh={() => fetchExams(page)}
                isRefreshing={isLoading}
            />

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <div>
                        <h2 className="text-sm font-medium">Ujian tidak dapat dimuat</h2>
                        <p className="mt-1 text-sm opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-64 rounded-lg" />)}
                </div>
            ) : exams.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                    <FileQuestion className="mx-auto size-9 text-muted-foreground/50" />
                    <h2 className="mt-4 font-medium">Belum ada ujian</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                        Buat parameter ujian pertama, kemudian tambahkan pertanyaan melalui Bank Soal.
                    </p>
                    {userRole === 'admin' && (
                        <Link href="/admin/exams/new" className={cn(buttonVariants({ size: 'lg' }), 'mt-5')}>
                            <Plus /> Buat Ujian Pertama
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {exams.map((exam) => (
                        <Card key={exam.id} className="gap-0 rounded-lg py-0 shadow-none">
                            <CardHeader className="gap-4 px-5 pb-4 pt-5">
                                <div className="flex items-center justify-between gap-3">
                                    <Badge variant="outline" className="rounded-md text-muted-foreground">
                                        <FileQuestion /> Ujian
                                    </Badge>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <CalendarDays className="size-3.5" /> {formatDate(exam.created_at)}
                                    </span>
                                </div>
                                <div>
                                    <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">{exam.title}</CardTitle>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        Evaluasi peserta dengan durasi dan batas kelulusan yang telah ditentukan.
                                    </p>
                                </div>
                            </CardHeader>

                            <CardContent className="border-t px-5 py-4">
                                <dl className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Timer className="size-3.5" /> Durasi ujian
                                        </dt>
                                        <dd className="mt-1 font-medium tabular-nums">{exam.duration_minutes} menit</dd>
                                    </div>
                                    <div>
                                        <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Target className="size-3.5" /> Nilai kelulusan
                                        </dt>
                                        <dd className="mt-1 font-medium tabular-nums">{Number(exam.passing_grade).toLocaleString('id-ID')}%</dd>
                                    </div>
                                </dl>
                            </CardContent>

                            <CardFooter className="justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3">
                                <Link href={`/admin/exams/${exam.id}/questions`} className={buttonVariants({ size: 'lg' })}>
                                    <ListChecks /> {userRole === 'admin' ? 'Kelola bank soal' : 'Lihat bank soal'}
                                </Link>
                                {userRole === 'admin' && (
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/exams/${exam.id}/edit`}
                                            className={buttonVariants({ variant: 'outline', size: 'icon' })}
                                            aria-label={`Edit ujian ${exam.title}`}
                                            title="Edit parameter ujian"
                                        >
                                            <Pencil />
                                        </Link>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => deleteExam(exam.id, exam.title)}
                                            aria-label={`Hapus ujian ${exam.title}`}
                                            title="Hapus ujian"
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
