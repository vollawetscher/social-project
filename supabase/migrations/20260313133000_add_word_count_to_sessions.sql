ALTER TABLE sessions ADD COLUMN IF NOT EXISTS word_count INTEGER;

COMMENT ON COLUMN sessions.word_count IS 'Word count for text-only imports (paste, .txt/.srt/.vtt); null for audio sessions';
