import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth/AuthProvider';

// Temporarily using system fonts for faster, more reliable builds
// Google Fonts was causing Railway deployment timeouts
// Will re-enable Inter once deployment is stable

export const metadata: Metadata = {
  title: 'Notissima - Professional Meeting Documentation',
  description: 'AI-powered transcription and documentation for meetings, consultations, and conversations',
  manifest: '/manifest.json',
  themeColor: '#7C3AED',
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
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  openGraph: {
    title: 'Notissima - Professional Meeting Documentation',
    description: 'AI-powered transcription and documentation for meetings, consultations, and conversations',
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
    description: 'AI-powered transcription and documentation for meetings, consultations, and conversations',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
