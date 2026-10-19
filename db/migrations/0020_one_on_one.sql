-- One-on-one roster. A row in one_on_one_flags means the teacher ticked the student as needing a one-on-one (priority 2 = high).
CREATE TABLE one_on_one_flags (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  priority smallint NOT NULL DEFAULT 1 CHECK (priority IN (1, 2)),
  flagged_at timestamptz NOT NULL DEFAULT now()
);

-- Each planned or finished one-on-one: topic, details, how and when, and what came of it.
CREATE TABLE one_on_one_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutor(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic text NOT NULL CHECK (length(trim(topic)) > 0),
  details text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT 'other',
  format text NOT NULL DEFAULT 'face_to_face',
  planned_date date,
  planned_time text,
  duration_min smallint NOT NULL DEFAULT 15 CHECK (duration_min BETWEEN 5 AND 120),
  goal text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  outcome text NOT NULL DEFAULT '',
  follow_up boolean NOT NULL DEFAULT false,
  follow_up_date date,
  parent_informed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX one_on_one_sessions_student_idx ON one_on_one_sessions(student_id, created_at DESC);
CREATE INDEX one_on_one_sessions_tutor_idx ON one_on_one_sessions(tutor_id, completed, planned_date);
