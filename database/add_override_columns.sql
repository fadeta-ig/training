-- Migration script: Add Admin Exam Override columns to user_progress
ALTER TABLE user_progress
  ADD COLUMN attempt_version INT NOT NULL DEFAULT 1 AFTER attempts_count,
  ADD COLUMN individual_extension_until DATETIME NULL AFTER last_attempt_start;
