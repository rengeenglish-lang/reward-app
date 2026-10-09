-- Secret ballot: each student can nominate classmates who deserve a reward.
-- A student can never nominate themselves, and never the same classmate twice.
CREATE TABLE student_ballots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  nominee_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (voter_id, nominee_id),
  CHECK (voter_id <> nominee_id)
);
CREATE INDEX student_ballots_classroom_idx ON student_ballots(classroom_id);
