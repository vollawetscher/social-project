'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Mic,
  FileText,
  Globe,
  Shield,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Menu,
  X,
} from 'lucide-react'

const LAUNCH_DATE_UTC = new Date('2026-03-19T12:00:00Z')

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(): TimeLeft {
  const diff = Math.max(0, LAUNCH_DATE_UTC.getTime() - Date.now())
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

function CountdownTimer() {
  const [time, setTime] = useState<TimeLeft | null>(null)

  useEffect(() => {
    setTime(getTimeLeft())
    const id = setInterval(() => setTime(getTimeLeft()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return <div className="h-[88px]" />

  const units = [
    { value: time.days, label: 'Days' },
    { value: time.hours, label: 'Hours' },
    { value: time.minutes, label: 'Minutes' },
    { value: time.seconds, label: 'Seconds' },
  ]

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-5">
      {units.map((unit, i) => (
        <div key={unit.label} className="flex items-center gap-3 sm:gap-5">
          <div className="flex flex-col items-center">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl sm:text-3xl font-bold tabular-nums bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                {String(unit.value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-white/30 mt-2 uppercase tracking-widest">
              {unit.label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span className="text-xl sm:text-2xl font-bold text-white/15 -mt-5">:</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    setError('')

    // Placeholder — will connect to Supabase later
    await new Promise((r) => setTimeout(r, 1000))
    setSubmitted(true)
    setLoading(false)
  }

  const features = [
    {
      icon: Mic,
      title: 'AI Transcription',
      description:
        'Record or upload audio and get accurate transcripts with automatic speaker identification in 30+ languages.',
    },
    {
      icon: FileText,
      title: 'Smart Reports',
      description:
        'AI-generated structured reports with summaries, key quotes, observations, and next steps — tailored to your domain.',
    },
    {
      icon: Globe,
      title: 'Multi-Language',
      description:
        'Automatic language detection and reports generated in the same language as your conversation. No manual setup.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description:
        'Enterprise-grade security with row-level access control, GDPR-ready infrastructure, and encrypted storage.',
    },
  ]

  const steps = [
    { number: '01', title: 'Record', description: 'Record in-browser or upload your audio file' },
    { number: '02', title: 'Transcribe', description: 'AI transcribes with speaker identification' },
    { number: '03', title: 'Generate', description: 'Get a structured, professional report instantly' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo variant="full" className="h-7 brightness-0 invert" />

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">
              How it works
            </a>
            <a href="#signup" className="text-sm text-white/60 hover:text-white transition-colors">
              Early Access
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => {
                const el = document.getElementById('signup')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Get Early Access
            </Button>
          </div>

          <button
            className="md:hidden text-white/70 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/5">
            <div className="px-6 py-4 flex flex-col gap-4">
              <a href="#features" className="text-sm text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="text-sm text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              <a href="#signup" className="text-sm text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Early Access</a>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero with Video Background ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center">
        {/* Mobile: video background */}
        <div className="absolute inset-0 overflow-hidden md:hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-30"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
        </div>

        {/* Desktop: animated gradient glow background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-indigo-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-gradient-radial from-cyan-500/15 via-teal-500/5 to-transparent rounded-full blur-3xl animate-pulse-slower" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 mb-8 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Coming Soon — Join the Beta
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Your meetings,{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              documented
            </span>
            <br />
            in seconds.
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Notissima uses AI to transcribe your conversations and generate
            professional, structured reports — so you can focus on what matters.
          </p>

          {/* Countdown timer */}
          <div className="mb-12">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-5">Launching in</p>
            <CountdownTimer />
          </div>

          {/* Email signup */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 rounded-xl"
              />
              <Button
                type="submit"
                disabled={loading}
                className="h-12 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Notify Me
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <span className="text-lg font-medium">You&apos;re on the list! We&apos;ll notify you when we launch.</span>
            </div>
          )}
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <p className="text-xs text-white/30 mt-4">
            No spam. Unsubscribe anytime. We&apos;ll only email you when we launch.
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-sm font-medium text-indigo-400 tracking-wide uppercase mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Everything you need to
              <br />
              <span className="text-white/40">document with confidence.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group relative p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:border-indigo-500/40 transition-colors">
                  <feature.icon className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-white/50 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-sm font-medium text-indigo-400 tracking-wide uppercase mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Three steps to
              <br />
              <span className="text-white/40">perfect documentation.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center group">
                <div className="text-6xl font-bold text-white/[0.03] group-hover:text-white/[0.06] transition-colors mb-4">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-2 -mt-4">{step.title}</h3>
                <p className="text-white/50">{step.description}</p>

                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 -right-4 w-8">
                    <ArrowRight className="w-5 h-5 text-white/10" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="signup" className="relative py-32 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Ready to transform how
            <br />
            you document meetings?
          </h2>
          <p className="text-lg text-white/50 mb-10">
            Join the beta and be the first to experience Notissima when we launch.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 rounded-xl"
              />
              <Button
                type="submit"
                disabled={loading}
                className="h-12 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Notify Me'}
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <span className="text-lg font-medium">You&apos;re on the list!</span>
            </div>
          )}
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo variant="icon" className="h-6 brightness-0 invert opacity-50" />
            <span className="text-sm text-white/30">
              &copy; {new Date().getFullYear()} Notissima. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-sm text-white/30 hover:text-white/60 transition-colors">
              Privacy
            </a>
            <a href="/terms" className="text-sm text-white/30 hover:text-white/60 transition-colors">
              Terms
            </a>
            <a href="/contact" className="text-sm text-white/30 hover:text-white/60 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
