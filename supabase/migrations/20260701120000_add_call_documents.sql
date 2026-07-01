-- Documents attached to a call for the voice assistant to discuss.

CREATE TABLE IF NOT EXISTS public.call_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  extracted_text text,
  summary text,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_documents_call_idx
  ON public.call_documents(call_id, created_at DESC);

ALTER TABLE public.call_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own call documents" ON public.call_documents;
CREATE POLICY "Users can read own call documents"
  ON public.call_documents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own call documents" ON public.call_documents;
CREATE POLICY "Users can insert own call documents"
  ON public.call_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own call documents" ON public.call_documents;
CREATE POLICY "Users can delete own call documents"
  ON public.call_documents
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.call_documents IS 'Documents attached to a call for the in-call voice assistant to reference and discuss.';
COMMENT ON COLUMN public.call_documents.status IS 'processing | ready | error';
