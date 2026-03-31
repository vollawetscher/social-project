'use client'

import { Link, usePathname } from '@/i18n/navigation'
import { LayoutTemplate, MessageSquareText, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'templates', href: '/marketplace', icon: LayoutTemplate },
  { key: 'community', href: '/marketplace/community', icon: MessageSquareText },
  { key: 'mine', href: '/marketplace/mine', icon: User },
] as const

export function MarketplaceNav() {
  const pathname = usePathname()
  const t = useTranslations('marketplace')

  const labels: Record<string, string> = {
    templates: t('nav.templates' as any, { defaultValue: 'Templates' }),
    community: t('community.title'),
    mine: t('nav.mine' as any, { defaultValue: 'My Contributions' }),
  }

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
            <span className="hidden sm:inline">{labels[key]}</span>
          </Link>
        )
      })}
    </nav>
  )
}
