import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'HumanChat — Talk to Anyone, About Anything',
  description: 'Sam, your AI concierge, connects you with human experts in seconds. Share your expertise or learn from others on HumanChat.',
  openGraph: {
    title: 'HumanChat — Talk to Anyone, About Anything',
    description: 'Join HumanChat to meet Sam, the AI concierge that pairs you with the perfect human expert.',
    url: 'https://humanchat.com',
    siteName: 'HumanChat',
    images: [{ url: 'https://humanchat.com/og.jpg', width: 1200, height: 630, alt: 'HumanChat landing page preview' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HumanChat — Talk to Anyone, About Anything',
    description: 'Get introduced to vetted experts through Sam, your AI concierge.',
    images: ['https://humanchat.com/og.jpg']
  }
};

export default function LandingPage() {
  return (
    <div className="bg-midnight text-white">
      <header className="relative overflow-hidden border-b border-white/10 bg-radial-fade">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-indigoGlow/20 to-transparent blur-3xl" />
        <div className="mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
          <nav className="flex items-center justify-between rounded-full border border-white/10 bg-black/30 px-6 py-3 text-sm text-white/80 backdrop-blur">
            <Link href="/" className="font-display text-lg text-white">
              HumanChat
            </Link>
            <div className="hidden gap-6 sm:flex">
              <a href="/chat" className="transition hover:text-white">
                Workspace
              </a>
              <a href="/signup" className="transition hover:text-white">
                Hosts
              </a>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-1 text-white transition hover:border-white"
            >
              Login/Signup
            </Link>
          </nav>
          <div className="flex flex-1 flex-col items-start justify-center gap-10 pb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-white/70">Human-first conversations</p>
          <h1 className="max-w-3xl font-display text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
            Talk to Anyone, About Anything
          </h1>
          <p className="max-w-2xl text-lg text-slate-200">
            HumanChat pairs Sam—the AI concierge who understands your goals—with real people who can help. Share your
            expertise or tap into someone else’s brilliance in seconds.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/chat?focus=sam"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-8 py-3 font-semibold text-midnight shadow-lg shadow-indigoGlow/30 transition hover:scale-105"
            >
              Start Chatting
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-8 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/5"
            >
              Explore the workspace
            </Link>
          </div>
          </div>
        </div>
      </header>

      <main />
    </div>
  );
}
