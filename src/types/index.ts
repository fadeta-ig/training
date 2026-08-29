/**
 * Database Row Type Definitions
 * Centralized TypeScript interfaces replacing `any` casts across API routes.
 */

export interface User {
    id: string;
    role: 'admin' | 'trainer' | 'trainee';
    approval_status?: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string | null;
    approved_at?: string | null;
    full_name: string;
    username: string;
    password_hash: string;
    created_at: string;
    reset_token?: string | null;
    reset_token_expires?: string | null;
}

export interface CertificationProgram {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ParticipantProfile {
    id: string;
    user_id: string;
    nip: string | null;
    phone_number: string | null;
    address: string | null;
    date_of_birth: string | null;
    gender: 'L' | 'P';
    institution: string | null;
    institution_code: string | null;
    target_certification_id?: string | null;
    target_certification_name?: string | null;
    target_period?: string | null;
    batch: string;
    registration_date: string;
    created_at: string;
    updated_at: string;
}

export interface PendingRegistration {
    id: string; // user id
    full_name: string;
    username: string; // email
    phone_number: string | null;
    institution: string | null;
    institution_code: string | null;
    gender: 'L' | 'P' | null;
    date_of_birth: string | null;
    address: string | null;
    target_certification_id: string | null;
    target_certification_name: string | null;
    target_period: string | null;
    approval_status: 'pending' | 'approved' | 'rejected';
    rejection_reason: string | null;
    created_at: string;
}


export interface Training {
    id: string;
    title: string;
    content_html: string;
    created_at: string;
    updated_at: string;
}

export interface TrainingMedia {
    id: string;
    training_id: string;
    media_type: 'video' | 'image' | 'pdf' | 'document';
    media_url: string;
    original_filename: string | null;
    sequence_order: number;
    created_at: string;
}

export interface Exam {
    id: string;
    title: string;
    duration_minutes: number;
    passing_grade: number;
    allow_remedial: boolean;
    max_attempts: number;
    remedial_exam_id?: string | null;
    remedial_exam_title?: string | null;
    created_at: string;
}

export interface Question {
    id: string;
    exam_id: string;
    question_type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay' | 'matching';
    question_text: string;
    question_image: string | null;
    options_json: string | null;
    correct_option_index: number | null;
    correct_answer: string | null;
    points: number;
    sequence_order: number;
}

export interface Module {
    id: string;
    title: string;
    description: string | null;
    created_at: string;
}

export interface ModuleItem {
    id: string;
    module_id: string;
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
}

export interface Session {
    id: string;
    module_id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    show_score: boolean;
    enable_proctoring: boolean;
    seb_config_key: string | null;
    created_at: string;
}

export interface SessionParticipant {
    id: string;
    session_id: string;
    user_id: string;
    graduation_status?: 'pending' | 'passed' | 'failed';
    graduation_decided_at?: string | null;
    graduation_decided_by?: string | null;
    graduation_notes?: string | null;
    skl_number?: string | null;
    skl_generated_at?: string | null;
    certificate_file_url?: string | null;
    certificate_number?: string | null;
    certificate_uploaded_at?: string | null;
}

export interface UserProgress {
    id: string;
    user_id: string;
    session_id: string;
    module_item_id: string;
    status: 'locked' | 'open' | 'completed';
    score: number | null;
    attempts_count: number;
    attempt_version: number;
    last_attempt_start: string | null;
    individual_extension_until: string | null;
    updated_at: string;
}

export interface ExamAnswer {
    id: string;
    user_id: string;
    session_id: string;
    question_id: string;
    selected_option: string;
    is_correct: boolean;
    attempt_number: number;
    answered_at: string;
}

export interface ProctorSnapshot {
    id: string;
    user_id: string;
    session_id: string;
    image_url: string;
    captured_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    is_read: boolean;
    link_url: string | null;
    created_at: string;
}

/** Lightweight user payload from JWT / withAuth */
export interface AuthPayload {
    id: string;
    username: string;
    full_name: string;
    role: 'admin' | 'trainer' | 'trainee';
    nip?: string | null;
    institution?: string | null;
    batch?: string | null;
    registration_date?: string | null;
}

export interface AuditLog {
    id: string;
    user_id: string;
    action_type: string;
    entity: string;
    entity_id: string | null;
    details: any | null;
    created_at: string;
    // Joined standard fields
    full_name?: string;
    username?: string;
}

