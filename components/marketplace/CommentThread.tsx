'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CheckCircle2, MessageSquare, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { VoteButton } from './VoteButton'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { timeAgo } from '@/lib/utils/time-ago'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CommunityComment, PostType } from '@/lib/types/marketplace'

interface CommentThreadProps {
  comments: CommunityComment[]
  postId: string
  postType: PostType
  postAuthorId: string
  onCommentAdded: () => void
}

export function CommentThread({ comments, postId, postType, postAuthorId, onCommentAdded }: CommentThreadProps) {
  const t = useTranslations('marketplace')
  const { user } = useAuth()
  const supabase = createClient()
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isQuestion = postType === 'question'
  const topLevel = comments.filter((c) => !c.parent_id)

  function getReplies(parentId: string) {
    return comments.filter((c) => c.parent_id === parentId)
  }

  async function handleSubmit(parentId: string | null) {
    const content = parentId ? replyContent : newComment
    if (!content.trim() || !user) return

    setSubmitting(true)
    const { error } = await supabase.from('community_comments').insert({
      post_id: postId,
      author_id: user.id,
      content: content.trim(),
      parent_id: parentId,
    })

    setSubmitting(false)

    if (error) {
      toast.error(error.message)
    } else {
      if (parentId) {
        setReplyContent('')
        setReplyTo(null)
      } else {
        setNewComment('')
      }
      onCommentAdded()
    }
  }

  async function handleAcceptAnswer(commentId: string) {
    if (!user || user.id !== postAuthorId) return
    const { error } = await supabase
      .from('community_comments')
      .update({ is_accepted_answer: true })
      .eq('id', commentId)

    if (error) {
      toast.error(error.message)
    } else {
      await supabase
        .from('community_posts')
        .update({ is_resolved: true })
        .eq('id', postId)
      onCommentAdded()
    }
  }

  function renderComment(comment: CommunityComment, depth = 0) {
    const ago = timeAgo(comment.created_at)
    const replies = getReplies(comment.id)
    const canAccept = isQuestion && !comment.parent_id && user?.id === postAuthorId && !comment.is_accepted_answer

    return (
      <div key={comment.id} className={cn('group', depth > 0 && 'ml-6 pl-4 border-l-2 border-border')}>
        <div className={cn(
          'rounded-lg p-3',
          comment.is_accepted_answer && 'bg-green-500/5 border border-green-500/20'
        )}>
          {comment.is_accepted_answer && (
            <Badge variant="outline" className="bg-green-500/20 text-green-600 border-green-500/30 gap-1 mb-2">
              <CheckCircle2 className="h-3 w-3" />
              {t('community.detail.acceptedAnswer')}
            </Badge>
          )}

          <div className="flex gap-3">
            <div className="flex-shrink-0 pt-1">
              <VoteButton count={comment.upvote_count} commentId={comment.id} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {comment.author?.display_name ?? comment.author?.marketplace_username ?? 'User'}
                </span>
                <span>{t(ago.key, { count: ago.count })}</span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {t('community.detail.reply')}
                  </Button>
                )}
                {canAccept && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-green-600"
                    onClick={() => handleAcceptAnswer(comment.id)}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t('community.detail.acceptAnswer')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {replyTo === comment.id && (
          <div className="ml-6 mt-2 pl-4 border-l-2 border-primary/30">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={t('community.detail.writeComment')}
              className="bg-secondary border-border min-h-[80px] text-sm"
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" disabled={!replyContent.trim() || submitting} onClick={() => handleSubmit(comment.id)}>
                {t('community.detail.submitComment')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setReplyTo(null); setReplyContent('') }}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map((r) => renderComment(r, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {topLevel.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          {isQuestion ? t('community.detail.noAnswers') : t('community.detail.noComments')}
        </p>
      )}

      <div className="space-y-3">
        {topLevel.map((c) => renderComment(c))}
      </div>

      {user ? (
        <div className="pt-4 border-t border-border">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={isQuestion ? t('community.detail.writeAnswer') : t('community.detail.writeComment')}
            className="bg-secondary border-border min-h-[100px]"
          />
          <div className="flex justify-end mt-2">
            <Button disabled={!newComment.trim() || submitting} onClick={() => handleSubmit(null)}>
              {submitting
                ? t('common.loading')
                : isQuestion
                  ? t('community.detail.submitAnswer')
                  : t('community.detail.submitComment')
              }
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4 border-t border-border">
          {isQuestion ? t('community.detail.loginToAnswer') : t('community.detail.loginToComment')}
        </p>
      )}
    </div>
  )
}
