-- =============================================================================
-- Migration: Priority 2 Features 
-- Run against: lms_antigravity (MySQL 8.x)
-- =============================================================================

USE lms_antigravity;

-- -----------------------------------------------------------------------------
-- 1. FORGOT PASSWORD (Tabel users)
-- Menambahkan kolom reset token dan waktu expirednya
-- -----------------------------------------------------------------------------
ALTER TABLE users 
ADD COLUMN reset_token VARCHAR(255) NULL,
ADD COLUMN reset_token_expires DATETIME NULL;

-- -----------------------------------------------------------------------------
-- 2. AUDIT TRAIL / LOG (Tabel baru)
-- Merekam aktivitas kritikal dari role Admin
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- e.g., 'CREATE_USER', 'DELETE_TRAINING'
    entity VARCHAR(50) NOT NULL,      -- e.g., 'user', 'session', 'exam'
    entity_id VARCHAR(36) NULL,       -- ID of the affected entity
    details JSON NULL,                -- Extra metadata or payload
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
