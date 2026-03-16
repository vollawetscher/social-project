-- Ensure transcript JSON fields are consistently stored as arrays of segments.
-- Older defaults used '{}' which can break code paths expecting arrays.

ALTER TABLE transcripts
ALTER COLUMN raw_json SET DEFAULT '[]'::jsonb;

ALTER TABLE transcripts
ALTER COLUMN redacted_json SET DEFAULT '[]'::jsonb;

-- Backfill non-array rows to a safe array shape.
UPDATE transcripts
SET raw_json = '[]'::jsonb
WHERE raw_json IS NULL OR jsonb_typeof(raw_json) <> 'array';

UPDATE transcripts
SET redacted_json = raw_json
WHERE redacted_json IS NULL OR jsonb_typeof(redacted_json) <> 'array';
