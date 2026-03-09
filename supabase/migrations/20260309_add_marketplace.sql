-- =============================================================
-- Voice2Value Marketplace Migration for Notissima
-- Run this migration in Supabase SQL Editor or via CLI
-- =============================================================

-- 1. Marketplace Categories
CREATE TABLE IF NOT EXISTS marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON marketplace_categories FOR SELECT USING (true);

-- 2. Marketplace Templates
CREATE TABLE IF NOT EXISTS marketplace_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT DEFAULT '',
  template_config JSONB DEFAULT '{}',
  category_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  download_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE marketplace_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published templates are public" ON marketplace_templates FOR SELECT USING (is_published = true OR author_id = auth.uid());
CREATE POLICY "Users can insert own templates" ON marketplace_templates FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users can update own templates" ON marketplace_templates FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Users can delete own templates" ON marketplace_templates FOR DELETE USING (author_id = auth.uid());

CREATE INDEX idx_marketplace_templates_published ON marketplace_templates (is_published, download_count DESC);
CREATE INDEX idx_marketplace_templates_author ON marketplace_templates (author_id);
CREATE INDEX idx_marketplace_templates_category ON marketplace_templates (category_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_marketplace_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketplace_template_updated_at
  BEFORE UPDATE ON marketplace_templates
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_template_updated_at();

-- 3. Marketplace Ratings
CREATE TABLE IF NOT EXISTS marketplace_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (template_id, user_id)
);

ALTER TABLE marketplace_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ratings" ON marketplace_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert own ratings" ON marketplace_ratings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own ratings" ON marketplace_ratings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own ratings" ON marketplace_ratings FOR DELETE USING (user_id = auth.uid());

-- Auto-update avg_rating on marketplace_templates
CREATE OR REPLACE FUNCTION update_marketplace_template_avg_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_templates
  SET avg_rating = COALESCE(
    (SELECT AVG(rating)::NUMERIC(3,2) FROM marketplace_ratings WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)),
    0
  )
  WHERE id = COALESCE(NEW.template_id, OLD.template_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketplace_rating_avg
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_ratings
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_template_avg_rating();

-- 4. Marketplace Downloads (install tracking)
CREATE TABLE IF NOT EXISTS marketplace_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE marketplace_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own downloads" ON marketplace_downloads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own downloads" ON marketplace_downloads FOR INSERT WITH CHECK (user_id = auth.uid());

-- Auto-update download_count on marketplace_templates
CREATE OR REPLACE FUNCTION update_marketplace_template_download_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_templates
  SET download_count = (SELECT COUNT(*) FROM marketplace_downloads WHERE template_id = NEW.template_id)
  WHERE id = NEW.template_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketplace_download_count
  AFTER INSERT ON marketplace_downloads
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_template_download_count();

-- 5. Community Posts
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('article', 'question', 'tip')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  upvote_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_resolved BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published posts are public" ON community_posts FOR SELECT USING (is_published = true OR author_id = auth.uid());
CREATE POLICY "Users can insert own posts" ON community_posts FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users can update own posts" ON community_posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Users can delete own posts" ON community_posts FOR DELETE USING (author_id = auth.uid());

CREATE INDEX idx_community_posts_type ON community_posts (type);
CREATE INDEX idx_community_posts_created ON community_posts (created_at DESC);
CREATE INDEX idx_community_posts_upvotes ON community_posts (upvote_count DESC);

-- Auto-update updated_at
CREATE TRIGGER trg_community_post_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_template_updated_at();

-- Increment view count RPC
CREATE OR REPLACE FUNCTION increment_community_post_view(p_post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE community_posts SET view_count = view_count + 1 WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Community Comments (threaded)
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  is_accepted_answer BOOLEAN DEFAULT false,
  upvote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read comments" ON community_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert own comments" ON community_comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users can update own comments" ON community_comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON community_comments FOR DELETE USING (author_id = auth.uid());

CREATE INDEX idx_community_comments_post ON community_comments (post_id, created_at);

-- Auto-update comment_count on posts
CREATE OR REPLACE FUNCTION update_community_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_community_comment_count
  AFTER INSERT OR DELETE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_community_post_comment_count();

-- 7. Community Votes
CREATE TABLE IF NOT EXISTS community_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE (user_id, post_id),
  UNIQUE (user_id, comment_id)
);

ALTER TABLE community_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read votes" ON community_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert own votes" ON community_votes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own votes" ON community_votes FOR DELETE USING (user_id = auth.uid());

-- Auto-update upvote_count on posts
CREATE OR REPLACE FUNCTION update_community_post_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.post_id IS NOT NULL THEN
    UPDATE community_posts SET upvote_count = upvote_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.post_id IS NOT NULL THEN
    UPDATE community_posts SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.comment_id IS NOT NULL THEN
    UPDATE community_comments SET upvote_count = upvote_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' AND OLD.comment_id IS NOT NULL THEN
    UPDATE community_comments SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_community_vote_count
  AFTER INSERT OR DELETE ON community_votes
  FOR EACH ROW EXECUTE FUNCTION update_community_post_upvote_count();

-- 8. Prompt Safety (for template upload moderation)
CREATE TABLE IF NOT EXISTS prompt_check_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC(5,3) DEFAULT 0,
  level TEXT NOT NULL CHECK (level IN ('pass', 'warn', 'fail')),
  flags TEXT[] DEFAULT '{}',
  provider TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prompt_check_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own checks" ON prompt_check_log FOR SELECT USING (user_id = auth.uid());

CREATE INDEX idx_prompt_check_user ON prompt_check_log (user_id, created_at DESC);
CREATE INDEX idx_prompt_check_level ON prompt_check_log (level, created_at DESC);

CREATE TABLE IF NOT EXISTS user_safety_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  strike_count INTEGER DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  is_permanent BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_safety_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own strikes" ON user_safety_strikes FOR SELECT USING (user_id = auth.uid());

CREATE INDEX idx_safety_strikes_blocked ON user_safety_strikes (blocked_until) WHERE blocked_until IS NOT NULL;

-- Add marketplace-related fields to profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'marketplace_username') THEN
    ALTER TABLE profiles ADD COLUMN marketplace_username TEXT;
    ALTER TABLE profiles ADD COLUMN marketplace_bio TEXT;
    ALTER TABLE profiles ADD COLUMN marketplace_avatar_url TEXT;
  END IF;
END $$;
