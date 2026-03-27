-- User notifications table for realtime push
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  action_href TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_id_read_at_idx ON public.notifications (user_id, read_at);
CREATE INDEX notifications_created_at_idx ON public.notifications (created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read and mark their own notifications as read
CREATE POLICY "users_select_own_notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role handles all inserts (backend-generated notifications)
-- No client INSERT policy — notifications are always server-generated

-- Enable realtime for instant push to clients
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
