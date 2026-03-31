'use client'

import { Plug, Building2, CalendarDays, MessageCircle, Code } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav'

const plannedIntegrations = [
  { key: 'crm', icon: Building2, color: 'text-indigo-500 bg-indigo-500/10' },
  { key: 'calendar', icon: CalendarDays, color: 'text-blue-500 bg-blue-500/10' },
  { key: 'slack', icon: MessageCircle, color: 'text-pink-500 bg-pink-500/10' },
  { key: 'api', icon: Code, color: 'text-cyan-500 bg-cyan-500/10' },
] as const

export default function IntegrationsPage() {
  const t = useTranslations('marketplace')

  return (
    <div className="space-y-6">
      <MarketplaceNav />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <Plug className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{t('integrations.title')}</h1>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
              {t('integrations.comingSoon')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{t('integrations.subtitle')}</p>
        </div>
      </div>

      <p className="text-muted-foreground max-w-2xl">
        {t('integrations.description')}
      </p>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('integrations.planned')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {plannedIntegrations.map(({ key, icon: Icon, color }) => (
            <Card key={key} className="border-border">
              <CardContent className="p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg mb-3 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-foreground mb-1">{t(`integrations.${key}`)}</h3>
                <p className="text-xs text-muted-foreground">{t(`integrations.${key}Desc`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
