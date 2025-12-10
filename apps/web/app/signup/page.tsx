import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import SignupActions from '../../components/SignupActions';

const personas = [
  {
    title: 'Hosts & experts',
    items: [
      'List instant, scheduled, and managed rates in one place.',
      'Stay discoverable to teams who are already working with Sam.',
      'Let HumanChat handle payments, notes, and follow ups.'
    ]
  },
  {
    title: 'Teams & operators',
    items: [
      'Spin up curated rooms for launches, events, or advisory sessions.',
      'Keep approvals, billing, and transcripts synchronized with Sam.',
      'Invite internal talent or external partners with one link.'
    ]
  },
  {
    title: 'Community builders',
    items: [
      'Offer drop-in office hours for your members.',
      'Route requests to the right human with Sam’s concierge workflow.',
      'Track usage, outcomes, and follow-on actions in real time.'
    ]
  }
];

const steps = [
  {
    title: 'Share your focus',
    body: 'Tell us what kind of conversations you want to host or request. A short blurb plus availability is perfect.'
  },
  {
    title: 'Meet Sam live',
    body: 'We schedule a 15-minute onboarding to wire up payments, routing, and any privacy guardrails you need.'
  },
  {
    title: 'Go live',
    body: 'Your profile and workspace unlock inside HumanChat. Sam can now introduce you or your team on demand.'
  }
];

const faqs = [
  {
    q: 'Is there a cost to join?',
    a: 'Signing up is free. We only collect fees when you charge for sessions or ask Sam to manage a paid introduction.'
  },
  {
    q: 'Can my team co-host sessions?',
    a: 'Yes. Add collaborators during onboarding and Sam will keep notes, payouts, and calendars in sync.'
  },
  {
    q: 'What if I just need a fast intro?',
    a: 'Message Sam inside the workspace. If you are new, send a quick note below and we will drop the intro in your inbox.'
  }
];

const actions = [
  {
    title: 'Talk to Sam in the app',
    description: 'Already experimenting? Jump back into the workspace and open the Sam chat thread.',
    href: '/chat',
    style: 'primary'
  },
  {
    title: 'Email the concierge',
    description: 'Prefer an inbox workflow? Send context to sam@humanchat.com and we will reply within one business day.',
    href: 'mailto:sam@humanchat.com',
    style: 'secondary'
  }
];

export const metadata: Metadata = {
  title: 'Join HumanChat — Host or Request Sessions',
  description: 'Create a HumanChat profile, bring your team, or request Sam-managed sessions in minutes.'
};

const Card = ({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(5,9,35,0.55)]">
    <p className="text-sm uppercase tracking-[0.35em] text-white/60">{title}</p>
    <div className="mt-4 space-y-3 text-sm text-slate-200">{children}</div>
  </div>
);

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-midnight text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 sm:px-6 lg:py-24">
        <div className="rounded-[40px] border border-white/10 bg-gradient-to-br from-indigoGlow/25 via-midnight to-aqua/10 p-10 shadow-[0_40px_120px_rgba(9,9,32,0.85)]">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-white/70">Sign up</p>
              <h1 className="mt-6 font-display text-4xl text-white sm:text-5xl">Start chatting with Sam</h1>
              <p className="mt-4 max-w-3xl text-lg text-slate-100">
                Everyone joins the same workspace — let us know how you plan to use it and we will wire up payouts, access,
                and guardrails so Sam can introduce you to the right humans within minutes.
              </p>
              <div className="mt-6 rounded-3xl border border-white/15 bg-white/5 p-5 text-sm text-slate-100">
                <p className="font-semibold uppercase tracking-[0.35em] text-white/70">Instant access</p>
                <p className="mt-3">Sign in with Google or grab a magic link directly from the actions panel.</p>
              </div>
            </div>
            <div className="rounded-[32px] border border-white/15 bg-midnight/70 p-6 shadow-[0_30px_70px_rgba(5,9,35,0.55)]">
              <SignupActions />
            </div>
          </div>
        </div>

        <section>
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">Who it’s for</p>
          <h2 className="mt-3 font-display text-3xl text-white">Pick how you want to use HumanChat</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {personas.map((persona) => (
              <Card key={persona.title} title={persona.title}>
                <ul className="space-y-3">
                  {persona.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-aqua" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">How onboarding works</p>
          <h2 className="mt-3 font-display text-3xl text-white">A lightweight, human-supervised flow</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-sm font-semibold text-white/80">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm text-slate-200">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">Need a hand?</p>
          <h2 className="mt-3 font-display text-3xl text-white">Pick the fast lane</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {actions.map((action) => (
              <div key={action.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.35em] text-white/60">{action.title}</p>
                <p className="mt-3 text-sm text-slate-200">{action.description}</p>
                {action.href.startsWith('/') ? (
                  <Link
                    href={action.href}
                    className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-6 py-2 text-sm font-semibold text-midnight transition hover:scale-105"
                  >
                    Go now
                  </Link>
                ) : (
                  <a
                    href={action.href}
                    className="mt-6 inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-white transition hover:border-white"
                  >
                    Contact Sam
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">Questions</p>
          <h2 className="mt-3 font-display text-3xl text-white">What to expect next</h2>
          <div className="mt-8 space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">{faq.q}</h3>
                <p className="mt-3 text-sm text-slate-200">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
