import './globals.css'
import type { Metadata, Viewport } from 'next'

const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notissima.com'

export const metadata: Metadata = {
  title: {
    default: 'Notissima — Turn Every Call and Meeting into Structured Intelligence',
    template: '%s — Notissima',
  },
  description:
    'Notissima automatically converts your calls, meetings, and recordings into decision logs, action plans, and risk summaries. Built for professionals who depend on accurate communication records.',
  metadataBase: new URL(appUrl),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Notissima',
  },
  openGraph: {
    title: 'Notissima — Turn Every Call and Meeting into Structured Intelligence',
    description:
      'Notissima automatically converts your calls, meetings, and recordings into decision logs, action plans, and risk summaries. Built for professionals who depend on accurate communication records.',
    url: appUrl,
    siteName: 'Notissima',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Notissima — Communication intelligence for professionals',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notissima — Turn Every Call and Meeting into Structured Intelligence',
    description:
      'Notissima automatically converts your calls, meetings, and recordings into decision logs, action plans, and risk summaries.',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // userScalable intentionally omitted — pinch-to-zoom must remain enabled
  // for accessibility and to avoid Google mobile usability penalties
  themeColor: '#7C3AED',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
