'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react'
import { LocaleSwitcher } from '@/components/locale-switcher'
import FindYourUseCaseWidget from '@/components/landing/FindYourUseCaseWidget'

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-base sm:text-lg font-medium text-slate-900 group-hover:text-slate-700 transition-colors">
          {q}
        </span>
        <ChevronDown
          className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-5 text-slate-600 leading-relaxed text-sm sm:text-base">
          {a}
        </p>
      )}
    </div>
  )
}

export default function LandingPage() {
  const t = useTranslations('landing')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const faqItems = t.raw('faq.items') as Array<{ q: string; a: string }>

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Notissima',
    url: 'https://notissima.com',
    logo: 'https://notissima.com/icon-192.png',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: 'https://notissima.com/en/contact',
    },
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Notissima',
    url: 'https://notissima.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://notissima.com/en/marketplace?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Notissima',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://notissima.com',
    description:
      'Communication intelligence platform that automatically converts calls, meetings, and recordings into decision logs, action plans, risk summaries, and professional documentation.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Free trial available — no credit card required',
    },
    featureList: [
      'Automatic meeting transcription in 50+ languages',
      'AI-generated decision logs and action plans',
      'Risk register and compliance documentation',
      'Built-in video and voice calling',
      'GDPR-compliant with EU data residency options',
      'PII detection and redaction',
      'Export to Markdown, PDF, DOCX, JSON',
      'Template library and custom templates',
    ],
    screenshot: 'https://notissima.com/og-image.png',
  }

  const videoSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: 'Notissima — Communication Intelligence Platform',
    description:
      'See how Notissima turns every call, meeting, and email into structured intelligence — decisions, risks, and actions your team can actually use.',
    thumbnailUrl: 'https://notissima.com/og-image.png',
    uploadDate: '2026-01-01',
    contentUrl: 'https://notissima.com/notissima-hero.mp4',
    embedUrl: 'https://notissima.com',
    publisher: {
      '@type': 'Organization',
      name: 'Notissima',
      logo: {
        '@type': 'ImageObject',
        url: 'https://notissima.com/icon-192.png',
      },
    },
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* Structured data for Google/AI search */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* ── Nav ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo variant="full" className="h-7" />

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#find-use-case"
              className={`text-sm transition-colors ${scrolled ? 'text-slate-900 hover:text-slate-600' : 'text-white/90 hover:text-white'}`}
            >
              {t('nav.discover')}
            </a>
            <a
              href="#faq"
              className={`text-sm transition-colors ${scrolled ? 'text-slate-900 hover:text-slate-600' : 'text-white/90 hover:text-white'}`}
            >
              {t('nav.qa')}
            </a>
            <Link
              href="/marketplace"
              className={`text-sm transition-colors ${scrolled ? 'text-slate-900 hover:text-slate-600' : 'text-white/90 hover:text-white'}`}
            >
              {t('nav.community')}
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LocaleSwitcher
              compact
              className={scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/70 hover:text-white'}
            />
            <Button asChild className="bg-white text-slate-900 hover:bg-slate-100 font-semibold">
              <Link href="/login">{t('nav.login')}</Link>
            </Button>
          </div>

          <button
            className={`md:hidden ${scrolled ? 'text-slate-500 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100">
            <div className="px-6 py-4 flex flex-col gap-4">
              <a
                href="#find-use-case"
                className="text-sm text-slate-900 hover:text-slate-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.discover')}
              </a>
              <a
                href="#faq"
                className="text-sm text-slate-900 hover:text-slate-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.qa')}
              </a>
              <Link
                href="/marketplace"
                className="text-sm text-slate-900 hover:text-slate-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.community')}
              </Link>
              <Link
                href="/login"
                className="text-sm text-slate-900 hover:text-slate-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.login')}
              </Link>
              <div className="pt-2 border-t border-slate-100">
                <LocaleSwitcher />
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero — full-screen video + inline use-case widget ── */}
      <section className="relative min-h-screen flex flex-col justify-between">
        <div className="absolute inset-0 overflow-hidden">
          <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-90">
            <source src="/notissima-hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />
        </div>

        {/* Upper two-thirds: headline + tagline */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-28 flex-1 flex flex-col items-center justify-center pb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5 text-teal-200 text-center [text-shadow:0_2px_12px_rgba(0,0,0,0.65)]">
            {t('hero.headline')}
          </h1>
          <p className="text-center text-lg sm:text-xl text-white leading-relaxed max-w-2xl mx-auto [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
            {t('hero.tagline')}
          </p>
        </div>

        {/* Lower third: use-case widget pinned to bottom */}
        <div id="find-use-case" className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-10">
          <p className="text-center text-sm text-teal-300 mb-3 tracking-widest uppercase font-semibold [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
            {t('hero.widgetLabel')}
          </p>
          <FindYourUseCaseWidget compact />
        </div>
      </section>

      {/* ── Q&A ── */}
      <section id="faq" className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              {t('faq.title')}
            </h2>
            <p className="mt-3 text-slate-500 text-base sm:text-lg">
              {t('faq.subtitle')}
            </p>
          </div>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50/50 px-6">
            {faqItems.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8">
              <Link href="/signup" className="inline-flex items-center gap-2">
                {t('faq.startFreeButton')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 py-12 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo variant="icon" className="h-6 opacity-40" />
            <span className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Notissima
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-500">
            <Link href="/imprint" className="hover:text-slate-700 transition-colors">{t('footer.imprint')}</Link>
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">{t('footer.privacy')}</Link>
            <Link href="/terms" className="hover:text-slate-700 transition-colors">{t('footer.terms')}</Link>
            <Link href="/contact" className="hover:text-slate-700 transition-colors">{t('footer.contact')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
