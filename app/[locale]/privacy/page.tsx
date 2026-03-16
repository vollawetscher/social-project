'use client'

import { Logo } from '@/components/ui/logo'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-12">Last updated: March 11, 2026</p>

        <div className="space-y-10 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">1. Introduction</h2>
            <p>
              Notissima (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">2. Information We Collect</h2>
            <p className="mb-3">We may collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><span className="text-slate-800 font-medium">Personal Information:</span> Email address provided when signing up for beta access.</li>
              <li><span className="text-slate-800 font-medium">Usage Data:</span> Information about how you interact with our website, including pages visited and time spent.</li>
              <li><span className="text-slate-800 font-medium">Device Information:</span> Browser type, operating system, and device identifiers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">3. How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Notify you when Notissima launches</li>
              <li>Improve and optimize our website and services</li>
              <li>Communicate with you about updates and features</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">4. Data Storage & Security</h2>
            <p>
              Your data is stored securely using industry-standard encryption and security practices. We use Supabase for our database infrastructure, which provides enterprise-grade security including row-level security and encrypted storage. We retain your data only as long as necessary to fulfill the purposes outlined in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">5. Third-Party Services</h2>
            <p>
              We may use third-party services for analytics and infrastructure. These services have their own privacy policies and we encourage you to review them. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">6. Marketplace Template Installation &amp; Email Sharing</h2>
            <p className="mb-3">
              When you install a marketplace template that requires email consent (&quot;gated template&quot;), we share your email address with the template creator. This only happens when:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>The template creator has enabled lead capture for that template</li>
              <li>You explicitly consent by checking the agreement checkbox before installing</li>
            </ul>
            <p className="mt-3 mb-3">
              The information shared with the creator includes your email address and the name of the template you installed. The template creator becomes the data controller for your email address under GDPR and is responsible for its lawful processing.
            </p>
            <p>
              You can contact the template creator directly to request deletion of your data. If you need assistance, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">7. Your Rights (GDPR)</h2>
            <p className="mb-3">If you are in the European Economic Area, you have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Access your personal data</li>
              <li>Rectify inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, please contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">8. Cookies</h2>
            <p>
              We may use cookies and similar tracking technologies to enhance your experience. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">10. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:{' '}
              <a href="mailto:privacy@notissima.com" className="text-teal-600 hover:text-teal-500 underline underline-offset-2">
                privacy@notissima.com
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
