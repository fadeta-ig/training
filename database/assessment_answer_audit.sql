-- Assessment answer integrity and draft persistence.
-- Run once after database/schema.sql has been applied.

-- Short-answer and essay questions intentionally have no option list.
ALTER TABLE questions
  MODIFY COLUMN options_json JSON NULL;

ALTER TABLE exam_answers
  ADD COLUMN IF NOT EXISTS exam_id VARCHAR(36) NULL AFTER question_id,
  ADD COLUMN IF NOT EXISTS question_snapshot LONGTEXT NULL AFTER selected_option,
  ADD COLUMN IF NOT EXISTS grading_status ENUM('auto', 'pending', 'graded') NOT NULL DEFAULT 'auto' AFTER is_correct,
  ADD COLUMN IF NOT EXISTS awarded_points DECIMAL(8, 2) NOT NULL DEFAULT 0 AFTER grading_status,
  ADD COLUMN IF NOT EXISTS graded_by VARCHAR(36) NULL AFTER awarded_points,
  ADD COLUMN IF NOT EXISTS graded_at DATETIME NULL AFTER graded_by;

UPDATE exam_answers ea
JOIN questions q ON q.id = ea.question_id
SET ea.exam_id = q.exam_id,
    ea.question_snapshot = COALESCE(
      ea.question_snapshot,
      JSON_OBJECT(
        'id', q.id,
        'exam_id', q.exam_id,
        'question_type', q.question_type,
        'question_text', q.question_text,
        'question_image', q.question_image,
        'options_json', q.options_json,
        'correct_option_index', q.correct_option_index,
        'correct_answer', q.correct_answer,
        'points', q.points
      )
    ),
    ea.grading_status = CASE
      WHEN q.question_type = 'essay' AND ea.is_correct = 0 THEN 'pending'
      WHEN q.question_type = 'essay' THEN 'graded'
      ELSE 'auto'
    END,
    ea.awarded_points = CASE WHEN ea.is_correct = 1 THEN q.points ELSE 0 END
WHERE ea.exam_id IS NULL OR ea.question_snapshot IS NULL;

ALTER TABLE exam_answers
  MODIFY COLUMN exam_id VARCHAR(36) NOT NULL,
  MODIFY COLUMN question_snapshot LONGTEXT NOT NULL,
  MODIFY COLUMN attempt_number INT NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_answer_attempt
  ON exam_answers (user_id, session_id, exam_id, question_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_exam_answers_review
  ON exam_answers (session_id, user_id, exam_id, attempt_number);

CREATE TABLE IF NOT EXISTS exam_answer_drafts (
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
