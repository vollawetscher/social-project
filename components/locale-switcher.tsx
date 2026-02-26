'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { routing, Locale } from '@/i18n/routing'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface LocaleSwitcherProps {
  compact?: boolean
  className?: string
}

export function LocaleSwitcher({ compact = false, className }: LocaleSwitcherProps) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('localeSwitcher')

  function handleLocaleChange(newLocale: string) {
    router.replace(pathname, { locale: newLocale as Locale })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          className={cn('gap-1.5', className)}
        >
          <Globe className="h-4 w-4" />
          {!compact && (
            <span className="text-xs font-medium uppercase">{locale}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => handleLocaleChange(l)}
            className={cn(locale === l && 'bg-accent font-medium')}
          >
            {t(l)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
