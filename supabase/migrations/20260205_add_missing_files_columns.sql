-- Add missing columns to files table for upload workflow
-- Note: file_purpose already exists as ENUM, size_bytes exists
-- We only add what's truly missing

-- Add original_filename column if it doesn't exist
ALTER TABLE files
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Add upload_status column if it doesn't exist
ALTER TABLE files
ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'pending';

-- Add comments for documentation
COMMENT ON COLUMN files.original_filename IS 'Original filename from user upload';
COMMENT ON COLUMN files.upload_status IS 'Status of the upload (pending, uploading, completed, failed)';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_files_upload_status ON files(upload_status);
