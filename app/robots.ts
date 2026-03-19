import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://notissima.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/*/admin/',        // admin panels
          '/*/sessions/',     // private user data
          '/*/outputs/',      // private user data
          '/*/calls/',        // private
          '/*/profile/',      // private
          '/*/settings/',     // private
          '/*/templates/',    // private
          '/*/record/',       // private
          '/*/reset-password/',
          '/auth/',
          '/api/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
