-- Increase audio bucket limit from 100MB to 200MB for longer recordings
UPDATE storage.buckets
SET file_size_limit = 209715200  -- 200 MB
WHERE id = 'rohbericht-audio';
