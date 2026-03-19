/*
  # GDPR Retention for Projects (Cases)

  1. New columns on `cases`:
     - `archived_at`           — timestamp when the project was archived
     - `retention_days`        — how many days after the last meaningful event before deletion (per-project, inherits from profile default at archive time)
     - `last_output_at`        — updated by trigger whenever an output is created/deleted for a session in this project
     - `scheduled_deletion_at` — computed: GREATEST(archived_at, last_output_at) + retention_days

  2. New column on `profiles`:
     - `default_retention_days` — user's default; stamped onto each project at archive time (default 90)

  3. Triggers:
     - `outputs` INSERT/DELETE → update `cases.last_output_at`
     - `cases` INSERT/UPDATE → keep `scheduled_deletion_at` in sync

  4. Cleanup function (`process_gdpr_deletions`):
     Callable from a Supabase Edge Function cron (or pg_cron) — deletes
     archived cases whose scheduled_deletion_at has passed.
*/

-- ─── profiles ────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_retention_days integer NOT NULL DEFAULT 90;

COMMENT ON COLUMN profiles.default_retention_days IS
  'Default retention period (days) stamped onto projects when archived.';

-- ─── cases ───────────────────────────────────────────────────────────────────

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS archived_at          timestamptz,
  ADD COLUMN IF NOT EXISTS retention_days       integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS last_output_at       timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz;

COMMENT ON COLUMN cases.archived_at            IS 'Set when the project is archived; starts the retention clock.';
COMMENT ON COLUMN cases.retention_days         IS 'Days after last meaningful event before GDPR deletion. Stamped from profile.default_retention_days at archive time.';
COMMENT ON COLUMN cases.last_output_at         IS 'Timestamp of the most recently created output across all sessions in this project.';
COMMENT ON COLUMN cases.scheduled_deletion_at  IS 'GREATEST(archived_at, last_output_at) + retention_days. NULL when project is not archived.';

-- Index to make the daily cleanup query fast
CREATE INDEX IF NOT EXISTS cases_scheduled_deletion_idx
  ON cases (scheduled_deletion_at)
  WHERE status = 'archived' AND scheduled_deletion_at IS NOT NULL;

-- ─── Function: recompute scheduled_deletion_at ───────────────────────────────

CREATE OR REPLACE FUNCTION recompute_case_scheduled_deletion(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cases
  SET scheduled_deletion_at =
    CASE
      WHEN archived_at IS NOT NULL THEN
        GREATEST(archived_at, COALESCE(last_output_at, archived_at))
          + (retention_days || ' days')::interval
      ELSE NULL
    END
  WHERE id = p_case_id;
END;
$$;

-- ─── Trigger: keep scheduled_deletion_at in sync on cases UPDATE ─────────────

CREATE OR REPLACE FUNCTION cases_retention_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.archived_at IS DISTINCT FROM OLD.archived_at)
     OR (NEW.retention_days IS DISTINCT FROM OLD.retention_days)
     OR (NEW.last_output_at IS DISTINCT FROM OLD.last_output_at) THEN
    NEW.scheduled_deletion_at :=
      CASE
        WHEN NEW.archived_at IS NOT NULL THEN
          GREATEST(NEW.archived_at, COALESCE(NEW.last_output_at, NEW.archived_at))
            + (NEW.retention_days || ' days')::interval
        ELSE NULL
      END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_retention_sync_trigger ON cases;
CREATE TRIGGER cases_retention_sync_trigger
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION cases_retention_sync();

-- ─── Trigger: update cases.last_output_at when outputs are inserted/deleted ──

CREATE OR REPLACE FUNCTION sync_case_last_output_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_id uuid;
  v_max_output_at timestamptz;
BEGIN
  -- Determine the affected case
  IF TG_OP = 'INSERT' THEN
    SELECT case_id INTO v_case_id FROM sessions WHERE id = NEW.session_id;
  ELSE -- DELETE
    SELECT case_id INTO v_case_id FROM sessions WHERE id = OLD.session_id;
  END IF;

  IF v_case_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculate last_output_at across all sessions in this project
  SELECT MAX(o.created_at) INTO v_max_output_at
  FROM outputs o
  JOIN sessions s ON s.id = o.session_id
  WHERE s.case_id = v_case_id;

  UPDATE cases
  SET last_output_at = v_max_output_at
  WHERE id = v_case_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS outputs_sync_case_last_output_at ON outputs;
CREATE TRIGGER outputs_sync_case_last_output_at
  AFTER INSERT OR DELETE ON outputs
  FOR EACH ROW EXECUTE FUNCTION sync_case_last_output_at();

-- ─── Function: GDPR cleanup (called daily by Edge Function / pg_cron) ────────

CREATE OR REPLACE FUNCTION process_gdpr_deletions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Cascades to sessions → files, outputs via FK ON DELETE CASCADE
  WITH deleted AS (
    DELETE FROM cases
    WHERE status = 'archived'
      AND scheduled_deletion_at IS NOT NULL
      AND scheduled_deletion_at <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION process_gdpr_deletions() IS
  'Deletes archived projects whose retention period has expired. Safe to call repeatedly; returns count of deleted projects.';
