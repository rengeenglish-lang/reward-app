-- Every book a student has read earns double points (2). The award is linked to the reading tick, so unticking removes it.
ALTER TABLE student_point_awards DROP CONSTRAINT IF EXISTS student_point_awards_criterion_check;
ALTER TABLE student_point_awards ADD CONSTRAINT student_point_awards_criterion_check CHECK (criterion IN (
  'homework_complete','class_participation','speaking_effort',
  'project_complete','class_readiness','speaking_day_rules','book_return','book_read'
));
ALTER TABLE student_point_awards ADD COLUMN source_key text;
CREATE UNIQUE INDEX student_point_awards_source_idx ON student_point_awards(student_id, source_key) WHERE source_key IS NOT NULL;

-- Books already ticked as read: 2 points each, dated the day they were ticked.
INSERT INTO student_point_awards(student_id, group_id, criterion, points, awarded_on, source_key)
SELECT r.student_id, s.group_id, 'book_read', 2, r.read_at::date, 'bookr:' || r.week || ':' || r.book
FROM bookr_reads r JOIN students s ON s.id = r.student_id
ON CONFLICT DO NOTHING;

-- Extra books the teacher added: 2 points each, as one award per student.
INSERT INTO student_point_awards(student_id, group_id, criterion, points, awarded_on, source_key)
SELECT e.student_id, s.group_id, 'book_read', LEAST(e.extra * 2, 1000), e.updated_at::date, 'bookr-extra'
FROM bookr_extra e JOIN students s ON s.id = e.student_id
ON CONFLICT DO NOTHING;
