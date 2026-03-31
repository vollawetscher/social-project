'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import {
  LogIn, Loader2, LayoutTemplate, Store, Sparkles, Plus,
  MessageSquareText, Download, Star, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Template } from '@/lib/types-v0'
import type { MarketplaceTemplate, CommunityPost } from '@/lib/types/marketplace'
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav'
import { ShareToMarketplaceDialog } from '@/components/marketplace/ShareToMarketplaceDialog'

export default function MyContributionsPage() {
  const t = useTranslations('marketplace')
  const { user } = useAuth()
  const supabase = createClient()

  const [templates, setTemplates] = useState<Template[]>([])
  const [published, setPublished] = useState<MarketplaceTemplate[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [shareTemplate, setShareTemplate] = useState<Template | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    Promise.all([
      fetch('/api/templates').then((r) => r.json()),
      supabase
        .from('marketplace_templates')
        .select('*')
        .eq('author_id', user.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('community_posts')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false }),
    ]).then(([allTemplates, { data: pub }, { data: myPosts }]) => {
      setTemplates(
        (Array.isArray(allTemplates) ? allTemplates : []).filter(
          (tpl: any) => !tpl.marketplace_source_id
        )
      )
      setPublished(pub || [])
      setPosts(myPosts || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user, supabase])

  if (!user) {
    return (
      <div className="space-y-6">
        <MarketplaceNav />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <LogIn className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Sign in to see your contributions
          </h2>
          <Button asChild className="mt-4">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MarketplaceNav />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Contributions</h1>
          <p className="text-sm text-muted-foreground mt-1">Templates you&apos;ve shared and community posts you&apos;ve written</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Published Templates */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Store className="h-4 w-4" />
                Published Templates
                {published.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{published.length}</Badge>
                )}
              </h2>
              {templates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {/* show template picker */}}
                >
                  <Plus className="h-3 w-3" />
                  Publish Template
                </Button>
              )}
            </div>

            {published.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <LayoutTemplate className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    You haven&apos;t published any templates yet
                  </p>
                  {templates.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Select one of your {templates.length} template{templates.length > 1 ? 's' : ''} to share with the community
                    </p>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/templates/new/scratch">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Create a Template
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {published.map((tpl) => (
                  <Link
                    key={tpl.id}
                    href={`/marketplace/${tpl.id}`}
                    className="block p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Store className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tpl.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                        {tpl.download_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" /> {tpl.download_count}
                          </span>
                        )}
                        {tpl.avg_rating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {tpl.avg_rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Unpublished templates available to share */}
            {templates.length > 0 && published.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted-foreground font-medium">Ready to publish:</p>
                {templates
                  .filter((tpl) => !published.some((p) => p.title === tpl.name))
                  .slice(0, 5)
                  .map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setShareTemplate(tpl)}
                      className="w-full text-left p-2.5 rounded-lg border border-dashed border-border bg-background hover:bg-secondary/50 transition-colors flex items-center gap-3"
                    >
                      <LayoutTemplate className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{tpl.name}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">Publish</Badge>
                    </button>
                  ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Community Posts */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageSquareText className="h-4 w-4" />
                Community Posts
                {posts.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{posts.length}</Badge>
                )}
              </h2>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                <Link href="/marketplace/community/new">
                  <Plus className="h-3 w-3" />
                  New Post
                </Link>
              </Button>
            </div>

            {posts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <MessageSquareText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t written any community posts yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/marketplace/community/${post.id}`}
                    className="block p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquareText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px]">{post.type}</Badge>
                          {post.category && (
                            <span className="text-[10px] text-muted-foreground">{post.category}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ShareToMarketplaceDialog
        template={shareTemplate}
        open={!!shareTemplate}
        onOpenChange={(open) => !open && setShareTemplate(null)}
        onSuccess={() => {
          setShareTemplate(null)
          window.location.reload()
        }}
      />
    </div>
  )
}
