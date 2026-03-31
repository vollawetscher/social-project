'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import {
  LayoutTemplate, MessageSquareText, Puzzle, Plug,
  ArrowRight, Star, Download, Loader2, User,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import type { MarketplaceTemplate, MarketplaceProfile, MarketplaceCategory } from '@/lib/types/marketplace'
import type { CommunityPost } from '@/lib/types/marketplace'
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav'
import { StarRating } from '@/components/marketplace/StarRating'
import { useAuth } from '@/lib/auth/AuthProvider'

export default function MarketplaceLandingPage() {
  const t = useTranslations('marketplace')
  const locale = useLocale()
  const { user } = useAuth()
  const supabase = createClient()

  const [featuredTemplates, setFeaturedTemplates] = useState<MarketplaceTemplate[]>([])
  const [recentPosts, setRecentPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [tplRes, postsRes] = await Promise.all([
        supabase
          .from('marketplace_templates')
          .select('*')
          .eq('is_published', true)
          .or(`language.eq.${locale},and(language.is.null,template_config->languages.cs.["${locale}"])`)
          .order('download_count', { ascending: false })
          .limit(3),
        supabase
          .from('community_posts')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(3),
      ])

      const tplData = tplRes.data ?? []
      const postsData = postsRes.data ?? []

      if (tplData.length > 0) {
        const authorIds = Array.from(new Set(tplData.map((t: any) => t.author_id as string)))
        const categoryIds = Array.from(new Set(tplData.map((t: any) => t.category_id as string).filter(Boolean)))

        const [profilesRes, categoriesRes] = await Promise.all([
          supabase.from('profiles').select('id, display_name, marketplace_username').in('id', authorIds),
          categoryIds.length > 0
            ? supabase.from('marketplace_categories').select('*').in('id', categoryIds)
            : Promise.resolve({ data: [] }),
        ])

        const profileMap = new Map<string, MarketplaceProfile>(
          (profilesRes.data ?? []).map((p: any) => [p.id, p])
        )
        const categoryMap = new Map<string, MarketplaceCategory>(
          (categoriesRes.data ?? []).map((c: any) => [c.id, c])
        )

        setFeaturedTemplates(tplData.map((t: any) => ({
          ...t,
          author: profileMap.get(t.author_id),
          category: categoryMap.get(t.category_id),
        })))
      }

      if (postsData.length > 0) {
        const postAuthorIds = Array.from(new Set(postsData.map((p: any) => p.author_id as string)))
        const { data: postProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, marketplace_username, marketplace_avatar_url')
          .in('id', postAuthorIds)

        const postProfileMap = new Map(
          (postProfiles ?? []).map((p: any) => [p.id, p])
        )

        setRecentPosts(postsData.map((p: any) => ({
          ...p,
          author: postProfileMap.get(p.author_id),
        })))
      }

      setLoading(false)
    }

    load()
  }, [supabase, locale])

  if (loading) {
    return (
      <div className="space-y-6">
        <MarketplaceNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MarketplaceNav />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('community.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('community.subtitle')}</p>
        </div>
        {user && (
          <Link
            href="/marketplace/mine"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <User className="h-3.5 w-3.5" />
            {t('landing.myContributions')}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Featured Templates Card */}
        <Link href="/marketplace/templates">
          <Card className="border-border hover:border-primary/50 transition-colors h-full group">
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <LayoutTemplate className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{t('landing.featuredTemplates')}</h2>
                  <p className="text-xs text-muted-foreground">{t('landing.featuredTemplatesDesc')}</p>
                </div>
              </div>

              <div className="space-y-2.5 flex-1">
                {featuredTemplates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                    <LayoutTemplate className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tpl.title}</p>
                      {tpl.category && (
                        <p className="text-[10px] text-muted-foreground">{tpl.category.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StarRating value={Number(tpl.avg_rating)} readonly size="sm" />
                    </div>
                  </div>
                ))}
                {featuredTemplates.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No templates yet</p>
                )}
              </div>

              <div className="flex items-center gap-1 text-sm text-primary mt-4 group-hover:gap-2 transition-all">
                {t('landing.browseAll')}
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Recent Discussions Card */}
        <Link href="/marketplace/community">
          <Card className="border-border hover:border-primary/50 transition-colors h-full group">
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <MessageSquareText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{t('landing.recentDiscussions')}</h2>
                  <p className="text-xs text-muted-foreground">{t('landing.recentDiscussionsDesc')}</p>
                </div>
              </div>

              <div className="space-y-2.5 flex-1">
                {recentPosts.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0 text-xs font-medium text-muted-foreground">
                      {(post.author?.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {post.author?.display_name} · {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{post.type}</Badge>
                  </div>
                ))}
                {recentPosts.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No discussions yet</p>
                )}
              </div>

              <div className="flex items-center gap-1 text-sm text-blue-500 mt-4 group-hover:gap-2 transition-all">
                {t('landing.viewAll')}
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Modules Coming Soon Card */}
        <Link href="/marketplace/modules">
          <Card className="border-border hover:border-primary/50 transition-colors h-full group">
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                  <Puzzle className="h-5 w-5 text-violet-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-foreground">{t('landing.modulesTitle')}</h2>
                    <Badge variant="outline" className="text-[10px] text-violet-500 border-violet-500/30">
                      {t('landing.comingSoon')}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground flex-1">
                {t('landing.modulesDesc')}
              </p>

              <div className="flex items-center gap-1 text-sm text-violet-500 mt-4 group-hover:gap-2 transition-all">
                {t('modules.notify')}
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Integrations Coming Soon Card */}
        <Link href="/marketplace/integrations">
          <Card className="border-border hover:border-primary/50 transition-colors h-full group">
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Plug className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-foreground">{t('landing.integrationsTitle')}</h2>
                    <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                      {t('landing.comingSoon')}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground flex-1">
                {t('landing.integrationsDesc')}
              </p>

              <div className="flex items-center gap-1 text-sm text-emerald-500 mt-4 group-hover:gap-2 transition-all">
                {t('integrations.notify')}
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
