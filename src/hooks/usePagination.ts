import { useState, useMemo } from 'react';

interface UsePaginationOptions<T> {
    items: T[];
    initialPageSize?: number;
    initialPage?: number;
}

interface UsePaginationReturn<T> {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    startIndex: number;
    endIndex: number;
    paginatedItems: T[];
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
    nextPage: () => void;
    previousPage: () => void;
}

/**
 * Custom React Hook for seamless client-side array pagination.
 * Provides current page slice, page navigation, and page size control.
 */
export function usePagination<T>({
    items,
    initialPageSize = 10,
    initialPage = 1,
}: UsePaginationOptions<T>): UsePaginationReturn<T> {
    const [currentPage, setCurrentPage] = useState<number>(initialPage);
    const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // Clamp current page within valid range whenever items or pageSize change
    const validPage = useMemo(() => {
        return Math.min(Math.max(1, currentPage), totalPages);
    }, [currentPage, totalPages]);

    const startIndex = (validPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    const paginatedItems = useMemo(() => {
        return items.slice(startIndex, endIndex);
    }, [items, startIndex, endIndex]);

    const handleSetPage = (page: number) => {
        const clamped = Math.min(Math.max(1, page), totalPages);
        setCurrentPage(clamped);
    };

    const handleSetPageSize = (size: number) => {
        setPageSizeState(size);
        setCurrentPage(1);
    };

    const nextPage = () => handleSetPage(validPage + 1);
    const previousPage = () => handleSetPage(validPage - 1);

    return {
        currentPage: validPage,
        pageSize,
        totalPages,
        totalItems,
        startIndex,
        endIndex,
        paginatedItems,
        setPage: handleSetPage,
        setPageSize: handleSetPageSize,
        nextPage,
        previousPage,
    };
}
