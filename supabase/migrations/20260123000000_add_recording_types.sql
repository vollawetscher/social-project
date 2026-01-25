/*
  # Add Recording Types Feature
  
  1. Changes
    - Add `file_purpose` column to files table with enum type
    - Add `file_id` column to transcripts table (link transcripts to specific files)
    - Keep session_id in transcripts for backward compatibility and reports
    - Add indexes for performance
  
  2. Recording Types
    - context: Pre-meeting preparation/background
    - meeting: Main conversation/consultation
    - dictation: Post-meeting professional notes
    - instruction: Directives/action items for client
    - addition: Supplementary information added later
*/

-- Create enum type for file purposes
CREATE TYPE file_purpose AS ENUM ('context', 'meeting', 'dictation', 'instruction', 'addition');

-- Add file_purpose column to files table
ALTER TABLE files
ADD COLUMN file_purpose file_purpose NOT NULL DEFAULT 'meeting';

-- Add file_id to transcripts table (nullable for backward compatibility)
ALTER TABLE transcripts
ADD COLUMN file_id uuid REFERENCES files(id) ON DELETE CASCADE;

-- Create index on transcripts.file_id for performance
CREATE INDEX IF NOT EXISTS transcripts_file_id_idx ON transcripts(file_id);

-- Add comment to explain the dual reference
COMMENT ON COLUMN transcripts.file_id IS 'Links transcript to specific audio file. New recordings use this. session_id maintained for backward compatibility and report generation.';
