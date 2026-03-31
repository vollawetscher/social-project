'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import { Search, Plus, Loader2, LogIn } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PostCard } from '@/components/marketplace/PostCard'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { CommunityPost, MarketplaceProfile } from '@/lib/types/marketplace'
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav'

export default function CommunityPage() {
  const t = useTranslations('marketplace')
  const { user } = useAuth()
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'article' | 'discussion'>('all')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('community_posts')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (activeTab === 'discussion') {
      query = query.in('type', ['question', 'tip', 'discussion'])
    } else if (activeTab !== 'all') {
      query = query.eq('type', activeTab)
    }

    if (searchQuery.trim()) {
      query = query.or(
        `title.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`
      )
    }

    const { data: postsData } = await query

    if (!postsData || postsData.length === 0) {
      setPosts([])
      setLoading(false)
      return
    }

    const authorIds = Array.from(new Set(postsData.map((p: any) => p.author_id as string)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, marketplace_username, marketplace_avatar_url, marketplace_bio')
      .in('id', authorIds)

    const profileMap = new Map<string, MarketplaceProfile>(
      (profiles ?? []).map((p: any) => [p.id, p])
    )

    setPosts(
      postsData.map((p: any) => ({
        ...p,
        author: profileMap.get(p.author_id),
      }))
    )
    setLoading(false)
  }, [activeTab, searchQuery, supabase])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return (
    <div className="space-y-6">
      <MarketplaceNav />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('community.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('community.subtitle')}</p>
        </div>
        {user ? (
          <Button asChild size="sm">
            <Link href="/marketplace/community/new">
              <Plus className="h-4 w-4 mr-2" />
              {t('community.newPost')}
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="bg-transparent">
            <Link href="/login">
              <LogIn className="h-4 w-4 mr-2" />
              {t('community.loginToPost')}
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'article' | 'discussion')}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">{t('community.tabs.all')}</TabsTrigger>
            <TabsTrigger value="discussion">{t('community.tabs.discussions')}</TabsTrigger>
            <TabsTrigger value="article">{t('community.tabs.articles')}</TabsTrigger>
          </TabsList>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('community.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
        </div>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{t('community.noResults')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
