'use client'

import { Logo } from '@/components/ui/logo'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ImprintPage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Imprint</h1>
        <p className="text-slate-400 text-sm mb-12">Legal notice according to German law</p>

        <div className="space-y-10 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Provider</h2>
            <p>
              Notissima GmbH
              <br />
              Musterstrasse 1
              <br />
              10115 Berlin
              <br />
              Germany
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Contact</h2>
            <p>
              Email:{' '}
              <a href="mailto:hello@notissima.com" className="text-teal-600 hover:text-teal-500 underline underline-offset-2">
                hello@notissima.com
              </a>
              <br />
              Phone: +49 (0) 000 000 0000
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Responsible for Content</h2>
            <p>
              Notissima GmbH
              <br />
              Managing Director: Max Mustermann
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">VAT ID</h2>
            <p>VAT identification number according to Section 27a German VAT Act: DE000000000</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Dispute Resolution</h2>
            <p>
              The European Commission provides a platform for online dispute resolution (ODR):
              <br />
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 hover:text-teal-500 underline underline-offset-2"
              >
                https://ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-100 py-8 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center text-sm text-slate-400">
          &copy; {new Date().getFullYear()} Notissima. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
