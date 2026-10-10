-- Unit plans: typed in or read from one or more pictures. Only the text is stored.
CREATE TABLE unit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutor(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  grade smallint CHECK (grade BETWEEN 1 AND 4),
  theme text,
  start_date date,
  end_date date,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','photo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
CREATE INDEX unit_plans_tutor_idx ON unit_plans(tutor_id, start_date DESC NULLS LAST, created_at DESC);
