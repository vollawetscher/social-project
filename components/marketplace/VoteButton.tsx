'use client'

import { useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface VoteButtonProps {
  count: number
  postId?: string
  commentId?: string
  initialVoted?: boolean
}

export function VoteButton({ count, postId, commentId, initialVoted = false }: VoteButtonProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const [voted, setVoted] = useState(initialVoted)
  const [displayCount, setDisplayCount] = useState(count)
  const [loading, setLoading] = useState(false)

  async function handleVote() {
    if (!user) {
      toast.error('Please sign in to vote')
      return
    }
    if (loading) return

    setLoading(true)
    const wasVoted = voted

    setVoted(!wasVoted)
    setDisplayCount((c) => (wasVoted ? c - 1 : c + 1))

    try {
      if (wasVoted) {
        let query = supabase
          .from('community_votes')
          .delete()
          .eq('user_id', user.id)
        if (postId) query = query.eq('post_id', postId)
        if (commentId) query = query.eq('comment_id', commentId)
        await query
      } else {
        await supabase.from('community_votes').insert({
          user_id: user.id,
          post_id: postId ?? null,
          comment_id: commentId ?? null,
        })
      }
    } catch {
      setVoted(wasVoted)
      setDisplayCount(count)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleVote()
      }}
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-md px-2 py-1 transition-colors',
        voted
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      )}
    >
      <ChevronUp className={cn('h-5 w-5', voted && 'text-primary')} />
      <span className="text-xs font-semibold">{displayCount}</span>
    </button>
  )
}
