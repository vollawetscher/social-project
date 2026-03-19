import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://notissima.com'
const LOCALES = ['en', 'de', 'es'] as const

// Public pages that should be indexed, with their relative priority and change frequency
const PUBLIC_PAGES: Array<{
  path: string
  priority: number
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
}> = [
  { path: '',          priority: 1.0, changeFrequency: 'weekly'  },  // landing
  { path: '/signup',   priority: 0.9, changeFrequency: 'monthly' },
  { path: '/login',    priority: 0.7, changeFrequency: 'monthly' },
  { path: '/privacy',  priority: 0.4, changeFrequency: 'yearly'  },
  { path: '/terms',    priority: 0.4, changeFrequency: 'yearly'  },
  { path: '/imprint',  priority: 0.3, changeFrequency: 'yearly'  },
  { path: '/contact',  priority: 0.5, changeFrequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  for (const page of PUBLIC_PAGES) {
    // Build alternates map: { en: 'https://...', de: '...', es: '...' }
    const alternates: Record<string, string> = {}
    for (const locale of LOCALES) {
      alternates[locale] = `${BASE_URL}/${locale}${page.path}`
    }
    // x-default points to the English version
    alternates['x-default'] = `${BASE_URL}/en${page.path}`

    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages: alternates },
      })
    }
  }

  return entries
}
