'use client'

import { Logo } from '@/components/ui/logo'
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Placeholder — will connect to backend later
    await new Promise((r) => setTimeout(r, 1000))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <nav className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <Logo variant="full" className="h-6 brightness-0 invert opacity-50" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Contact Us</h1>
        <p className="text-white/50 mb-12">Have a question or want to get in touch? We&apos;d love to hear from you.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact info */}
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-6">Get in Touch</h2>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/40 mb-1">Email</p>
                    <a href="mailto:hello@notissima.com" className="text-white/80 hover:text-indigo-400 transition-colors">
                      hello@notissima.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/40 mb-1">Phone</p>
                    <a href="tel:+4900000000" className="text-white/80 hover:text-indigo-400 transition-colors">
                      +49 (0) 000 000 0000
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/40 mb-1">Address</p>
                    <p className="text-white/80">
                      Notissima GmbH<br />
                      Musterstraße 1<br />
                      10115 Berlin, Germany
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3">Business Hours</h3>
              <p className="text-white/60">Monday – Friday: 9:00 – 18:00 CET</p>
              <p className="text-white/60">Saturday – Sunday: Closed</p>
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h2 className="text-xl font-semibold mb-6">Send a Message</h2>
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="text-sm text-white/40 block mb-1.5">Name</label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="text-sm text-white/40 block mb-1.5">Email</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="text-sm text-white/40 block mb-1.5">Message</label>
                  <textarea
                    id="message"
                    placeholder="How can we help?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className="flex w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Message Sent!</h3>
                <p className="text-white/50">Thanks for reaching out. We&apos;ll get back to you as soon as possible.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 mt-16">
        <div className="max-w-4xl mx-auto text-center text-sm text-white/20">
          &copy; {new Date().getFullYear()} Notissima. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
