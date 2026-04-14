import { MetadataRoute } from 'next'

// Block all crawlers while legal pages (privacy, terms, imprint) are not finalized.
// To go live with SEO: restore the allow/disallow list and re-add the sitemap reference.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
  }
}
