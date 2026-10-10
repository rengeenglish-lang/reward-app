-- Teacher Issues: meeting and project notes, typed or read from a photo. Only the text is stored.
CREATE TABLE teacher_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutor(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('department','class','pyp','project')),
  grade smallint CHECK (grade BETWEEN 1 AND 4),
  theme text,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  body text NOT NULL CHECK (length(trim(body)) > 0),
  note_date date NOT NULL DEFAULT current_date,
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','photo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- class meetings and projects belong to a grade; projects also belong to a PYP theme
  CHECK ((kind IN ('class','project')) = (grade IS NOT NULL)),
  CHECK ((kind = 'project') = (theme IS NOT NULL))
);
CREATE INDEX teacher_notes_tutor_date_idx ON teacher_notes(tutor_id, note_date DESC, created_at DESC);
