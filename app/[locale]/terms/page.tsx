'use client'

import { Logo } from '@/components/ui/logo'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TermsPage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: March 5, 2026</p>

        <div className="space-y-10 text-white/60 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Notissima (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
            <p>
              Notissima is an AI-powered meeting documentation platform that provides transcription, report generation, and related services. The Service is currently in beta and features may change without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Beta Access</h2>
            <p>
              By signing up for beta access, you acknowledge that the Service is in a pre-release state. Beta features may contain bugs, may not function as expected, and may be modified or discontinued at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload content that infringes on intellectual property rights</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Use the Service to process sensitive data without proper consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Intellectual Property</h2>
            <p>
              The Service, including its design, features, and content, is owned by Notissima and protected by intellectual property laws. You retain ownership of any content you upload to the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Data Processing</h2>
            <p>
              Audio recordings and transcripts uploaded to the Service are processed using third-party AI services. By using the Service, you consent to this processing. Please refer to our Privacy Policy for more details on data handling.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. Notissima shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at any time, with or without cause. Upon termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of significant changes by posting a notice on the Service. Continued use after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Contact</h2>
            <p>
              For questions about these Terms, please contact us at:{' '}
              <a href="mailto:legal@notissima.com" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                legal@notissima.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-4xl mx-auto text-center text-sm text-white/20">
          &copy; {new Date().getFullYear()} Notissima. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
