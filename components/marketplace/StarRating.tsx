'use client'

import { Star } from 'lucide-react'
import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0)
  const interactive = !readonly && !!onChange

  const handleClick = useCallback(
    (star: number) => {
      if (interactive) onChange(star)
    },
    [interactive, onChange]
  )

  const displayValue = hovered || value

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      onMouseLeave={() => interactive && setHovered(0)}
      role={interactive ? 'radiogroup' : undefined}
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(displayValue)
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            className={cn(
              'p-0 border-0 bg-transparent transition-colors',
              interactive && 'cursor-pointer hover:scale-110 transition-transform',
              !interactive && 'cursor-default'
            )}
            onClick={() => handleClick(star)}
            onMouseEnter={() => interactive && setHovered(star)}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            role={interactive ? 'radio' : undefined}
            aria-checked={interactive ? star === Math.round(value) : undefined}
            tabIndex={interactive ? 0 : -1}
          >
            <Star
              className={cn(
                sizes[size],
                filled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-transparent text-muted-foreground/40'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
