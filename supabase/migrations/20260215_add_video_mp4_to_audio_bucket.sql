-- Allow video/mp4 in audio bucket (same container as audio/mp4; iOS/downloaded .mp4 often report this)
UPDATE storage.buckets
SET allowed_mime_types = array_append(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  'video/mp4'
)
WHERE id = 'rohbericht-audio'
  AND NOT ('video/mp4' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[])));
