'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react'
import { LocaleSwitcher } from '@/components/locale-switcher'
import FindYourUseCaseWidget from '@/components/landing/FindYourUseCaseWidget'

const FAQ_ITEMS = [
  {
    q: 'What is Notissima?',
    a: 'Notissima is a communication intelligence platform that turns your calls, meetings, recordings, and text imports into structured professional documentation — automatically. Instead of raw transcripts, you get decision logs, action plans, strategic memos, and risk summaries tailored to your role and workflow.',
  },
  {
    q: 'Who is Notissima for?',
    a: 'Notissima is built for professionals who run meetings, client calls, project reviews, consultations, or any high-stakes conversation. That includes project managers, consultants, healthcare practitioners, lawyers, salespeople, executives, and anyone else whose work depends on accurate communication records.',
  },
  {
    q: 'How does Notissima create outputs from a conversation?',
    a: 'You bring the communication — paste text, upload a file, record audio, or start a call directly in Notissima. The platform automatically detects the type of conversation, selects the right output templates for your domain, and generates structured documentation. No manual configuration needed.',
  },
  {
    q: 'What kind of outputs does Notissima produce?',
    a: 'Outputs include meeting summaries, decision logs, action plans, risk registers, project briefs, client memos, follow-up checklists, and more. Every output is generated using domain-tested templates — structured the way professionals actually work, not generic AI summaries. Formats include Markdown, PDF, DOCX, and JSON.',
  },
  {
    q: 'What languages does Notissima support?',
    a: 'Notissima supports transcription and output generation in 50+ languages with automatic language detection. You can record or upload in one language and generate outputs in another — useful for multilingual teams and international client work.',
  },
  {
    q: 'Does Notissima integrate with tools like Notion, Slack, or HubSpot?',
    a: 'Yes. All outputs are Markdown-native, which means they paste cleanly into Notion, Slack, HubSpot, Confluence, and any other tool your team uses. For automated workflows, Notissima outputs are compatible with Zapier and similar integration platforms — no custom integration required.',
  },
  {
    q: 'How is my data and call content handled?',
    a: 'Your data is processed securely and never used to train AI models. Calls and recordings are stored with encryption, and all personally identifiable information (PII) in transcripts is automatically flagged and redacted. Notissima is designed to meet the compliance requirements of regulated industries.',
  },
  {
    q: 'Can I use Notissima for video and phone calls, not just recordings?',
    a: 'Yes. Notissima includes a built-in calling feature supporting browser-based video and voice calls, as well as outbound phone network (PSTN) calls. All calls are automatically recorded and processed into structured outputs — no need to use a separate meeting tool.',
  },
  {
    q: 'How does Notissima differ from a standard AI transcription service?',
    a: 'Transcription services give you a text version of what was said. Notissima goes further: it comprehends the purpose of the conversation, extracts decisions, risks, and commitments, and produces documentation that is immediately usable in a professional context. It also tracks these elements across multiple sessions over time.',
  },
  {
    q: 'How do I get started with Notissima?',
    a: 'You can start a free trial directly on this page — no credit card required. Use the "Find out what it can do for you" section below to discover the most relevant outputs for your role, or sign up and start with your first call or upload immediately.',
  },
]

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* FAQ JSON-LD schema for Google/AI search */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

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
            <a href="#find-use-case" className={`text-sm transition-colors ${scrolled ? 'text-slate-900 hover:text-slate-600' : 'text-white/90 hover:text-white'}`}>
              Discover
            </a>
            <a href="#faq" className={`text-sm transition-colors ${scrolled ? 'text-slate-900 hover:text-slate-600' : 'text-white/90 hover:text-white'}`}>
              Q&amp;A
            </a>
            <Link href="/marketplace" className={`text-sm transition-colors ${scrolled ? 'text-slate-900 hover:text-slate-600' : 'text-white/90 hover:text-white'}`}>
              Community
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LocaleSwitcher compact className={scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/70 hover:text-white'} />
            <Button asChild className="bg-white text-slate-900 hover:bg-slate-100 font-semibold">
              <Link href="/login">Log in</Link>
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
              <a href="#find-use-case" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                Discover
              </a>
              <a href="#faq" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                Q&amp;A
              </a>
              <Link href="/marketplace" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                Community
              </Link>
              <Link href="/login" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                Log in
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
          {/* Lighter gradient — video stays visible, bottom dark enough for widget */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />
        </div>

        {/* Upper two-thirds: headline + tagline */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-28 flex-1 flex flex-col items-center justify-center pb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5 text-teal-200 text-center [text-shadow:0_2px_12px_rgba(0,0,0,0.65)]">
            Get more out of your most valuable asset. Communication.
          </h1>
          <p className="text-center text-lg sm:text-xl text-white leading-relaxed max-w-2xl mx-auto [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
            Notissima turns every call, meeting, and email into structured intelligence —
            decisions, risks, and actions you, your team and your clients can actually use.
          </p>
        </div>

        {/* Lower third: use-case widget pinned to bottom */}
        <div id="find-use-case" className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-10">
          <p className="text-center text-sm text-teal-300 mb-3 tracking-widest uppercase font-semibold [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
            Find out what Notissima can do for you
          </p>
          <FindYourUseCaseWidget compact />
        </div>
      </section>

      {/* ── Q&A ── */}
      <section id="faq" className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Questions &amp; Answers
            </h2>
            <p className="mt-3 text-slate-500 text-base sm:text-lg">
              Everything you need to know about Notissima.
            </p>
          </div>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50/50 px-6">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8">
              <Link href="/signup" className="inline-flex items-center gap-2">
                Start free — no credit card needed
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
            <Link href="/imprint" className="hover:text-slate-700 transition-colors">Imprint</Link>
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-slate-700 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
