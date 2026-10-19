-- BOOKR reading list: which student has read which of the three books issued in a week.
-- A row means "read"; no row means "not read yet".
CREATE TABLE bookr_reads (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week smallint NOT NULL CHECK (week BETWEEN 1 AND 40),
  book smallint NOT NULL CHECK (book BETWEEN 0 AND 2),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, week, book)
);
CREATE INDEX bookr_reads_student_idx ON bookr_reads(student_id);
