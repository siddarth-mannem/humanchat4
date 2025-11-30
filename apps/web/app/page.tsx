import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

const steps = [
  {
    title: 'Tell Sam what you need',
    body: 'Share the project, the person, or the moment you want to create. Sam listens and keeps you moving.',
    badge: '01'
  },
  {
    title: 'Get handpicked humans',
    body: 'Sam surfaces verified hosts who are available right now or later today. You choose the vibe.',
    badge: '02'
  },
  {
    title: 'Drop into a session',
    body: 'Spin up an instant line or schedule a focused deep dive—with payments and notes handled for you.',
    badge: '03'
  }
];

const profileHighlights = [
  {
    name: 'Priya Desai',
    role: 'Climate Policy Translator',
    blurb: 'Turns dense policy into action steps for local teams.',
    status: 'Available now'
  },
  {
    name: 'Jamal Ortiz',
    role: 'Product Coach for AI Teams',
    blurb: 'Guides founding teams through zero-to-one launches.',
    status: 'In session · 15m ETA'
  },
  {
    name: 'Vera Han',
    role: 'Creative Facilitator',
    blurb: 'Runs energizing brainstorms and brings the right guests.',
    status: 'Opens at 2 PM PST'
  }
];

const splitFeatures = [
  {
    title: 'Share your expertise',
    items: ['List instant and scheduled rates', 'Stay booked with Sam’s warm intros', 'Get paid automatically for every minute']
  },
  {
    title: 'Learn from others',
    items: ['Browse live profiles in your lane', 'Spin up a session in under 60 seconds', 'Capture insights in your HumanChat workspace']
  }
];

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

const Section = ({ title, children, id }: { title: string; children: ReactNode; id?: string }) => (
  <section id={id} className="w-full py-16 sm:py-20">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="mb-10 flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-slate-400">
        <span className="h-[2px] w-10 bg-gradient-to-r from-indigoGlow to-aqua" />
        <span>{title}</span>
      </div>
      {children}
    </div>
  </section>
);

const GradientCard = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
    {children}
  </div>
);

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
              <a href="#how-it-works" className="transition hover:text-white">
                How it works
              </a>
              <a href="#profiles" className="transition hover:text-white">
                Profiles
              </a>
              <a href="#ai" className="transition hover:text-white">
                AI concierge
              </a>
            </div>
            <Link href="/signup" className="rounded-full border border-white/30 px-4 py-1 text-white transition hover:border-white">
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

      <main>
        <Section title="How it works" id="how-it-works">
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <GradientCard key={step.title}>
                <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 font-semibold text-white/80">
                  {step.badge}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white">{step.title}</h3>
                <p className="text-slate-300">{step.body}</p>
              </GradientCard>
            ))}
          </div>
        </Section>

        <Section title="For everyone">
          <div className="grid gap-6 lg:grid-cols-2">
            {splitFeatures.map((feature) => (
              <GradientCard key={feature.title}>
                <h3 className="mb-4 font-display text-2xl text-white">{feature.title}</h3>
                <ul className="space-y-3 text-slate-300">
                  {feature.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-aqua" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </GradientCard>
            ))}
          </div>
        </Section>

        <Section title="Featured profiles" id="profiles">
          <div className="grid gap-6 md:grid-cols-3">
            {profileHighlights.map((profile) => (
              <div key={profile.name} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <div className="mb-6 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigoGlow to-aqua" />
                  <div>
                    <p className="text-base font-semibold text-white">{profile.name}</p>
                    <p className="text-sm text-slate-300">{profile.role}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-200">{profile.blurb}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-peach">{profile.status}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="AI powered" id="ai">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <GradientCard>
              <p className="text-sm uppercase tracking-[0.3em] text-peach/80">Meet Sam</p>
              <h3 className="mt-4 font-display text-3xl text-white">Your concierge, supercharged by Gemini</h3>
              <p className="mt-4 text-slate-200">
                Sam blends Google Gemini intelligence with HumanChat’s verified roster. Every response is structured,
                transparent, and ready to turn into action—whether that’s a quick intro, a scheduled call, or a
                follow-up prompt.
              </p>
              <ul className="mt-6 space-y-3 text-slate-200">
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-indigoGlow" /> JSON-only responses with rich actions
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-indigoGlow" /> Real-time syncing across devices
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-indigoGlow" /> Built-in guardrails for trust & safety
                </li>
              </ul>
            </GradientCard>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 shadow-lg shadow-black/40">
              <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Live preview</p>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                  <p className="text-sm text-slate-300">Sam</p>
                  <p className="mt-3 text-base text-white">
                    Got it—Nadia and Leo can hop on within the next 20 minutes. Want me to bring them in now or hold a
                    slot later today?
                  </p>
                </div>
                <div className="rounded-2xl border border-aqua/30 bg-black/60 p-5">
                  <p className="text-sm text-slate-300">Actions</p>
                  <ul className="mt-3 space-y-2 text-sm text-white">
                    <li className="rounded-full border border-white/30 px-4 py-2">Connect Nadia now</li>
                    <li className="rounded-full border border-white/30 px-4 py-2">Schedule Leo · 4:00 PM</li>
                    <li className="rounded-full border border-white/30 px-4 py-2">Ask Sam for more options</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <section className="py-20">
          <div className="mx-auto max-w-5xl rounded-[32px] border border-white/10 bg-gradient-to-br from-indigoGlow/30 via-midnight to-aqua/20 px-8 py-16 text-center shadow-2xl shadow-indigoGlow/30">
            <p className="text-sm uppercase tracking-[0.4em] text-white/70">Ready when you are</p>
            <h2 className="mt-6 font-display text-4xl text-white">Join HumanChat</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-100">
              Drop in for five minutes or host a full session—Sam keeps your conversations organized, actionable, and on
              brand.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 font-semibold text-midnight transition hover:scale-105"
              >
                Join HumanChat
              </Link>
              <Link href="/chat" className="text-sm font-semibold text-white/80 underline-offset-4 hover:underline">
                Already a host? Open your workspace
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
