-- Teacher's own academic and behaviour analysis entries per student (typed or read from a photo; only text is kept).
CREATE TABLE student_analysis_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutor(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN ('academic','behaviour')),
  body text NOT NULL CHECK (length(trim(body)) > 0),
  entry_date date NOT NULL DEFAULT current_date,
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','photo')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_analysis_student_idx ON student_analysis_entries(student_id, entry_date DESC, created_at DESC);
