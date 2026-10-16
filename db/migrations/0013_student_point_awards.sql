CREATE TABLE student_point_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  group_id uuid NOT NULL,
  criterion text NOT NULL CHECK (criterion IN (
    'homework_complete','class_participation','speaking_effort',
    'project_complete','class_readiness','speaking_day_rules'
  )),
  points integer NOT NULL CHECK (points > 0 AND points <= 1000),
  awarded_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_id, group_id) REFERENCES students(id, group_id) ON DELETE RESTRICT
);

CREATE INDEX student_point_awards_student_date_idx
  ON student_point_awards(student_id, awarded_on DESC);
CREATE INDEX student_point_awards_group_date_idx
  ON student_point_awards(group_id, awarded_on DESC);

-- Preserve historical points already earned through the daily checklist.
INSERT INTO student_point_awards(student_id, group_id, criterion, points, awarded_on, created_at)
SELECT br.student_id, br.group_id, earned.criterion, 1, br.record_date, br.updated_at
FROM behavior_records br
CROSS JOIN LATERAL (VALUES
  ('homework_complete'),
  ('class_participation'),
  ('speaking_effort'),
  ('project_complete'),
  ('class_readiness'),
  ('speaking_day_rules')
) AS earned(criterion)
WHERE (br.criteria ->> earned.criterion) = 'true';
