-- Add Speechmatics-generated summary to transcripts (per file) and sessions (merged)
-- Speechmatics returns a summary when summarization_config is enabled in the transcription request

-- Transcripts: one summary per transcription job (per audio file)
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS summary TEXT;

COMMENT ON COLUMN transcripts.summary IS 'Speechmatics-generated summary for this transcript (one per audio file)';

-- Sessions: aggregated summary for the whole session (concatenated when multi-file)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS speechmatics_summary TEXT;

COMMENT ON COLUMN sessions.speechmatics_summary IS 'Speechmatics-generated summary. Single-file: from transcript. Multi-file: concatenated from all file summaries.';
