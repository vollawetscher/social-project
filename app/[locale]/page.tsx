import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'
import { routing, Locale } from '@/i18n/routing'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://notissima.com'

const PAGE_META: Record<Locale, { title: string; description: string }> = {
  en: {
    title: 'Notissima — Turn Every Call and Meeting into Structured Intelligence',
    description:
      'Notissima automatically converts your calls, meetings, and recordings into decision logs, action plans, and risk summaries. Start free — no credit card needed.',
  },
  de: {
    title: 'Notissima — Jedes Gespräch in strukturierte Erkenntnisse verwandeln',
    description:
      'Notissima wandelt Ihre Anrufe, Meetings und Aufzeichnungen automatisch in Entscheidungsprotokolle, Maßnahmenpläne und Risikoübersichten um. Kostenlos starten — keine Kreditkarte.',
  },
  es: {
    title: 'Notissima — Convierte cada llamada y reunión en inteligencia estructurada',
    description:
      'Notissima convierte automáticamente tus llamadas, reuniones y grabaciones en registros de decisiones, planes de acción y resúmenes de riesgos. Empieza gratis — sin tarjeta de crédito.',
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const safeLocale = routing.locales.includes(locale as Locale) ? (locale as Locale) : 'en'
  const m = PAGE_META[safeLocale]

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: `${BASE_URL}/${safeLocale}`,
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, `${BASE_URL}/${l}`]),
        ['x-default', `${BASE_URL}/en`],
      ]),
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `${BASE_URL}/${safeLocale}`,
    },
  }
}

export default function Home() {
  return <LandingPage />
}
