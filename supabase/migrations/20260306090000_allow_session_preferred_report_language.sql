-- Allow using session's original language for report generation preference.
-- New profile option value: 'session'

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_preferred_report_language_check'
  ) THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT profiles_preferred_report_language_check;
  END IF;
END $$;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_preferred_report_language_check
CHECK (
  preferred_report_language IN (
    'session',
    'de', 'en', 'es', 'fr', 'it', 'pt', 'nl', 'pl',
    'cs', 'da', 'fi', 'no', 'sv', 'ru', 'ja', 'zh',
    'ko', 'ar', 'hi'
  )
);

COMMENT ON CONSTRAINT profiles_preferred_report_language_check ON public.profiles IS
'Allows fixed language codes plus "session" to use the original session language.';

