-- Add missing columns to files table for upload workflow
-- Note: size_bytes already exists, we just add the missing ones

-- Add original_filename column
ALTER TABLE files
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Add file_purpose column
ALTER TABLE files
ADD COLUMN IF NOT EXISTS file_purpose TEXT DEFAULT 'recording';

-- Add upload_status column
ALTER TABLE files
ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'pending';

-- Add comments for documentation
COMMENT ON COLUMN files.original_filename IS 'Original filename from user upload';
COMMENT ON COLUMN files.file_purpose IS 'Purpose of the file (recording, document, etc.)';
COMMENT ON COLUMN files.upload_status IS 'Status of the upload (pending, uploading, completed, failed)';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_files_upload_status ON files(upload_status);
CREATE INDEX IF NOT EXISTS idx_files_purpose ON files(file_purpose);
