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
    await new Promise((r) => setTimeout(r, 1000))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <nav className="border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <Logo variant="full" className="h-6 opacity-50" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Contact Us</h1>
        <p className="text-slate-500 mb-12">Have a question or want to get in touch? We&apos;d love to hear from you.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact info */}
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-6">Get in Touch</h2>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Email</p>
                    <a href="mailto:hello@notissima.com" className="text-slate-700 hover:text-teal-600 transition-colors">
                      hello@notissima.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Phone</p>
                    <a href="tel:+4900000000" className="text-slate-700 hover:text-teal-600 transition-colors">
                      +49 (0) 000 000 0000
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Address</p>
                    <p className="text-slate-700">
                      Notissima GmbH<br />
                      Musterstraße 1<br />
                      10115 Berlin, Germany
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Business Hours</h3>
              <p className="text-slate-600">Monday – Friday: 9:00 – 18:00 CET</p>
              <p className="text-slate-600">Saturday – Sunday: Closed</p>
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h2 className="text-xl font-semibold mb-6">Send a Message</h2>
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="text-sm text-slate-500 block mb-1.5">Name</label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-teal-500/30 focus-visible:border-teal-400 rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="text-sm text-slate-500 block mb-1.5">Email</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-teal-500/30 focus-visible:border-teal-400 rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="text-sm text-slate-500 block mb-1.5">Message</label>
                  <textarea
                    id="message"
                    placeholder="How can we help?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:border-teal-400 resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-medium rounded-xl shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Message Sent!</h3>
                <p className="text-slate-500">Thanks for reaching out. We&apos;ll get back to you as soon as possible.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-100 py-8 px-6 mt-16 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center text-sm text-slate-400">
          &copy; {new Date().getFullYear()} Notissima. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
