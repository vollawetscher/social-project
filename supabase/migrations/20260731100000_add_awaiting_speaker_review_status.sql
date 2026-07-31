-- Add 'awaiting_speaker_review' to the sessions.status lifecycle.
--
-- This status gates diarized audio sessions between transcription and analysis:
-- when a transcript still carries acoustic speaker labels (S1, S2, …), the
-- session pauses here so the user can confirm the reconciled speaker mapping
-- (and their own role) before the expensive analysis/summary runs once.
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_status_check CHECK (
  status = ANY (ARRAY[
    'created'::text,
    'uploading'::text,
    'recording'::text,
    'transcribing'::text,
    'summarizing'::text,
    'awaiting_speaker_review'::text,
    'done'::text,
    'error'::text
  ])
);
