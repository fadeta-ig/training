export interface MasterResourceItem {
    id: string;
    title: string;
    type: 'training' | 'exam';
    category_id?: string | null;
    category_name?: string | null;
    category_code?: string | null;
    category_color?: string | null;
    duration_minutes?: number;
    passing_grade?: number;
    question_count?: number;
    media_count?: number;
}

export interface SelectedModuleItem {
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
    title: string;
}

export type ResourceTabType = 'all' | 'training' | 'exam';
