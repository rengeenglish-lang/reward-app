ALTER TABLE student_books
  ADD COLUMN lost boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT student_books_return_state_check CHECK (NOT (returned AND lost));

ALTER TABLE student_point_awards
  DROP CONSTRAINT IF EXISTS student_point_awards_criterion_check;

ALTER TABLE student_point_awards
  ADD CONSTRAINT student_point_awards_criterion_check CHECK (criterion IN (
    'homework_complete','class_participation','speaking_effort',
    'project_complete','class_readiness','speaking_day_rules','book_return'
  ));
