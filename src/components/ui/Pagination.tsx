import {
    ArrowLeft01Icon as ChevronLeftIcon,
    ArrowRight01Icon as ChevronRightIcon,
    ArrowLeftDoubleIcon as ChevronDoubleLeftIcon,
    ArrowRightDoubleIcon as ChevronDoubleRightIcon,
} from 'hugeicons-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems?: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
    className?: string;
}

export function Pagination({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
    className = '',
}: PaginationProps) {
    if (totalPages <= 1 && (!totalItems || totalItems <= pageSizeOptions[0])) {
        return null;
    }

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

    // Calculate displayed items range
    const currentSize = pageSize || 10;
    const fromItem = totalItems ? (currentPage - 1) * currentSize + 1 : undefined;
    const toItem = totalItems ? Math.min(currentPage * currentSize, totalItems) : undefined;

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-black/5 text-xs text-muted-foreground ${className}`}>
            {/* Left Info & Page Size Selector */}
            <div className="flex flex-wrap items-center gap-3">
                {totalItems !== undefined && fromItem !== undefined && toItem !== undefined && (
                    <span className="font-medium">
                        Menampilkan <strong className="text-foreground">{fromItem}–{toItem}</strong> dari <strong className="text-foreground">{totalItems}</strong> data
                    </span>
                )}

                {onPageSizeChange && pageSize && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Tampilkan:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="bg-slate-50 border border-black/10 rounded-md px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        >
                            {pageSizeOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        <span>per hal.</span>
                    </div>
                )}
            </div>

            {/* Right Page Controls */}
            <div className="flex items-center gap-1">
                {/* First Page */}
                <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/10 bg-white text-muted-foreground hover:bg-slate-100 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Halaman Pertama"
                >
                    <ChevronDoubleLeftIcon size={14} />
                </button>

                {/* Previous Page */}
                <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/10 bg-white text-muted-foreground hover:bg-slate-100 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Halaman Sebelumnya"
                >
                    <ChevronLeftIcon size={14} />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1 px-1">
                    {generatePageNumbers().map((page, index) => (
                        <button
                            type="button"
                            key={index}
                            disabled={page === '...'}
                            onClick={() => typeof page === 'number' && onPageChange(page)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                                page === currentPage
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : page === '...'
                                    ? 'text-muted-foreground bg-transparent cursor-default'
                                    : 'border border-black/10 bg-white text-muted-foreground hover:bg-slate-100 hover:text-foreground'
                            }`}
                        >
                            {page}
                        </button>
                    ))}
                </div>

                {/* Next Page */}
                <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/10 bg-white text-muted-foreground hover:bg-slate-100 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Halaman Berikutnya"
                >
                    <ChevronRightIcon size={14} />
                </button>

                {/* Last Page */}
                <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange(totalPages)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/10 bg-white text-muted-foreground hover:bg-slate-100 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Halaman Terakhir"
                >
                    <ChevronDoubleRightIcon size={14} />
                </button>
            </div>
        </div>
    );
}
