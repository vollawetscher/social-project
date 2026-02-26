-- Increase audio bucket limit from 200MB to 500MB for longer recordings
UPDATE storage.buckets
SET file_size_limit = 524288000  -- 500 MB
WHERE id = 'rohbericht-audio';
