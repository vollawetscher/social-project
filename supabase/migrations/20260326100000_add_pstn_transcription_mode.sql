ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS pstn_transcription_mode text NOT NULL DEFAULT 'batch';

UPDATE public.calls
SET pstn_transcription_mode = 'batch'
WHERE pstn_transcription_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calls_pstn_transcription_mode_check'
  ) THEN
    ALTER TABLE public.calls
    ADD CONSTRAINT calls_pstn_transcription_mode_check
    CHECK (pstn_transcription_mode IN ('batch', 'live'));
  END IF;
END $$;

COMMENT ON COLUMN public.calls.pstn_transcription_mode IS
'PSTN transcription preference: batch (post-call) or live (in-call preview + post-call batch fallback).';
