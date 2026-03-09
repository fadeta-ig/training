-- =============================================================================
-- LMS Antigravity - Modular Training & Exam System
-- DDL Schema (MySQL 8.x compatible)
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
  id          VARCHAR(36)  PRIMARY KEY,
  role        ENUM('admin', 'trainer', 'trainee') NOT NULL DEFAULT 'trainee',
  name        VARCHAR(100) NOT NULL,
  username    VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 2. Master Data: Training Materials
-- ─────────────────────────────────────────────
CREATE TABLE trainings (
  id          VARCHAR(36)  PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  content_html TEXT        NOT NULL,
  video_url   VARCHAR(255) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 3. Master Data: Exams (Bank Soal)
-- ─────────────────────────────────────────────
CREATE TABLE exams (
  id               VARCHAR(36)    PRIMARY KEY,
  title            VARCHAR(150)   NOT NULL,
  duration_minutes INT            NOT NULL DEFAULT 60,
  passing_grade    DECIMAL(5, 2)  NOT NULL DEFAULT 70.00,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 4. Questions (Butir Soal)
-- ─────────────────────────────────────────────
CREATE TABLE questions (
  id             VARCHAR(36)  PRIMARY KEY,
  exam_id        VARCHAR(36)  NOT NULL,
  text           TEXT         NOT NULL,
  options_json   JSON         NOT NULL,
  correct_answer VARCHAR(50)  NOT NULL,
  CONSTRAINT fk_questions_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 5. Modules (Learning Path / Kerangka Urutan)
-- ─────────────────────────────────────────────
CREATE TABLE modules (
  id          VARCHAR(36)  PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 6. Module Items (Urutan item di dalam modul)
-- ─────────────────────────────────────────────
CREATE TABLE module_items (
  id             VARCHAR(36) PRIMARY KEY,
  module_id      VARCHAR(36) NOT NULL,
  item_type      ENUM('training', 'exam') NOT NULL,
  item_id        VARCHAR(36) NOT NULL,
  sequence_order INT         NOT NULL,
  CONSTRAINT fk_module_items_module
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 7. Sessions (Jadwal Pelaksanaan Sesi)
-- ─────────────────────────────────────────────
CREATE TABLE sessions (
  id             VARCHAR(36)  PRIMARY KEY,
  module_id      VARCHAR(36)  NOT NULL,
  title          VARCHAR(150) NOT NULL,
  start_time     DATETIME     NOT NULL,
  end_time       DATETIME     NOT NULL,
  require_seb    BOOLEAN      DEFAULT FALSE,
  seb_config_key VARCHAR(255) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_module
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 8. Session Participants (Peserta Terdaftar)
-- ─────────────────────────────────────────────
CREATE TABLE session_participants (
  id          VARCHAR(36) PRIMARY KEY,
  session_id  VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  UNIQUE KEY uq_session_user (session_id, user_id),
  CONSTRAINT fk_sp_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 9. User Progress (Tracking Keterbukaan & Nilai)
-- ─────────────────────────────────────────────
CREATE TABLE user_progress (
  id              VARCHAR(36)   PRIMARY KEY,
  user_id         VARCHAR(36)   NOT NULL,
  session_id      VARCHAR(36)   NOT NULL,
  module_item_id  VARCHAR(36)   NOT NULL,
  status          ENUM('locked', 'open', 'completed') DEFAULT 'locked',
  score           DECIMAL(5, 2) NULL,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progress (user_id, session_id, module_item_id),
  CONSTRAINT fk_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_item
    FOREIGN KEY (module_item_id) REFERENCES module_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 10. Exam Answers (Rekaman Jawaban Per Individu)
-- ─────────────────────────────────────────────
CREATE TABLE exam_answers (
  id              VARCHAR(36)  PRIMARY KEY,
  user_id         VARCHAR(36)  NOT NULL,
  session_id      VARCHAR(36)  NOT NULL,
  question_id     VARCHAR(36)  NOT NULL,
  selected_option VARCHAR(50)  NOT NULL,
  is_correct      BOOLEAN      NOT NULL DEFAULT FALSE,
  answered_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_answers_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_question
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 11. Proctor Snapshots (Webcam Capture Periodik)
-- ─────────────────────────────────────────────
CREATE TABLE proctor_snapshots (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  session_id  VARCHAR(36) NOT NULL,
  image_base64 LONGTEXT   NOT NULL,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proctor_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_proctor_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
