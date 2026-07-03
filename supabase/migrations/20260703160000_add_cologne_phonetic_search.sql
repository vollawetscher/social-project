-- Kölner Phonetik (Cologne phonetics) in Postgres so the assistant can find
-- proper nouns in transcripts despite STT/spelling variants (German-tuned:
-- G/K -> 4, F/V/W/PH -> 3). Mirrors agent/config_loader.py:cologne_phonetic.

CREATE OR REPLACE FUNCTION public.cologne_phonetic(word text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  w text;
  n int;
  i int;
  ch text;
  prevc text;
  nextc text;
  code text;
  s text := '';
  result text := '';
  prev_out text := '';
  c text;
BEGIN
  IF word IS NULL THEN RETURN ''; END IF;
  w := lower(word);
  w := replace(replace(replace(replace(w, 'ä','a'), 'ö','o'), 'ü','u'), 'ß','ss');
  w := regexp_replace(w, '[^a-z]', '', 'g');
  n := length(w);
  IF n = 0 THEN RETURN ''; END IF;

  FOR i IN 1..n LOOP
    ch := substr(w, i, 1);
    prevc := CASE WHEN i > 1 THEN substr(w, i-1, 1) ELSE '' END;
    nextc := CASE WHEN i < n THEN substr(w, i+1, 1) ELSE '' END;
    code := NULL;

    IF ch IN ('a','e','i','j','o','u','y') THEN code := '0';
    ELSIF ch = 'h' THEN code := NULL;
    ELSIF ch = 'b' THEN code := '1';
    ELSIF ch = 'p' THEN code := CASE WHEN nextc = 'h' THEN '3' ELSE '1' END;
    ELSIF ch IN ('d','t') THEN code := CASE WHEN nextc IN ('c','s','z') THEN '8' ELSE '2' END;
    ELSIF ch IN ('f','v','w') THEN code := '3';
    ELSIF ch IN ('g','k','q') THEN code := '4';
    ELSIF ch = 'c' THEN
      IF i = 1 THEN
        code := CASE WHEN nextc IN ('a','h','k','l','o','q','r','u','x') THEN '4' ELSE '8' END;
      ELSIF prevc IN ('s','z') THEN code := '8';
      ELSE
        code := CASE WHEN nextc IN ('a','h','k','o','q','u','x') THEN '4' ELSE '8' END;
      END IF;
    ELSIF ch = 'x' THEN code := CASE WHEN prevc IN ('c','k','q') THEN '8' ELSE '48' END;
    ELSIF ch = 'l' THEN code := '5';
    ELSIF ch IN ('m','n') THEN code := '6';
    ELSIF ch = 'r' THEN code := '7';
    ELSIF ch IN ('s','z') THEN code := '8';
    END IF;

    IF code IS NOT NULL THEN s := s || code; END IF;
  END LOOP;

  -- Collapse consecutive duplicate digits.
  FOR i IN 1..length(s) LOOP
    c := substr(s, i, 1);
    IF c <> prev_out THEN
      result := result || c;
      prev_out := c;
    END IF;
  END LOOP;

  -- Drop all '0' except a leading one.
  IF length(result) > 0 THEN
    result := substr(result, 1, 1) || replace(substr(result, 2), '0', '');
  END IF;

  RETURN result;
END;
$$;

-- Distinct Cologne codes for all words (len >= 2) in a text.
CREATE OR REPLACE FUNCTION public.cologne_codes(txt text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT code) FILTER (WHERE code <> ''), ARRAY[]::text[])
  FROM (
    SELECT public.cologne_phonetic(tok) AS code
    FROM regexp_split_to_table(COALESCE(txt, ''), '[^A-Za-zÀ-ÿ]+') AS tok
    WHERE length(tok) >= 2
  ) t;
$$;

-- GIN index over the phonetic codes of each transcript so && (overlap) lookups
-- are fast. Build may take a while on large transcript tables.
CREATE INDEX IF NOT EXISTS transcripts_cologne_gin
  ON public.transcripts
  USING gin (public.cologne_codes(coalesce(raw_text, redacted_text)));

-- Owner-scoped phonetic search: sessions whose transcript contains a word with
-- any of the given Cologne codes. Called by the agent via RPC.
CREATE OR REPLACE FUNCTION public.search_sessions_by_phonetic(
  p_owner uuid,
  p_codes text[],
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  internal_case_id text,
  speechmatics_summary text,
  purpose text,
  context_note text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT s.id, s.internal_case_id, s.speechmatics_summary, s.purpose, s.context_note, s.created_at
  FROM public.sessions s
  WHERE s.user_id = p_owner
    AND EXISTS (
      SELECT 1
      FROM public.transcripts t
      WHERE t.session_id = s.id
        AND public.cologne_codes(coalesce(t.raw_text, t.redacted_text)) && p_codes
    )
  ORDER BY s.created_at DESC
  LIMIT greatest(1, least(50, p_limit));
$$;

COMMENT ON FUNCTION public.cologne_phonetic(text) IS 'Kölner Phonetik code for a single German word.';
COMMENT ON FUNCTION public.cologne_codes(text) IS 'Distinct Kölner Phonetik codes for all words in a text (for phonetic transcript search).';
