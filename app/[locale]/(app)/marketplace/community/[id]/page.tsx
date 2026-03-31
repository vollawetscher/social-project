'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Eye, MessageSquare, CheckCircle2, User, Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { VoteButton } from '@/components/marketplace/VoteButton'
import { CommentThread } from '@/components/marketplace/CommentThread'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils/time-ago'
import type { CommunityPost, CommunityComment, PostType, MarketplaceProfile } from '@/lib/types/marketplace'

const typeStyles: Record<PostType, string> = {
  article: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  discussion: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  question: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  tip: 'bg-green-500/20 text-green-600 border-green-500/30',
}

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const t = useTranslations('marketplace')
  const supabase = createClient()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPost = useCallback(async () => {
    if (!id) return

    const { data: postData } = await supabase
      .from('community_posts')
      .select('*')
      .eq('id', id)
      .single()

    if (!postData) {
      setPost(null)
      setLoading(false)
      return
    }

    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('id, display_name, marketplace_username, marketplace_avatar_url, marketplace_bio')
      .eq('id', postData.author_id)
      .single()

    setPost({ ...postData, author: authorProfile ?? undefined })

    supabase.rpc('increment_community_post_view', { p_post_id: id }).then()
  }, [id, supabase])

  const fetchComments = useCallback(async () => {
    if (!id) return

    const { data: commentsData } = await supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', id)
      .order('created_at', { ascending: true })

    if (!commentsData || commentsData.length === 0) {
      setComments([])
      return
    }

    const authorIds = Array.from(new Set(commentsData.map((c: any) => c.author_id as string)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, marketplace_username, marketplace_avatar_url, marketplace_bio')
      .in('id', authorIds)

    const profileMap = new Map<string, MarketplaceProfile>(
      (profiles ?? []).map((p: any) => [p.id, p])
    )

    setComments(
      commentsData.map((c: any) => ({
        ...c,
        author: profileMap.get(c.author_id),
      }))
    )
  }, [id, supabase])

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchPost(), fetchComments()])
      setLoading(false)
    }
    load()
  }, [fetchPost, fetchComments])

  function handleCommentAdded() {
    fetchComments()
    if (post) {
      setPost((prev) =>
        prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev
      )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">{t('community.detail.notFound')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/marketplace/community">{t('common.back')}</Link>
        </Button>
      </div>
    )
  }

  const ago = timeAgo(post.created_at)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href="/marketplace/community">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('common.back')}
        </Link>
      </Button>

      <div className="flex gap-4">
        <div className="flex-shrink-0 pt-2">
          <VoteButton count={post.upvote_count} postId={post.id} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="outline" className={typeStyles[post.type]}>
              {t(`community.postTypes.${post.type}`)}
            </Badge>
            {post.is_resolved && (
              <Badge variant="outline" className="bg-green-500/20 text-green-600 border-green-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t('community.card.resolved')}
              </Badge>
            )}
            {post.category && (
              <Badge variant="secondary" className="capitalize">{post.category}</Badge>
            )}
          </div>

          <h1 className="text-2xl font-semibold text-foreground">{post.title}</h1>

          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {post.author?.display_name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {t(ago.key, { count: ago.count })}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {post.view_count} {t('community.card.views')}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {post.comment_count}
            </span>
          </div>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <Separator />

      <Card className="border-border">
        <CardContent className="p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {post.is_resolved && post.type === 'question' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          {t('community.detail.resolved')}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {post.type === 'question'
            ? `${post.comment_count} ${t('community.card.answers')}`
            : `${post.comment_count} ${t('community.card.comments')}`
          }
        </h2>
        <CommentThread
          comments={comments}
          postId={post.id}
          postType={post.type}
          postAuthorId={post.author_id}
          onCommentAdded={handleCommentAdded}
        />
      </div>
    </div>
  )
}
