-- =============================================================================
-- Migration: Add enable_proctoring column to sessions table
-- Run against: lms_antigravity (MySQL 8.x)
-- =============================================================================
-- Adds a per-session toggle to control whether webcam proctoring is active.
-- Default: TRUE (proctoring enabled by default on new sessions).
-- =============================================================================

USE lms_antigravity;

ALTER TABLE sessions
  ADD COLUMN enable_proctoring BOOLEAN NOT NULL DEFAULT TRUE;
