import React from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  variant?: 'full' | 'icon' | 'text'
}

export function Logo({ className, variant = 'full' }: LogoProps) {
  if (variant === 'icon') {
    // Just the N icon
    return (
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("w-8 h-8", className)}
      >
        {/* N Icon with gradient */}
        <defs>
          <linearGradient id="nGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#60A5FA', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#7C3AED', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path
          d="M30 180L30 60L90 60L150 140L150 60L180 60L180 180L120 180L60 100L60 180L30 180Z"
          fill="url(#nGradient)"
        />
        {/* Star accent */}
        <path
          d="M170 30L180 50L200 60L180 70L170 90L160 70L140 60L160 50Z"
          fill="#1E3A8A"
        />
      </svg>
    )
  }

  if (variant === 'text') {
    // Just the text
    return (
      <span className={cn("font-bold text-xl", className)}>
        notissima
      </span>
    )
  }

  // Full logo with icon and text
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8 shrink-0"
      >
        <defs>
          <linearGradient id="nGradientFull" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#60A5FA', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#7C3AED', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path
          d="M30 180L30 60L90 60L150 140L150 60L180 60L180 180L120 180L60 100L60 180L30 180Z"
          fill="url(#nGradientFull)"
        />
        <path
          d="M170 30L180 50L200 60L180 70L170 90L160 70L140 60L160 50Z"
          fill="#1E3A8A"
        />
      </svg>
      <span className="font-bold text-xl text-foreground">notissima</span>
    </div>
  )
}
