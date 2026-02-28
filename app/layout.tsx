import './globals.css'
import type { Metadata, Viewport } from 'next'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://notissima.com'

export const metadata: Metadata = {
  title: 'Notissima - Professional Meeting Documentation',
  description:
    'AI-powered transcription and documentation for meetings, consultations, and conversations',
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
    title: 'Notissima - Professional Meeting Documentation',
    description:
      'AI-powered transcription and documentation for meetings, consultations, and conversations',
    url: 'https://notissima.com',
    siteName: 'Notissima',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Notissima',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notissima - Professional Meeting Documentation',
    description:
      'AI-powered transcription and documentation for meetings, consultations, and conversations',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#7C3AED',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
