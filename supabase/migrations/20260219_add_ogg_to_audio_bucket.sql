/*
  # Add OGG MIME types to audio storage bucket

  Firefox records audio as OGG (audio/ogg or application/ogg).
  Add both variants to the allowed_mime_types list.
*/

UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY['audio/ogg', 'application/ogg']::text[]
)
WHERE id = 'rohbericht-audio'
  AND NOT ('audio/ogg' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[])));
