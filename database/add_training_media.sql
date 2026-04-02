-- =============================================================================
-- Migration: Add training_media table for multi-media attachments
-- Run against: lms_antigravity (MySQL 8.x)
-- =============================================================================

USE lms_antigravity;

-- ─────────────────────────────────────────────
-- 1. Create training_media table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_media (
  id                VARCHAR(36) PRIMARY KEY,
  training_id       VARCHAR(36) NOT NULL,
  media_type        ENUM('video', 'image', 'pdf', 'document') NOT NULL,
  media_url         VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NULL,
  sequence_order    INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_training_media_training (training_id),
  CONSTRAINT fk_training_media_training
    FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 2. Migrate existing video_url data
-- ─────────────────────────────────────────────
INSERT INTO training_media (id, training_id, media_type, media_url, original_filename, sequence_order)
SELECT
  UUID(),
  id,
  'video',
  video_url,
  'YouTube Video',
  0
FROM trainings
WHERE video_url IS NOT NULL AND video_url != '';

-- ─────────────────────────────────────────────
-- 3. Drop the old video_url column
-- ─────────────────────────────────────────────
ALTER TABLE trainings DROP COLUMN video_url;
