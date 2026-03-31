'use client'

import { Puzzle, GraduationCap, Stethoscope, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav'

const plannedModules = [
  { key: 'coaching', icon: GraduationCap, color: 'text-amber-500 bg-amber-500/10' },
  { key: 'medicalIntake', icon: Stethoscope, color: 'text-red-500 bg-red-500/10' },
  { key: 'salesFollowup', icon: TrendingUp, color: 'text-green-500 bg-green-500/10' },
] as const

export default function ModulesPage() {
  const t = useTranslations('marketplace')

  return (
    <div className="space-y-6">
      <MarketplaceNav />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
          <Puzzle className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{t('modules.title')}</h1>
            <Badge variant="outline" className="text-violet-500 border-violet-500/30">
              {t('modules.comingSoon')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{t('modules.subtitle')}</p>
        </div>
      </div>

      <p className="text-muted-foreground max-w-2xl">
        {t('modules.description')}
      </p>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('modules.planned')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plannedModules.map(({ key, icon: Icon, color }) => (
            <Card key={key} className="border-border">
              <CardContent className="p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg mb-3 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-foreground mb-1">{t(`modules.${key}`)}</h3>
                <p className="text-xs text-muted-foreground">{t(`modules.${key}Desc`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
