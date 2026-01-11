import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — HumanChat',
  description: 'HumanChat Terms of Service'
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05021b] to-[#070417] text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.03] px-6 py-5">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70 hover:text-white transition-colors">
          Humanchat.com
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
            <p className="text-white/70">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p className="text-white/80 leading-relaxed">
              By accessing or using HumanChat ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">2. Description of Service</h2>
            <p className="text-white/80 leading-relaxed">
              HumanChat is a platform that connects users with human experts for live conversations. We provide an AI concierge service (Sam) to help facilitate connections and manage bookings between users and experts.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">3. User Accounts</h2>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p>To use certain features of the Service, you must:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Be at least 18 years old</li>
                <li>Create an account using a valid email address or through an authorized authentication provider</li>
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities that occur under your account</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">4. User Conduct</h2>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p>You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Transmit harmful, abusive, harassing, defamatory, or objectionable content</li>
                <li>Impersonate any person or entity</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Attempt to gain unauthorized access to any portion of the Service</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Collect or store personal data about other users without their consent</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">5. Expert Services</h2>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p>If you participate as an expert on the platform:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You are responsible for the accuracy of your profile information</li>
                <li>You must provide services in a professional and ethical manner</li>
                <li>You are responsible for complying with all applicable laws and regulations in your jurisdiction</li>
                <li>You acknowledge that HumanChat is a platform facilitator and not responsible for the content or quality of conversations between users and experts</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">6. Payments and Fees</h2>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p>Payment terms:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Users agree to pay all fees associated with booked sessions</li>
                <li>Payment processing is handled by third-party payment processors</li>
                <li>Refund policies are subject to the terms set by individual experts and our cancellation policies</li>
                <li>All fees are non-refundable except as explicitly stated in our refund policy</li>
                <li>We reserve the right to change our pricing structure at any time</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">7. Intellectual Property</h2>
            <p className="text-white/80 leading-relaxed">
              The Service and its original content, features, and functionality are owned by HumanChat and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of our Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">8. Disclaimer of Warranties</h2>
            <p className="text-white/80 leading-relaxed">
              The Service is provided "as is" and "as available" without any warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, secure, or error-free. We are not responsible for the accuracy, completeness, or usefulness of any information provided by experts or users.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">9. Limitation of Liability</h2>
            <p className="text-white/80 leading-relaxed">
              To the maximum extent permitted by law, HumanChat shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">10. Indemnification</h2>
            <p className="text-white/80 leading-relaxed">
              You agree to defend, indemnify, and hold harmless HumanChat and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or in any way connected with your use of the Service or violation of these Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">11. Termination</h2>
            <p className="text-white/80 leading-relaxed">
              We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">12. Changes to Terms</h2>
            <p className="text-white/80 leading-relaxed">
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">13. Governing Law</h2>
            <p className="text-white/80 leading-relaxed">
              These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which HumanChat operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">14. Contact Information</h2>
            <p className="text-white/80 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-white/80 leading-relaxed">
              Email: legal@humanchat.com<br />
              Website: <Link href="/" className="text-aqua hover:underline">humanchat.com</Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
