-- =============================================================================
-- Migration: Rename proctor_snapshots.image_base64 → image_url
-- Run against: lms_antigravity (MySQL 8.x)
-- =============================================================================
-- This column was originally designed for base64 LONGTEXT storage,
-- but the current implementation saves files to disk and stores the URL path.
-- This migration corrects the column name to match its actual content.
-- =============================================================================

USE lms_antigravity;

ALTER TABLE proctor_snapshots
  CHANGE COLUMN image_base64 image_url VARCHAR(500) NOT NULL;
