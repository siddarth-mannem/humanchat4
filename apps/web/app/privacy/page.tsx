import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — HumanChat',
  description: 'HumanChat Privacy Policy'
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05021b] to-[#070417] text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.03] px-6 py-5">
        <Link href="/" className="text-2xl font-bold text-white leading-tight hover:opacity-80 transition-opacity">
          Human<br />Chat
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-white/70">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">1. Introduction</h2>
            <p className="text-white/80 leading-relaxed">
              HumanChat ("we", "our", or "us") operates the HumanChat platform, which connects users with human experts for live conversations. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">2. Information We Collect</h2>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p><strong className="text-white">Account Information:</strong> When you create an account, we collect your name, email address, and authentication credentials provided through our authentication providers (e.g., Google Sign-In).</p>
              <p><strong className="text-white">Profile Information:</strong> If you create a profile as an expert, we collect information you provide, including your headline, expertise areas, availability, and pricing information.</p>
              <p><strong className="text-white">Conversation Data:</strong> We store messages, conversations, and session records to provide and improve our service.</p>
              <p><strong className="text-white">Usage Data:</strong> We collect information about how you interact with our platform, including device information, IP addresses, browser type, and usage patterns.</p>
              <p><strong className="text-white">Payment Information:</strong> Payment processing is handled by third-party payment processors (e.g., Stripe). We do not store complete payment card information on our servers.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">3. How We Use Your Information</h2>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Facilitate connections between users and experts</li>
                <li>Process payments and manage transactions</li>
                <li>Send you service-related communications</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Detect, prevent, and address technical issues and security concerns</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">4. Information Sharing and Disclosure</h2>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">With Experts/Users:</strong> When you book a session, relevant profile and contact information is shared with the other party to facilitate the conversation.</li>
                <li><strong className="text-white">Service Providers:</strong> We may share information with third-party service providers who perform services on our behalf (e.g., payment processing, hosting, analytics).</li>
                <li><strong className="text-white">Legal Requirements:</strong> We may disclose information if required by law or in response to valid legal requests.</li>
                <li><strong className="text-white">Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">5. Data Security</h2>
            <p className="text-white/80 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is completely secure.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">6. Your Rights and Choices</h2>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p>Depending on your location, you may have the following rights:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access and receive a copy of your personal data</li>
                <li>Rectify inaccurate or incomplete information</li>
                <li>Request deletion of your personal data</li>
                <li>Object to or restrict processing of your information</li>
                <li>Data portability</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
              <p>To exercise these rights, please contact us using the information provided below.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">7. Cookies and Tracking Technologies</h2>
            <p className="text-white/80 leading-relaxed">
              We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">8. Children's Privacy</h2>
            <p className="text-white/80 leading-relaxed">
              Our service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">9. Changes to This Privacy Policy</h2>
            <p className="text-white/80 leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">10. Contact Us</h2>
            <p className="text-white/80 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-white/80 leading-relaxed">
              Email: privacy@humanchat.com<br />
              Website: <Link href="/" className="text-aqua hover:underline">humanchat.com</Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
