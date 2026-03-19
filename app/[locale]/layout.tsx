import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { routing, Locale } from '@/i18n/routing'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://notissima.com'

const META: Record<Locale, {
  title: string
  description: string
  ogLocale: string
}> = {
  en: {
    title: 'Notissima — Turn Every Call and Meeting into Structured Intelligence',
    description:
      'Notissima automatically converts your calls, meetings, and recordings into decision logs, action plans, and risk summaries. Built for professionals who depend on accurate communication records.',
    ogLocale: 'en_US',
  },
  de: {
    title: 'Notissima — Jedes Gespräch in strukturierte Erkenntnisse verwandeln',
    description:
      'Notissima wandelt Ihre Anrufe, Meetings und Aufzeichnungen automatisch in Entscheidungsprotokolle, Maßnahmenpläne und Risikoübersichten um. Für Fachleute, die auf genaue Kommunikationsaufzeichnungen angewiesen sind.',
    ogLocale: 'de_DE',
  },
  es: {
    title: 'Notissima — Convierte cada llamada y reunión en inteligencia estructurada',
    description:
      'Notissima convierte automáticamente tus llamadas, reuniones y grabaciones en registros de decisiones, planes de acción y resúmenes de riesgos. Para profesionales que dependen de registros de comunicación precisos.',
    ogLocale: 'es_ES',
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const safeLocale = routing.locales.includes(locale as Locale) ? (locale as Locale) : 'en'
  const m = META[safeLocale]

  // Build hreflang alternates for every locale variant of this layout root
  const languages: Record<string, string> = {}
  for (const l of routing.locales) {
    languages[l] = `${BASE_URL}/${l}`
  }
  languages['x-default'] = `${BASE_URL}/en`

  return {
    title: {
      default: m.title,
      template: `%s — Notissima`,
    },
    description: m.description,
    alternates: {
      canonical: `${BASE_URL}/${safeLocale}`,
      languages,
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `${BASE_URL}/${safeLocale}`,
      siteName: 'Notissima',
      locale: m.ogLocale,
      alternateLocale: routing.locales
        .filter((l) => l !== safeLocale)
        .map((l) => META[l].ogLocale),
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'Notissima — Communication intelligence for professionals',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: m.title,
      description: m.description,
      images: ['/og-image.png'],
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  )
}
