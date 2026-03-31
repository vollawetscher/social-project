'use client'

import { Link } from '@/i18n/navigation'
import { MessageSquare, Eye, CheckCircle2, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { VoteButton } from './VoteButton'
import { useTranslations } from 'next-intl'
import { timeAgo } from '@/lib/utils/time-ago'
import type { CommunityPost, PostType } from '@/lib/types/marketplace'

const typeStyles: Record<PostType, string> = {
  article: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  discussion: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  question: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  tip: 'bg-green-500/20 text-green-600 border-green-500/30',
}

interface PostCardProps {
  post: CommunityPost
}

export function PostCard({ post }: PostCardProps) {
  const t = useTranslations('marketplace')
  const ago = timeAgo(post.created_at)
  const excerpt = post.content.length > 150
    ? post.content.slice(0, 150).replace(/[#*_`>\-\[\]]/g, '') + '...'
    : post.content.replace(/[#*_`>\-\[\]]/g, '')

  return (
    <Card className="border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-0">
        <div className="flex gap-3 p-4">
          <div className="flex-shrink-0 pt-1">
            <VoteButton count={post.upvote_count} postId={post.id} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
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
                <span className="text-xs text-muted-foreground capitalize">{post.category}</span>
              )}
            </div>

            <Link href={`/marketplace/community/${post.id}`} className="group">
              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {post.title}
              </h3>
            </Link>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {excerpt}
            </p>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {post.author?.display_name ?? post.author?.marketplace_username}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {post.comment_count} {post.type === 'question' ? t('community.card.answers') : t('community.card.comments')}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.view_count}
              </span>
              <span>{t(ago.key, { count: ago.count })}</span>
            </div>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
