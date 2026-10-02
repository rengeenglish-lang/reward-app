CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tutor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Istanbul',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tutor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tutor_sessions_expires_at_idx ON tutor_sessions(expires_at);

CREATE TABLE tutor_login_attempts (
  email text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

CREATE TABLE classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX classrooms_active_name_idx ON classrooms(archived_at, name);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  grade_label text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, classroom_id)
);
CREATE INDEX groups_classroom_active_name_idx ON groups(classroom_id, archived_at, name);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  avatar_key text NOT NULL CHECK (avatar_key IN ('fox','bear','panda','lion','frog','tiger','koala','unicorn','penguin','octopus')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, group_id)
);
CREATE INDEX students_group_active_name_idx ON students(group_id, archived_at, display_name);

CREATE TABLE behavior_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  group_id uuid NOT NULL,
  record_date date NOT NULL,
  criteria jsonb NOT NULL CHECK (
    jsonb_typeof(criteria) = 'object' AND
    criteria ?& ARRAY['homework_complete','class_participation','speaking_effort','project_complete','class_readiness','speaking_day_rules'] AND
    (criteria - ARRAY['homework_complete','class_participation','speaking_effort','project_complete','class_readiness','speaking_day_rules']) = '{}'::jsonb AND
    jsonb_typeof(criteria->'homework_complete') = 'boolean' AND
    jsonb_typeof(criteria->'class_participation') = 'boolean' AND
    jsonb_typeof(criteria->'speaking_effort') = 'boolean' AND
    jsonb_typeof(criteria->'project_complete') = 'boolean' AND
    jsonb_typeof(criteria->'class_readiness') = 'boolean' AND
    jsonb_typeof(criteria->'speaking_day_rules') = 'boolean'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, record_date),
  FOREIGN KEY (student_id, group_id) REFERENCES students(id, group_id) ON DELETE RESTRICT
);
CREATE INDEX behavior_records_group_date_idx ON behavior_records(group_id, record_date);
CREATE INDEX behavior_records_student_date_idx ON behavior_records(student_id, record_date DESC);

CREATE TABLE prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prizes_active_name_idx ON prizes(active, name);

CREATE TABLE reward_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  student_id uuid NOT NULL,
  group_id uuid NOT NULL,
  prize_id uuid NOT NULL REFERENCES prizes(id) ON DELETE RESTRICT,
  prize_name_snapshot text NOT NULL,
  drawn_at timestamptz NOT NULL DEFAULT now(),
  selection_mode text NOT NULL CHECK (selection_mode IN ('tutor_selected','group_random')),
  FOREIGN KEY (student_id, group_id) REFERENCES students(id, group_id) ON DELETE RESTRICT
);
CREATE INDEX reward_draws_student_time_idx ON reward_draws(student_id, drawn_at DESC);
CREATE INDEX reward_draws_group_time_idx ON reward_draws(group_id, drawn_at DESC);

INSERT INTO prizes(name,description) VALUES
  ('Choose the class read-aloud book','Pick a book for the class to enjoy together.'),
  ('Pick the warm-up game','Choose an inclusive classroom warm-up.'),
  ('Choose a classroom song','Select a school-appropriate class song.'),
  ('Be the line leader','Lead the class line for a transition.'),
  ('10 minutes of drawing time','Enjoy a short creative break.'),
  ('A colorful sticker or stamp','Choose a small classroom sticker or stamp.');
