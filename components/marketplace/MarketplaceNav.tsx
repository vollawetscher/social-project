'use client'

import { Link, usePathname } from '@/i18n/navigation'
import { LayoutTemplate, MessageSquareText, Puzzle, Plug } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'community', href: '/marketplace', icon: MessageSquareText },
  { key: 'templates', href: '/marketplace/templates', icon: LayoutTemplate },
  { key: 'modules', href: '/marketplace/modules', icon: Puzzle },
  { key: 'integrations', href: '/marketplace/integrations', icon: Plug },
] as const

export function MarketplaceNav() {
  const pathname = usePathname()
  const t = useTranslations('marketplace')

  function isActive(href: string) {
    if (href === '/marketplace') return pathname === '/marketplace'
    return pathname.startsWith(href)
  }

  return (
    <nav className="flex items-center gap-1 border-b border-border mb-6 -mt-1">
      {tabs.map(({ key, href, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t(`nav.${key}`)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
