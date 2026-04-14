import { MetadataRoute } from 'next'

// Empty sitemap while legal pages are not finalized.
// To go live with SEO: restore the PUBLIC_PAGES array and generation logic.
//
// const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://notissima.com'
// const LOCALES = ['en', 'de', 'es'] as const
// const PUBLIC_PAGES = [
//   { path: '',          priority: 1.0, changeFrequency: 'weekly'  },
//   { path: '/signup',   priority: 0.9, changeFrequency: 'monthly' },
//   { path: '/login',    priority: 0.7, changeFrequency: 'monthly' },
//   { path: '/privacy',  priority: 0.4, changeFrequency: 'yearly'  },
//   { path: '/terms',    priority: 0.4, changeFrequency: 'yearly'  },
//   { path: '/imprint',  priority: 0.3, changeFrequency: 'yearly'  },
//   { path: '/contact',  priority: 0.5, changeFrequency: 'monthly' },
// ]

export default function sitemap(): MetadataRoute.Sitemap {
  return []
}
