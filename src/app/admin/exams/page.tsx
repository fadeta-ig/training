'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    CalendarDays,
    Copy,
    FileQuestion,
    ListChecks,
    Loader2,
    Pencil,
    Plus,
    RotateCcw,
    Target,
    Timer,
    Trash2,
    Tag,
} from 'lucide-react';
import { ManagementPageHeader } from '@/components/admin/ManagementPageHeader';
import {
    LearningFilterBar,
    FilterItemConfig,
    SortOption,
} from '@/components/admin/LearningFilterBar';
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
    category_id?: string | null;
    category_name?: string | null;
    category_code?: string | null;
    category_color?: string | null;
    title: string;
    duration_minutes: number;
    passing_grade: number;
    allow_remedial?: boolean | number;
    max_attempts?: number;
    remedial_exam_id?: string | null;
    remedial_exam_title?: string | null;
    created_at: string;
    question_count?: number;
    module_count?: number;
    is_remedial_package?: boolean | number;
};

interface CategoryOption {
    id: string;
    name: string;
    code: string;
    color: string;
}

const SORT_OPTIONS: SortOption[] = [
    { label: 'Terbaru Dibuat', value: 'created_desc' },
    { label: 'Terlama Dibuat', value: 'created_asc' },
    { label: 'Judul (A - Z)', value: 'title_asc' },
    { label: 'Judul (Z - A)', value: 'title_desc' },
    { label: 'Passing Grade Tertinggi', value: 'passing_grade_desc' },
    { label: 'Passing Grade Terendah', value: 'passing_grade_asc' },
    { label: 'Durasi Terlama', value: 'duration_desc' },
    { label: 'Durasi Tercepat', value: 'duration_asc' },
    { label: 'Jumlah Soal Terbanyak', value: 'questions_desc' },
];

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function ExamsManagerPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [userRole, setUserRole] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

    // Search, Filter, Sort States
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [examType, setExamType] = useState('all');
    const [allowRemedial, setAllowRemedial] = useState('all');
    const [questionStatus, setQuestionStatus] = useState('all');
    const [sort, setSort] = useState('created_desc');

    const { confirm, ConfirmComponent } = useConfirm();

    // Fetch accessible categories for filter
    useEffect(() => {
        fetch('/api/admin/categories?all=true')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && Array.isArray(data.data)) {
                    setCategories(data.data);
                }
            })
            .catch(() => undefined);
    }, []);

    const fetchExams = useCallback(
        async (
            targetPage: number,
            limit: number,
            currentSearch = search,
            currentCategory = category,
            currentExamType = examType,
            currentAllowRemedial = allowRemedial,
            currentQuestionStatus = questionStatus,
            currentSort = sort
        ) => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    page: String(targetPage),
                    limit: String(limit),
                    search: currentSearch,
                    category_id: currentCategory,
                    exam_type: currentExamType,
                    allow_remedial: currentAllowRemedial,
                    question_status: currentQuestionStatus,
                    sort: currentSort,
                });
                const response = await fetch(`/api/exams?${params.toString()}`);
                if (!response.ok) throw new Error('Gagal memuat data ujian');
                const body = await response.json();
                if (!body.success) throw new Error(body.error || 'Terjadi kesalahan server');
                setExams(body.data);
                setTotalPages(body.pagination?.totalPages || 1);
                setTotalItems(body.pagination?.total || body.data.length);
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Gagal memuat data ujian');
            } finally {
                setIsLoading(false);
            }
        },
        [search, category, examType, allowRemedial, questionStatus, sort]
    );

    useEffect(() => {
        fetchExams(page, pageSize);
    }, [page, pageSize, fetchExams]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((body) => {
                if (body.success) setUserRole(body.data.role);
            })
            .catch(() => undefined);
    }, []);

    const handleSearchChange = (newSearch: string) => {
        setSearch(newSearch);
        setPage(1);
    };

    const handleCategoryChange = (newCategory: string) => {
        setCategory(newCategory);
        setPage(1);
    };

    const handleExamTypeChange = (newType: string) => {
        setExamType(newType);
        setPage(1);
    };

    const handleAllowRemedialChange = (newRemedial: string) => {
        setAllowRemedial(newRemedial);
        setPage(1);
    };

    const handleQuestionStatusChange = (newStatus: string) => {
        setQuestionStatus(newStatus);
        setPage(1);
    };

    const handleSortChange = (newSort: string) => {
        setSort(newSort);
        setPage(1);
    };

    const handleReset = () => {
        setSearch('');
        setCategory('all');
        setExamType('all');
        setAllowRemedial('all');
        setQuestionStatus('all');
        setSort('created_desc');
        setPage(1);
    };

    const isFilterActive =
        search.trim() !== '' ||
        category !== 'all' ||
        examType !== 'all' ||
        allowRemedial !== 'all' ||
        questionStatus !== 'all' ||
        sort !== 'created_desc';

    const filterConfigs: FilterItemConfig[] = [
        {
            id: 'category',
            label: 'Kategori',
            value: category,
            onChange: handleCategoryChange,
            options: [
                { label: 'Semua Kategori', value: 'all' },
                ...categories.map((c) => ({
                    label: `${c.name} (${c.code})`,
                    value: c.id,
                })),
            ],
        },
        {
            id: 'exam_type',
            label: 'Tipe Paket Ujian',
            value: examType,
            onChange: handleExamTypeChange,
            options: [
                { label: 'Semua Tipe Paket', value: 'all' },
                { label: 'Ujian Reguler', value: 'regular' },
                { label: 'Paket Remedial Saja', value: 'remedial' },
            ],
        },
        {
            id: 'allow_remedial',
            label: 'Hak Remedial',
            value: allowRemedial,
            onChange: handleAllowRemedialChange,
            options: [
                { label: 'Semua Kebijakan Remedial', value: 'all' },
                { label: 'Mengizinkan Remedial', value: 'yes' },
                { label: 'Tanpa Remedial', value: 'no' },
            ],
        },
        {
            id: 'question_status',
            label: 'Ketersediaan Soal',
            value: questionStatus,
            onChange: handleQuestionStatusChange,
            options: [
                { label: 'Semua Bank Soal', value: 'all' },
                { label: 'Sudah Memiliki Soal', value: 'has_questions' },
                { label: 'Belum Ada Soal', value: 'no_questions' },
            ],
        },
    ];

    const duplicateExam = async (id: string, title: string) => {
        const confirmed = await confirm({
            title: `Duplikasi Ujian "${title}"?`,
            message: 'Sistem akan membuat salinan paket ujian ini beserta seluruh butir soalnya.',
            confirmLabel: 'Duplikasi Sekarang',
            isDestructive: false,
        });

        if (!confirmed) return;

        setDuplicatingId(id);
        try {
            const res = await fetch(`/api/exams/${id}/duplicate`, { method: 'POST' });
            const body = await res.json();
            if (!res.ok || !body.success) {
                toast.error(body.error || 'Gagal menduplikasi ujian');
                return;
            }
            toast.success('Ujian berhasil diduplikasi');
            fetchExams(page, pageSize);
        } catch {
            toast.error('Terjadi kesalahan saat menduplikasi ujian');
        } finally {
            setDuplicatingId(null);
        }
    };

    const deleteExam = async (id: string, title: string) => {
        const confirmed = await confirm({
            title: `Hapus ujian "${title}"?`,
            message: 'Ujian yang sudah dihapus tidak dapat dipulihkan. Pastikan ujian ini tidak lagi digunakan.',
            confirmLabel: 'Hapus ujian',
            isDestructive: true,
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
            const body = await response.json();
            if (!response.ok || !body.success) {
                toast.error(body.error || 'Gagal menghapus ujian');
                return;
            }
            toast.success('Ujian berhasil dihapus');
            fetchExams(page, pageSize);
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus ujian');
        }
    };

    return (
        <div className="relative max-w-6xl space-y-6 pb-12">
            <ConfirmComponent />
            <ManagementPageHeader
                title="Bank Soal & Ujian"
                description={
                    userRole === 'trainer'
                        ? 'Daftar bank soal dan konfigurasi ujian yang ditugaskan kepada Anda.'
                        : 'Kelola paket evaluasi, batas waktu, passing grade, dan bank butir soal yang siap diujikan.'
                }
                icon={<FileQuestion className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Ujian Baru' : undefined}
                actionHref={userRole === 'admin' ? '/admin/exams/new' : undefined}
                onRefresh={() => fetchExams(page, pageSize)}
                isRefreshing={isLoading}
            />

            {/* Filter Bar */}
            <LearningFilterBar
                search={search}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Cari judul ujian atau kode kategori..."
                filters={filterConfigs}
                sort={sort}
                onSortChange={handleSortChange}
                sortOptions={SORT_OPTIONS}
                onReset={handleReset}
                totalItems={totalItems}
                itemLabel="ujian"
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
                isFilterActive ? (
                    <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                        <FileQuestion className="mx-auto size-9 text-muted-foreground/50" />
                        <h2 className="mt-4 font-medium">Tidak ada ujian yang cocok</h2>
                        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                            Pencarian atau filter yang Anda gunakan tidak menemukan hasil. Coba ganti kata kunci atau reset filter.
                        </p>
                        <Button variant="outline" onClick={handleReset} className="mt-5">
                            <RotateCcw className="size-4 mr-1.5" /> Reset Filter
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                        <FileQuestion className="mx-auto size-9 text-muted-foreground/50" />
                        <h2 className="mt-4 font-medium">Belum ada paket ujian</h2>
                        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                            {userRole === 'trainer'
                                ? 'Belum ada paket ujian yang ditugaskan oleh Administrator kepada Anda.'
                                : 'Mulai rancang evaluasi belajar dengan menentukan durasi, passing grade, dan butir soal.'}
                        </p>
                        {userRole === 'admin' && (
                            <Link href="/admin/exams/new" className={cn(buttonVariants(), 'mt-5')}>
                                <Plus /> Buat Ujian Pertama
                            </Link>
                        )}
                    </div>
                )
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {exams.map((exam) => (
                        <Card key={exam.id} className="flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-shadow">
                            <CardHeader className="space-y-3 p-5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {/* Category Badge */}
                                        {exam.category_code && (
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider"
                                                style={{
                                                    backgroundColor: `${exam.category_color || '#0ea5e9'}18`,
                                                    color: exam.category_color || '#0ea5e9',
                                                }}
                                            >
                                                {exam.category_code}
                                            </span>
                                        )}
                                        {Boolean(exam.is_remedial_package) ? (
                                            <Badge variant="secondary" className="rounded-md border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[11px]">
                                                Paket Remedial
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="rounded-md text-[11px] font-normal">
                                                Ujian Reguler
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="rounded-md text-[11px] font-normal">
                                            {exam.question_count || 0} Soal
                                        </Badge>
                                        {Boolean(exam.allow_remedial) && (
                                            <Badge variant="outline" className="rounded-md border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[11px]">
                                                Remedial Aktif
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                        <CalendarDays className="size-3.5" /> {formatDate(exam.created_at)}
                                    </span>
                                </div>
                                <div>
                                    <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">{exam.title}</CardTitle>
                                    <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Tag size={12} className="text-muted-foreground/70" />
                                        <span>Kategori: {exam.category_name || 'Umum'}</span>
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
                                <Link href={`/admin/exams/${exam.id}/questions`} className={buttonVariants({ size: 'sm' })}>
                                    <ListChecks className="size-4 mr-1.5" /> {userRole === 'admin' ? 'Kelola bank soal' : 'Lihat bank soal'}
                                </Link>
                                {userRole === 'admin' && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => duplicateExam(exam.id, exam.title)}
                                            disabled={duplicatingId === exam.id}
                                            aria-label={`Duplikasi ujian ${exam.title}`}
                                            title="Duplikasi ujian beserta seluruh bank soal"
                                        >
                                            {duplicatingId === exam.id ? (
                                                <Loader2 className="size-4 animate-spin text-blue-600" />
                                            ) : (
                                                <Copy className="size-4" />
                                            )}
                                        </Button>
                                        <Link
                                            href={`/admin/exams/${exam.id}/edit`}
                                            className={buttonVariants({ variant: 'outline', size: 'icon' })}
                                            aria-label={`Edit ujian ${exam.title}`}
                                            title="Edit parameter ujian"
                                        >
                                            <Pencil size={15} />
                                        </Link>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => deleteExam(exam.id, exam.title)}
                                            aria-label={`Hapus ujian ${exam.title}`}
                                            title="Hapus ujian"
                                        >
                                            <Trash2 size={15} />
                                        </Button>
                                    </div>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                }}
            />
        </div>
    );
}
