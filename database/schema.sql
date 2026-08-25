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
  phone_number              VARCHAR(20) NULL,
  address                   TEXT NULL,
  date_of_birth             DATE NULL,
  gender                    ENUM('L', 'P') NULL,
  institution               VARCHAR(150) NULL,
  institution_code          VARCHAR(20) NULL,
  target_certification_id   VARCHAR(36) NULL,
  target_certification_name VARCHAR(255) NULL,
  target_period             VARCHAR(50) NULL,
  batch                     INT NOT NULL DEFAULT 1,
  registration_date         DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_participant_nip (nip),
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
-- 5. Questions (Butir Soal — Multi-type)
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
  INDEX idx_questions_exam (exam_id),
  INDEX idx_questions_exam_order (exam_id, sequence_order),
  CONSTRAINT fk_questions_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 6. Modules (Learning Path / Kerangka Urutan)
-- ─────────────────────────────────────────────
CREATE TABLE modules (
  id          VARCHAR(36)  PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 7. Module Items (Urutan item di dalam modul)
-- ─────────────────────────────────────────────
CREATE TABLE module_items (
  id             VARCHAR(36) PRIMARY KEY,
  module_id      VARCHAR(36) NOT NULL,
  item_type      ENUM('training', 'exam') NOT NULL,
  item_id        VARCHAR(36) NOT NULL,
  sequence_order INT         NOT NULL,
  INDEX idx_module_items_module_order (module_id, sequence_order),
  INDEX idx_module_items_lookup (module_id, item_type, item_id),
  CONSTRAINT fk_module_items_module
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 8. Sessions (Jadwal Pelaksanaan Sesi)
-- ─────────────────────────────────────────────
CREATE TABLE sessions (
  id             VARCHAR(36)  PRIMARY KEY,
  module_id      VARCHAR(36)  NOT NULL,
  title          VARCHAR(150) NOT NULL,
  start_time     DATETIME     NOT NULL,
  end_time       DATETIME     NOT NULL,
  require_seb    BOOLEAN      DEFAULT FALSE,
  show_score     BOOLEAN      DEFAULT TRUE,
  enable_proctoring BOOLEAN   NOT NULL DEFAULT TRUE,
  seb_config_key VARCHAR(255) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_module_time (module_id, start_time, end_time),
  CONSTRAINT fk_sessions_module
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 9. Session Participants (Peserta Terdaftar)
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
  CONSTRAINT fk_sp_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 10. User Progress (Tracking Keterbukaan & Nilai)
-- ─────────────────────────────────────────────
CREATE TABLE user_progress (
  id                 VARCHAR(36)   PRIMARY KEY,
  user_id            VARCHAR(36)   NOT NULL,
  session_id         VARCHAR(36)   NOT NULL,
  module_item_id     VARCHAR(36)   NOT NULL,
  status             ENUM('locked', 'open', 'completed') DEFAULT 'locked',
  score              DECIMAL(5, 2) NULL,
  attempts_count     INT           NOT NULL DEFAULT 0,
  attempt_version    INT           NOT NULL DEFAULT 1,
  last_attempt_start DATETIME      NULL,
  individual_extension_until DATETIME NULL,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_session (user_id, session_id),
  INDEX idx_progress_session_item (session_id, module_item_id),
  UNIQUE KEY uq_progress (user_id, session_id, module_item_id),
  CONSTRAINT fk_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_item
    FOREIGN KEY (module_item_id) REFERENCES module_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 11. Exam Answers (Rekaman Jawaban Per Individu)
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
-- 12. Proctor Snapshots (Webcam Capture Periodik)
-- ─────────────────────────────────────────────
CREATE TABLE proctor_snapshots (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  session_id  VARCHAR(36) NOT NULL,
  image_url   VARCHAR(500) NOT NULL,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_proctor_session_user_time (session_id, user_id, captured_at),
  CONSTRAINT fk_proctor_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_proctor_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 13. Notifications (Sistem Notifikasi)
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

-- Draft answers are isolated from final, graded answers.
CREATE TABLE exam_answer_drafts (
  id              VARCHAR(36) PRIMARY KEY,
  user_id         VARCHAR(36) NOT NULL,
  session_id      VARCHAR(36) NOT NULL,
  exam_id         VARCHAR(36) NOT NULL,
  question_id     VARCHAR(36) NOT NULL,
  attempt_number  INT NOT NULL,
  selected_option TEXT NOT NULL,
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

-- 14. Audit Logs (Aktivitas Kritis)
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
