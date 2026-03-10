import { ArrowLeft01Icon as ChevronLeftIcon, ArrowRight01Icon as ChevronRightIcon } from 'hugeicons-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const generatePageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="flex items-center justify-center gap-1.5 mt-6">
            <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-black/10 bg-white text-muted-foreground hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Halaman Sebelumnya"
            >
                <ChevronLeftIcon size={16} />
            </button>

            {generatePageNumbers().map((page, index) => (
                <button
                    key={index}
                    disabled={page === '...'}
                    onClick={() => typeof page === 'number' && onPageChange(page)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${page === currentPage
                        ? 'bg-foreground text-background shadow-md'
                        : page === '...'
                            ? 'text-muted-foreground bg-transparent cursor-default'
                            : 'border border-black/10 bg-white text-muted-foreground hover:bg-black/5 hover:text-foreground'
                        }`}
                >
                    {page}
                </button>
            ))}

            <button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-black/10 bg-white text-muted-foreground hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Halaman Berikutnya"
            >
                <ChevronRightIcon size={16} />
            </button>
        </div>
    );
}
