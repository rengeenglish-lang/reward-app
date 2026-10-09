-- Our Readers: which student has which book, whether it came back, and whether the after-reading project is done.
CREATE TABLE student_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  returned boolean NOT NULL DEFAULT false,
  returned_at timestamptz,
  project_done boolean NOT NULL DEFAULT false,
  project_done_at timestamptz,
  UNIQUE (student_id, book_id)
);
CREATE INDEX student_books_student_idx ON student_books(student_id);
