-- Marketplace Lead-Capture: Creator can mark templates as "gated"
-- Users must consent to share their email before installing gated templates.
-- The email notification is sent in real-time; no extra columns on marketplace_downloads needed.

ALTER TABLE marketplace_templates
ADD COLUMN IF NOT EXISTS lead_capture_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN marketplace_templates.lead_capture_enabled
IS 'When true, users must consent to share their email with the creator before installing.';
