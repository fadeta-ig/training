import { useState, useCallback, useRef } from 'react';

export interface UndoStack<T> {
    canUndo: boolean;
    undoCount: number;
    push: (snapshot: T) => void;
    pop: () => T | undefined;
    clear: () => void;
}

/**
 * Custom hook for managing an undo stack with a fixed maximum depth.
 * Uses a ref for synchronous snapshot retrieval and state for reactive UI counters.
 */
export function useUndoStack<T>(maxDepth: number = 5): UndoStack<T> {
    const [count, setCount] = useState(0);
    const stackRef = useRef<T[]>([]);

    const push = useCallback((snapshot: T) => {
        const next = [...stackRef.current, snapshot];
        stackRef.current = next.length > maxDepth ? next.slice(next.length - maxDepth) : next;
        setCount(stackRef.current.length);
    }, [maxDepth]);

    const pop = useCallback((): T | undefined => {
        if (stackRef.current.length === 0) return undefined;
        const popped = stackRef.current[stackRef.current.length - 1];
        stackRef.current = stackRef.current.slice(0, -1);
        setCount(stackRef.current.length);
        return popped;
    }, []);

    const clear = useCallback(() => {
        stackRef.current = [];
        setCount(0);
    }, []);

    return {
        canUndo: count > 0,
        undoCount: count,
        push,
        pop,
        clear,
    };
}
