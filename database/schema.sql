-- =============================================================================
-- LMS Antigravity - Modular Training & Exam System
-- DDL Schema (MySQL 8.x compatible) — SINKRON DENGAN DB AKTUAL
-- =============================================================================
-- Run this against your XAMPP MySQL on localhost:3306
-- Database: lms_antigravity
-- =============================================================================

CREATE DATABASE IF NOT EXISTS lms_antigravity
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lms_antigravity;

-- ─────────────────────────────────────────────
-- 1. Users
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id                  VARCHAR(36)  PRIMARY KEY,
  role                ENUM('admin', 'trainer', 'trainee') NOT NULL DEFAULT 'trainee',
  approval_status     ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
  rejection_reason    VARCHAR(255) NULL,
  approved_at         DATETIME NULL,
  full_name           VARCHAR(100) NOT NULL,
  username            VARCHAR(255) UNIQUE NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,
  reset_token         VARCHAR(255) NULL,
  reset_token_expires DATETIME NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role_created (role, created_at),
  INDEX idx_users_approval (approval_status),
  INDEX idx_users_reset_token (reset_token)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 1b. Master Data: Certification Programs
-- ─────────────────────────────────────────────
CREATE TABLE certification_programs (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  code        VARCHAR(50) UNIQUE NULL,
  description TEXT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cert_programs_active (is_active)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 2. Participant Profiles (Detail Data Peserta)
-- ─────────────────────────────────────────────
CREATE TABLE participant_profiles (
  id                        VARCHAR(36) PRIMARY KEY,
  user_id                   VARCHAR(36) NOT NULL UNIQUE,
  nip                       VARCHAR(50) UNIQUE NULL,
  id_card_number            VARCHAR(50) NULL,
  phone_number              VARCHAR(20) NULL,
  address                   TEXT NULL,
  date_of_birth             DATE NULL,
  gender                    ENUM('L', 'P') NULL DEFAULT NULL,
  institution               VARCHAR(150) NULL,
  institution_code          VARCHAR(20) NULL,
  target_certification_id   VARCHAR(36) NULL,
  target_certification_name VARCHAR(255) NULL,
  target_period             VARCHAR(50) NULL,
  batch                     VARCHAR(50) NOT NULL DEFAULT '1',
  registration_date         DATE NOT NULL DEFAULT (CURRENT_DATE),
  initial_password          VARCHAR(255) NULL,
  must_change_password      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_participant_nip (nip),
  INDEX idx_participant_id_card (id_card_number),
  INDEX idx_participant_inst_batch (institution, batch),
  INDEX idx_participant_reg_date (registration_date),
  CONSTRAINT fk_participant_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_participant_target_cert
    FOREIGN KEY (target_certification_id) REFERENCES certification_programs(id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- ─────────────────────────────────────────────
-- 3. Master Data: Training Materials
-- ─────────────────────────────────────────────
CREATE TABLE trainings (
  id          VARCHAR(36)  PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  content_html TEXT        NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 3b. Training Media (Lampiran Multi-Media)
-- ─────────────────────────────────────────────
CREATE TABLE training_media (
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
-- 4. Master Data: Exams (Bank Soal)
-- ─────────────────────────────────────────────
CREATE TABLE exams (
  id               VARCHAR(36)    PRIMARY KEY,
  title            VARCHAR(150)   NOT NULL,
  duration_minutes INT            NOT NULL DEFAULT 60,
  passing_grade    DECIMAL(5, 2)  NOT NULL DEFAULT 70.00,
  allow_remedial   BOOLEAN        NOT NULL DEFAULT FALSE,
  max_attempts     INT            NOT NULL DEFAULT 1,
  remedial_exam_id VARCHAR(36)    NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exams_remedial (remedial_exam_id),
  CONSTRAINT fk_exams_remedial
    FOREIGN KEY (remedial_exam_id) REFERENCES exams(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 5. Question Import Batches (Staging, Idempotensi, Audit, Rollback)
-- ─────────────────────────────────────────────
CREATE TABLE question_import_batches (
  id                VARCHAR(36) PRIMARY KEY,
  exam_id           VARCHAR(36) NOT NULL,
  created_by        VARCHAR(36) NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_sha256       CHAR(64) NOT NULL,
  payload_sha256    CHAR(64) NOT NULL,
  template_version  VARCHAR(20) NOT NULL,
  status            ENUM('previewed','committed','rolled_back','expired','failed')
                      NOT NULL DEFAULT 'previewed',
  question_count    INT NOT NULL DEFAULT 0,
  total_points      INT NOT NULL DEFAULT 0,
  payload_json      LONGTEXT NULL,
  expires_at        DATETIME NOT NULL,
  committed_at      DATETIME NULL,
  rolled_back_at    DATETIME NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_question_import_exam_created (exam_id, created_at),
  INDEX idx_question_import_exam_file (exam_id, file_sha256),
  INDEX idx_question_import_exam_payload (exam_id, payload_sha256),
  INDEX idx_question_import_status_expiry (status, expires_at),
  CONSTRAINT fk_question_import_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  CONSTRAINT fk_question_import_user
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 6. Questions (Butir Soal — Multi-type)
-- ─────────────────────────────────────────────
CREATE TABLE questions (
  id                   VARCHAR(36) PRIMARY KEY,
  exam_id              VARCHAR(36) NOT NULL,
  question_type        ENUM('multiple_choice','multiple_select','true_false','short_answer','essay','matching')
                         NOT NULL DEFAULT 'multiple_choice',
  question_text        TEXT NOT NULL,
  question_image       VARCHAR(500) NULL,
  options_json         JSON NULL,
  correct_option_index INT NULL,
  correct_answer       TEXT NULL,
  points               INT NOT NULL DEFAULT 1,
  sequence_order       INT NOT NULL DEFAULT 0,
  import_batch_id      VARCHAR(36) NULL,
  source_question_code VARCHAR(50) NULL,
  source_sheet         VARCHAR(50) NULL,
  source_row           INT NULL,
  INDEX idx_questions_exam (exam_id),
  INDEX idx_questions_exam_order (exam_id, sequence_order),
  INDEX idx_questions_import_batch (import_batch_id),
  CONSTRAINT fk_questions_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  CONSTRAINT fk_questions_import_batch
    FOREIGN KEY (import_batch_id) REFERENCES question_import_batches(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 7. Modules (Learning Path / Kerangka Urutan)
-- ─────────────────────────────────────────────
CREATE TABLE modules (
  id          VARCHAR(36)  PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  enforce_sequence BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 8. Module Items (Urutan item di dalam modul)
-- ─────────────────────────────────────────────
CREATE TABLE module_items (
  id             VARCHAR(36) PRIMARY KEY,
  module_id      VARCHAR(36) NOT NULL,
  item_type      ENUM('training', 'exam') NOT NULL,
  item_id        VARCHAR(36) NOT NULL,
  sequence_order INT         NOT NULL,
  INDEX idx_module_items_module_order (module_id, sequence_order),
  INDEX idx_module_items_lookup (module_id, item_type, item_id),
  INDEX idx_module_items_item_id (item_id),
  UNIQUE KEY uq_module_items_item (module_id, item_type, item_id),
  UNIQUE KEY uq_module_items_sequence (module_id, sequence_order),
  CONSTRAINT fk_module_items_module
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 9. Sessions (Jadwal Pelaksanaan Sesi)
-- ─────────────────────────────────────────────
CREATE TABLE sessions (
  id             VARCHAR(36)  PRIMARY KEY,
  module_id      VARCHAR(36)  NOT NULL,
  title          VARCHAR(150) NOT NULL,
  start_time     DATETIME     NOT NULL,
  end_time       DATETIME     NOT NULL,
  session_type   ENUM('regular','remedial') NOT NULL DEFAULT 'regular',
  parent_session_id VARCHAR(36) NULL,
  remedial_cycle INT NOT NULL DEFAULT 0,
  result_state   ENUM('draft','published') NOT NULL DEFAULT 'draft',
  result_published_at DATETIME NULL,
  result_published_by VARCHAR(36) NULL,
  result_publication_version INT NOT NULL DEFAULT 0,
  require_seb    BOOLEAN      DEFAULT FALSE,
  show_score     BOOLEAN      DEFAULT FALSE,
  enable_proctoring BOOLEAN   NOT NULL DEFAULT TRUE,
  seb_config_key VARCHAR(255) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_module_time (module_id, start_time, end_time),
  UNIQUE KEY uq_sessions_parent_cycle (parent_session_id, remedial_cycle),
  CONSTRAINT fk_sessions_module
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_parent
    FOREIGN KEY (parent_session_id) REFERENCES sessions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sessions_result_publisher
    FOREIGN KEY (result_published_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 10. Session Participants (Peserta Terdaftar)
-- ─────────────────────────────────────────────
CREATE TABLE session_participants (
  id                      VARCHAR(36) PRIMARY KEY,
  session_id              VARCHAR(36) NOT NULL,
  user_id                 VARCHAR(36) NOT NULL,
  graduation_status       ENUM('pending', 'passed', 'failed') NOT NULL DEFAULT 'pending',
  graduation_decided_at   DATETIME NULL,
  graduation_decided_by   VARCHAR(36) NULL,
  graduation_notes        TEXT NULL,
  skl_number              VARCHAR(100) NULL,
  skl_generated_at        DATETIME NULL,
  certificate_file_url    VARCHAR(500) NULL,
  certificate_number      VARCHAR(100) NULL,
  certificate_uploaded_at DATETIME NULL,
  UNIQUE KEY uq_session_user (session_id, user_id),
  INDEX idx_session_participants_user (user_id),
  INDEX idx_sp_graduation (graduation_status),
  UNIQUE KEY uq_session_participants_skl_number (skl_number),
  CONSTRAINT fk_sp_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Atomic counters for official document numbers.
CREATE TABLE document_sequences (
  scope_key  VARCHAR(100) PRIMARY KEY,
  next_value BIGINT UNSIGNED NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 11. User Progress (Tracking Keterbukaan & Nilai)
-- ─────────────────────────────────────────────
CREATE TABLE user_progress (
  id                 VARCHAR(36)   PRIMARY KEY,
  user_id            VARCHAR(36)   NOT NULL,
  session_id         VARCHAR(36)   NOT NULL,
  module_item_id     VARCHAR(36)   NOT NULL,
  status             ENUM('locked', 'open', 'grading_pending', 'completed') DEFAULT 'locked',
  score              DECIMAL(5, 2) NULL,
  original_score     DECIMAL(5, 2) NULL,
  score_adjustment   DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  adjustment_reason  VARCHAR(255) NULL,
  adjusted_by        VARCHAR(36) NULL,
  adjusted_at        DATETIME NULL,
  attempts_count     INT           NOT NULL DEFAULT 0,
  attempt_version    INT           NOT NULL DEFAULT 1,
  last_attempt_start DATETIME      NULL,
  individual_extension_until DATETIME NULL,
  last_submission_id VARCHAR(36) NULL,
  last_submission_result LONGTEXT NULL,
  grading_pending    BOOLEAN       NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_session (user_id, session_id),
  INDEX idx_progress_session_item (session_id, module_item_id),
  UNIQUE KEY uq_progress (user_id, session_id, module_item_id),
  CONSTRAINT fk_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_item
    FOREIGN KEY (module_item_id) REFERENCES module_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_adjusted_by
    FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Immutable per-attempt score summaries. user_progress remains the fast current
-- state, while this table is the source of truth for the highest-score policy.
CREATE TABLE exam_attempt_results (
  id                VARCHAR(36) PRIMARY KEY,
  root_session_id   VARCHAR(36) NOT NULL,
  session_id        VARCHAR(36) NOT NULL,
  user_id           VARCHAR(36) NOT NULL,
  module_item_id    VARCHAR(36) NOT NULL,
  exam_id           VARCHAR(36) NOT NULL,
  source_exam_id    VARCHAR(36) NOT NULL,
  attempt_number    INT NOT NULL,
  original_score    DECIMAL(5,2) NULL,
  score_adjustment  DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  final_score       DECIMAL(5,2) NULL,
  adjustment_reason VARCHAR(255) NULL,
  adjusted_by       VARCHAR(36) NULL,
  adjusted_at       DATETIME NULL,
  grading_pending   BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at      DATETIME NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_attempt_result (user_id, session_id, module_item_id, attempt_number),
  INDEX idx_exam_attempt_best (root_session_id, user_id, source_exam_id, grading_pending, final_score),
  INDEX idx_exam_attempt_session_item (session_id, module_item_id, user_id),
  CONSTRAINT fk_attempt_root_session FOREIGN KEY (root_session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_module_item FOREIGN KEY (module_item_id) REFERENCES module_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attempt_source_exam FOREIGN KEY (source_exam_id) REFERENCES exams(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attempt_adjusted_by FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- One active, versioned publication for a regular session and its remedial cycles.
CREATE TABLE session_result_publications (
  id              VARCHAR(36) PRIMARY KEY,
  session_id      VARCHAR(36) NOT NULL,
  root_session_id VARCHAR(36) NOT NULL,
  version         INT NOT NULL,
  status          ENUM('active','superseded') NOT NULL DEFAULT 'active',
  published_by    VARCHAR(36) NOT NULL,
  published_at    DATETIME NOT NULL,
  superseded_at   DATETIME NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_result_publication_version (root_session_id, version),
  INDEX idx_result_publication_active (root_session_id, status, published_at),
  CONSTRAINT fk_result_publication_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_publication_root FOREIGN KEY (root_session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_publication_user FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE session_result_publication_items (
  id                     VARCHAR(36) PRIMARY KEY,
  publication_id         VARCHAR(36) NOT NULL,
  user_id                VARCHAR(36) NOT NULL,
  source_exam_id         VARCHAR(36) NOT NULL,
  best_attempt_result_id VARCHAR(36) NULL,
  best_score             DECIMAL(5,2) NULL,
  passing_grade          DECIMAL(5,2) NOT NULL,
  outcome                ENUM('passed','remedial_required','remedial_exhausted','absent') NOT NULL,
  remedial_session_id    VARCHAR(36) NULL,
  attempts_used          INT NOT NULL DEFAULT 0,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_publication_user_exam (publication_id, user_id, source_exam_id),
  INDEX idx_publication_item_user (user_id, outcome),
  CONSTRAINT fk_publication_item_publication FOREIGN KEY (publication_id) REFERENCES session_result_publications(id) ON DELETE CASCADE,
  CONSTRAINT fk_publication_item_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_publication_item_exam FOREIGN KEY (source_exam_id) REFERENCES exams(id) ON DELETE RESTRICT,
  CONSTRAINT fk_publication_item_attempt FOREIGN KEY (best_attempt_result_id) REFERENCES exam_attempt_results(id) ON DELETE SET NULL,
  CONSTRAINT fk_publication_item_remedial_session FOREIGN KEY (remedial_session_id) REFERENCES sessions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- In a remedial module, only the failed exam items are assigned to each participant.
CREATE TABLE session_participant_exam_assignments (
  id             VARCHAR(36) PRIMARY KEY,
  session_id     VARCHAR(36) NOT NULL,
  user_id        VARCHAR(36) NOT NULL,
  module_item_id VARCHAR(36) NOT NULL,
  source_exam_id VARCHAR(36) NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_participant_exam_assignment (session_id, user_id, module_item_id),
  INDEX idx_participant_exam_assignment_user (session_id, user_id),
  CONSTRAINT fk_exam_assignment_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_assignment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_assignment_item FOREIGN KEY (module_item_id) REFERENCES module_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_assignment_source FOREIGN KEY (source_exam_id) REFERENCES exams(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 12. Exam Answers (Rekaman Jawaban Per Individu)
-- ─────────────────────────────────────────────
CREATE TABLE exam_answers (
  id              VARCHAR(36)  PRIMARY KEY,
  user_id         VARCHAR(36)  NOT NULL,
  session_id      VARCHAR(36)  NOT NULL,
  exam_id         VARCHAR(36)  NOT NULL,
  question_id     VARCHAR(36)  NOT NULL,
  selected_option TEXT         NOT NULL,
  question_snapshot LONGTEXT   NOT NULL,
  is_correct      BOOLEAN      NOT NULL DEFAULT FALSE,
  grading_status  ENUM('auto','pending','graded') NOT NULL DEFAULT 'auto',
  awarded_points  DECIMAL(8,2) NOT NULL DEFAULT 0,
  graded_by       VARCHAR(36)  NULL,
  graded_at       DATETIME     NULL,
  attempt_number  INT          NOT NULL DEFAULT 1,
  answered_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exam_answers_user_attempt (user_id, session_id, attempt_number),
  INDEX idx_exam_answers_review (session_id, user_id, exam_id, attempt_number),
  UNIQUE KEY uq_exam_answer_attempt (user_id, session_id, exam_id, question_id, attempt_number),
  CONSTRAINT fk_answers_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_question
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 13. Proctor Snapshots (Webcam Capture Periodik)
-- ─────────────────────────────────────────────
CREATE TABLE proctor_snapshots (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  session_id  VARCHAR(36) NOT NULL,
  image_url   VARCHAR(500) NOT NULL,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_proctor_session_user_time (session_id, user_id, captured_at),
  INDEX idx_proctor_captured_at (captured_at),
  CONSTRAINT fk_proctor_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_proctor_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Time-limited, participant-specific emergency access when a verified SEB
-- installation cannot complete the key handshake during a live exam.
CREATE TABLE seb_access_overrides (
  id          VARCHAR(36) PRIMARY KEY,
  session_id  VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  granted_by  VARCHAR(36) NOT NULL,
  reason      VARCHAR(500) NOT NULL,
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_seb_override_lookup (session_id, user_id, expires_at, revoked_at),
  INDEX idx_seb_override_granted_by (granted_by, created_at),
  CONSTRAINT fk_seb_override_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_seb_override_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_seb_override_admin
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 14. Notifications (Sistem Notifikasi)
-- ─────────────────────────────────────────────
CREATE TABLE notifications (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  type        ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  link_url    VARCHAR(500) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user_created (user_id, created_at),
  INDEX idx_notifications_user_read (user_id, is_read),
  CONSTRAINT fk_notification_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE email_outbox (
  id           VARCHAR(36) PRIMARY KEY,
  user_id      VARCHAR(36) NOT NULL,
  template     ENUM('credential') NOT NULL,
  status       ENUM('pending','processing','retry','sent','failed') NOT NULL DEFAULT 'pending',
  attempts     INT NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL,
  locked_at    DATETIME NULL,
  sent_at      DATETIME NULL,
  last_error   VARCHAR(500) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_outbox_dispatch (status, available_at, created_at),
  CONSTRAINT fk_email_outbox_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE session_reminder_runs (
  id              VARCHAR(36) PRIMARY KEY,
  session_id      VARCHAR(36) NOT NULL,
  triggered_by    VARCHAR(36) NOT NULL,
  cooldown_bucket BIGINT NOT NULL,
  status          ENUM('processing','completed','failed') NOT NULL DEFAULT 'processing',
  recipient_count INT NOT NULL DEFAULT 0,
  sent_count      INT NOT NULL DEFAULT 0,
  error_message   VARCHAR(500) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at    DATETIME NULL,
  INDEX idx_session_reminder_cooldown (session_id, created_at),
  UNIQUE KEY uq_session_reminder_bucket (session_id, cooldown_bucket),
  CONSTRAINT fk_session_reminder_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_reminder_user FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Draft answers are isolated from final, graded answers.
CREATE TABLE exam_answer_drafts (
  id              VARCHAR(36) PRIMARY KEY,
  user_id         VARCHAR(36) NOT NULL,
  session_id      VARCHAR(36) NOT NULL,
  exam_id         VARCHAR(36) NOT NULL,
  question_id     VARCHAR(36) NOT NULL,
  attempt_number  INT NOT NULL,
  selected_option TEXT NOT NULL,
  client_version  INT NOT NULL DEFAULT 1,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_answer_draft (user_id, session_id, exam_id, question_id, attempt_number),
  INDEX idx_exam_answer_drafts_attempt (user_id, session_id, exam_id, attempt_number),
  CONSTRAINT fk_answer_drafts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_answer_drafts_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_answer_drafts_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  CONSTRAINT fk_answer_drafts_question
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. Audit Logs (Aktivitas Kritis)
CREATE TABLE audit_logs (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NULL,
  action_type VARCHAR(50) NOT NULL,
  entity      VARCHAR(50) NOT NULL,
  entity_id   VARCHAR(36) NULL,
  details     JSON NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_user_created (user_id, created_at),
  INDEX idx_audit_entity (entity, entity_id)
) ENGINE=InnoDB;
