-- Extra books a student has read beyond the BOOKR homework, typed in by the teacher.
-- They are added to the ticked books to decide who the best reader is.
CREATE TABLE bookr_extra (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  extra smallint NOT NULL CHECK (extra BETWEEN 0 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);
