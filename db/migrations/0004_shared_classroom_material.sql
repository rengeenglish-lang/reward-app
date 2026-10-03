CREATE TABLE shared_classroom_material (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  pathname text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
