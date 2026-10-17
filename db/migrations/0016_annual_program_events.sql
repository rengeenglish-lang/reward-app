CREATE TABLE annual_program_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES annual_programs(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 199),
  date_label text NOT NULL CHECK (length(trim(date_label)) > 0 AND length(date_label) <= 40),
  grade_level text NOT NULL CHECK (length(grade_level) <= 160),
  activity text NOT NULL CHECK (length(activity) <= 200),
  location text NOT NULL CHECK (length(location) <= 240),
  UNIQUE(program_id, position)
);

CREATE INDEX annual_program_events_order_idx ON annual_program_events(program_id, position);
