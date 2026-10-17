CREATE TABLE annual_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutor(id) ON DELETE CASCADE,
  academic_year text NOT NULL CHECK (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  image_path text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 15728640),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX annual_programs_tutor_year_idx ON annual_programs(tutor_id, academic_year DESC, created_at DESC);
