-- Call documents (for the voice assistant to discuss) are uploaded to the
-- rohbericht-audio bucket, which has an allowed_mime_types allowlist restricted
-- to audio/video. Add PDF and text types so document uploads aren't rejected
-- with "mime type application/pdf is not supported".
-- Only applies when an allowlist exists (NULL = all types already allowed).

UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT t)
  FROM unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[])
    || ARRAY['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown']
  ) AS t
)
WHERE id = 'rohbericht-audio'
  AND allowed_mime_types IS NOT NULL;
