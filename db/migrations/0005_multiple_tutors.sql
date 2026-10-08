-- Allow more than one tutor account.
-- Dropping the column also drops its UNIQUE and CHECK constraints, which limited the table to one row.
ALTER TABLE tutor DROP COLUMN IF EXISTS singleton;

-- Sessions now belong to a tutor. The column stays nullable so the previous release keeps working
-- until the new one is deployed; the new release ignores sessions without a tutor.
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS tutor_id uuid REFERENCES tutor(id) ON DELETE CASCADE;
UPDATE tutor_sessions SET tutor_id = (SELECT id FROM tutor ORDER BY created_at LIMIT 1) WHERE tutor_id IS NULL;
CREATE INDEX IF NOT EXISTS tutor_sessions_tutor_id_idx ON tutor_sessions(tutor_id);
