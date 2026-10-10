-- Department activities timeline: dated activities typed in or read from a picture. Only the text is stored.
CREATE TABLE department_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutor(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','photo')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX department_activities_tutor_date_idx ON department_activities(tutor_id, activity_date);
