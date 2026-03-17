'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import { Search, Download, User, SlidersHorizontal, Loader2, X, Globe, Share2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { MarketplaceTemplate, MarketplaceCategory, MarketplaceProfile } from '@/lib/types/marketplace'
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav'
import { StarRating } from '@/components/marketplace/StarRating'

const LANGUAGE_LABELS: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
}

const categoryColors: Record<string, string> = {
  psychology: 'bg-violet-500/20 text-violet-600 border-violet-500/30',
  business: 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30',
  legal: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  medical: 'bg-red-500/20 text-red-600 border-red-500/30',
  technical: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  education: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  it: 'bg-cyan-500/20 text-cyan-600 border-cyan-500/30',
  sales: 'bg-green-500/20 text-green-600 border-green-500/30',
  consulting: 'bg-teal-500/20 text-teal-600 border-teal-500/30',
  hr: 'bg-pink-500/20 text-pink-600 border-pink-500/30',
  meetings: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  support: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  general: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

type SortOption = 'popular' | 'recent' | 'rating'

export default function MarketplacePage() {
  const locale = useLocale()
  const [searchQuery, setSearchQuery] = useState('')
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([])
  const [categories, setCategories] = useState<MarketplaceCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const [languageFilter, setLanguageFilter] = useState<string | null>(locale)
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(true)
  const t = useTranslations('marketplace')
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const creatorParam = params.get('creator')
    if (creatorParam) {
      setSelectedCreator(creatorParam)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)

    const orderMap: Record<SortOption, string> = {
      popular: 'download_count',
      recent: 'created_at',
      rating: 'avg_rating',
    }

    let query = supabase
      .from('marketplace_templates')
      .select('*')
      .eq('is_published', true)
      .order(orderMap[sortBy], { ascending: false })

    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory)
    }

    if (selectedCreator) {
      query = query.eq('author_id', selectedCreator)
    }

    if (languageFilter) {
      query = query.or(
        `language.eq.${languageFilter},and(language.is.null,template_config->languages.cs.["${languageFilter}"])`
      )
    }

    if (searchQuery.trim()) {
      query = query.or(
        `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
      )
    }

    const { data: tplData } = await query

    if (!tplData || tplData.length === 0) {
      setTemplates([])
      setLoading(false)
      return
    }

    const authorIds = Array.from(new Set(tplData.map((t: any) => t.author_id as string)))
    const categoryIds = Array.from(new Set(tplData.map((t: any) => t.category_id as string).filter(Boolean)))

    const [profilesRes, categoriesRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, marketplace_username, marketplace_avatar_url, marketplace_bio').in('id', authorIds),
      categoryIds.length > 0
        ? supabase.from('marketplace_categories').select('*').in('id', categoryIds)
        : Promise.resolve({ data: [] }),
    ])

    const profileMap = new Map<string, MarketplaceProfile>(
      (profilesRes.data ?? []).map((p: any) => [p.id, p])
    )
    const categoryMap = new Map<string, MarketplaceCategory>(
      (categoriesRes.data ?? []).map((c: any) => [c.id, c])
    )

    const enriched = tplData.map((t: any) => ({
      ...t,
      author: profileMap.get(t.author_id),
      category: categoryMap.get(t.category_id),
    }))

    setTemplates(enriched)

    if (selectedCreator && enriched.length > 0 && enriched[0].author) {
      setCreatorName(enriched[0].author.display_name || enriched[0].author.marketplace_username || null)
    }

    setLoading(false)
  }, [searchQuery, selectedCategory, sortBy, selectedCreator, languageFilter, supabase])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    supabase
      .from('marketplace_categories')
      .select('*')
      .order('sort_order')
      .then(({ data }: { data: any }) => setCategories(data ?? []))
  }, [supabase])

  function handleCreatorClick(authorId: string, authorName: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSelectedCreator(authorId)
    setCreatorName(authorName)
    const params = new URLSearchParams(window.location.search)
    params.set('creator', authorId)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }

  function handleCopyCreatorLink() {
    navigator.clipboard.writeText(window.location.href)
    toast.success(t('explore.linkCopied'))
  }

  function clearCreator() {
    setSelectedCreator(null)
    setCreatorName(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('creator')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }

  const activeFilterCount = [
    selectedCategory,
    selectedCreator,
    languageFilter && languageFilter !== locale ? languageFilter : null,
  ].filter(Boolean).length

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6">
        <MarketplaceNav />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('explore.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('explore.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[160px] bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">{t('explore.sortOptions.popular')}</SelectItem>
                <SelectItem value="recent">{t('explore.sortOptions.recent')}</SelectItem>
                <SelectItem value="rating">{t('explore.sortOptions.rating')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              className="bg-transparent"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {t('explore.filter')}
              {activeFilterCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('explore.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        {showFilters && (
          <div className="space-y-3">
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(null)}
                >
                  {t('explore.all')}
                </Badge>
                {categories.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                    className={`cursor-pointer ${selectedCategory !== cat.id ? (categoryColors[cat.slug] ?? '') : ''}`}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  >
                    {t.has(`categories.${cat.slug}` as any) ? t(`categories.${cat.slug}` as any) : cat.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                <Badge
                  key={code}
                  variant={languageFilter === code ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setLanguageFilter(languageFilter === code ? null : code)}
                >
                  {label}
                </Badge>
              ))}
              <Badge
                variant={languageFilter === null ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setLanguageFilter(null)}
              >
                {t('explore.allLanguages')}
              </Badge>
            </div>

            {selectedCreator && (
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  {creatorName || selectedCreator.slice(0, 8)}
                  <Share2
                    className="h-3 w-3 cursor-pointer hover:text-primary transition-colors"
                    onClick={handleCopyCreatorLink}
                  />
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors"
                    onClick={clearCreator}
                  />
                </Badge>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>{t('explore.noResults')}</p>
            {languageFilter && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setLanguageFilter(null)}
              >
                {t('explore.showAllLanguages')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <Link key={tpl.id} href={`/marketplace/${tpl.id}`}>
                <Card className="border-border hover:border-primary/50 transition-colors h-full">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        {tpl.category && (
                          <Badge
                            variant="outline"
                            className={categoryColors[tpl.category.slug] || ''}
                          >
                            {tpl.category.name}
                          </Badge>
                        )}
                        {tpl.language && tpl.language !== locale && (
                          <Badge variant="outline" className="text-xs">
                            {LANGUAGE_LABELS[tpl.language] || tpl.language.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <StarRating value={Number(tpl.avg_rating)} readonly size="sm" />
                        <span>{Number(tpl.avg_rating).toFixed(1)}</span>
                      </div>
                    </div>

                    <h3 className="font-medium text-foreground mb-1">{tpl.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
                      {tpl.description}
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                        onClick={(e) => handleCreatorClick(tpl.author_id, tpl.author?.display_name || '', e)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreatorClick(tpl.author_id, tpl.author?.display_name || '', e as any) }}
                      >
                        <User className="h-3 w-3" />
                        {tpl.author?.display_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {tpl.download_count}
                      </span>
                    </div>

                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
