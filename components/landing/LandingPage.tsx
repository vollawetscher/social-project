'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ArrowRight, Menu, X } from 'lucide-react'
import { LocaleSwitcher } from '@/components/locale-switcher'
import FindYourUseCaseWidget from '@/components/landing/FindYourUseCaseWidget'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
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
            <a href="#how-it-works" className="text-sm text-slate-900 hover:text-slate-600 transition-colors">
              How it works
            </a>
            <a href="#your-world" className="text-sm text-slate-900 hover:text-slate-600 transition-colors">
              Your world
            </a>
            <Link href="/marketplace" className="text-sm text-slate-900 hover:text-slate-600 transition-colors">
              Community
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LocaleSwitcher compact className="text-slate-600 hover:text-slate-900" />
            <Button asChild className="bg-slate-900 hover:bg-slate-800 text-white">
              <Link href="/login">Log in</Link>
            </Button>
          </div>

          <button
            className="md:hidden text-slate-500 hover:text-slate-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100">
            <div className="px-6 py-4 flex flex-col gap-4">
              <a href="#how-it-works" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                How it works
              </a>
              <a href="#your-world" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                Your world
              </a>
              <Link href="/marketplace" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                Community
              </Link>
              <Link href="/login" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                Log in
              </Link>
              <a href="#find-use-case" className="text-sm text-slate-900 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
                Find out what it can do for you
              </a>
              <div className="pt-2 border-t border-slate-100">
                <LocaleSwitcher />
              </div>
            </div>
          </div>
        )}
      </nav>

      <section className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-90">
            <source src="/notissima-hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/60 to-black/70" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-teal-200 [text-shadow:0_2px_12px_rgba(0,0,0,0.65)]">
            Get more out of your most valuable asset. Communication.
          </h1>
          <div className="max-w-3xl mx-auto rounded-2xl bg-black/40 border border-white/25 px-5 py-4 sm:px-7 sm:py-5 backdrop-blur-sm shadow-2xl">
            <p className="text-lg sm:text-xl text-white leading-relaxed">
              Every call, meeting, and email your team makes holds decisions, risks, and commitments.
              Right now, most of it disappears — trapped in someone&apos;s memory, buried in a thread, or reduced to a few lines nobody will read.
            </p>
            <p className="text-lg sm:text-xl text-white leading-relaxed mt-4">
              Notissima captures it all. Not as transcripts. As intelligence.
            </p>
          </div>

          <div className="mt-10">
            <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100 font-semibold px-8">
              <a href="#find-use-case" className="inline-flex items-center gap-2">
                Find out what it can do for you
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center text-slate-900 max-w-4xl mx-auto">
            Bring your communication. Get exactly the documentation your project needed.
          </h2>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center">
              <div className="text-7xl sm:text-8xl font-bold leading-none text-slate-200">01</div>
              <h3 className="text-2xl font-semibold text-slate-900 mt-3 mb-4">Ingest</h3>
              <p className="text-slate-700 leading-relaxed text-left">
                Paste text. Upload a file. Record audio. Or start a call right inside Notissima — video, audio, or phone.
                However your communication exists, Notissima takes it. In 50+ languages, auto-detected and translated.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center">
              <div className="text-7xl sm:text-8xl font-bold leading-none text-slate-200">02</div>
              <h3 className="text-2xl font-semibold text-slate-900 mt-3 mb-4">Comprehend</h3>
              <p className="text-slate-700 leading-relaxed text-left">
                Notissima doesn&apos;t ask what you need. It comprehends the type of communication — a client call,
                a project standup, a patient session, a legal review — and knows what outputs your project requires.
                Before you do.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center">
              <div className="text-7xl sm:text-8xl font-bold leading-none text-slate-200">03</div>
              <h3 className="text-2xl font-semibold text-slate-900 mt-3 mb-4">Create</h3>
              <p className="text-slate-700 leading-relaxed text-left">
                A project meeting becomes a decision log, a risk summary, and an action plan. A client call becomes a strategic memo,
                a follow-up checklist, and a project brief. Auto-suggested in the format that fits: md, pdf, docx, or JSON.
              </p>
              <p className="text-slate-700 leading-relaxed mt-3 text-left">
                Every output is built on domain-tested templates — structured for how professionals actually work.
                Not generic AI summaries. Professional documentation, ready to use.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="your-world" className="relative py-24 px-6 bg-slate-50">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 opacity-70">
            {['Notion', 'Slack', 'HubSpot', 'Zapier', 'Markdown', 'JSON', 'DOCX', 'PDF'].map((item) => (
              <span key={item} className="text-[11px] px-2 py-1 rounded-full border border-slate-300 bg-white/80 text-slate-500">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center text-slate-900 max-w-4xl mx-auto">
            Communication Intelligence leads to world-class decision making.
          </h2>

          <div className="mt-14 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Your project finally has a memory.</h3>
              <p className="text-slate-700 leading-relaxed">
                Notissima tracks decisions, risks, and commitments across every conversation over time.
                It flags contradictions, surfaces what was promised but never confirmed, and catches what your team missed.
                One meeting is useful. An entire project&apos;s communication — that&apos;s transformational.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Drops into your workflow.</h3>
              <p className="text-slate-700 leading-relaxed">
                Markdown-native output works with Notion, Slack, HubSpot, Zapier — no integration headaches, no setup.
                Structured knowledge, right where your team already works.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Gets smarter over time.</h3>
              <p className="text-slate-700 leading-relaxed">
                The Voice2Value community connects professionals who share templates, workflow recipes, and integration tips.
                The more the community grows, the better everyone&apos;s outputs get.
                Browse what works in your field. Share what works for you.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="find-use-case" className="py-20 px-6 bg-slate-950">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Find out what it can do for you
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            A quick 3-step flow to discover the best Notissima outputs for your role.
          </p>
          <div className="mt-8 text-left">
            <FindYourUseCaseWidget />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-12 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo variant="icon" className="h-6 opacity-40" />
            <span className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Notissima
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-500">
            <Link href="/imprint" className="hover:text-slate-700 transition-colors">
              Imprint
            </Link>
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-700 transition-colors">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-slate-700 transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
