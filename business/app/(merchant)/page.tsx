'use client';

import { usePrivy } from '@privy-io/react-auth';
import { MotionConfig } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Aurora } from '@/components/aurora';
import { buttonClass, linkClass } from '@/components/button';
import { CountUp } from '@/components/count-up';
import { cx } from '@/components/cx';
import { Figure } from '@/components/figure';
import { GlassPanel, SpotlightPanel } from '@/components/glass-panel';
import { Magnetic } from '@/components/magnetic';
import { Marquee } from '@/components/marquee';
import { Reveal, RevealGroup, RevealItem } from '@/components/reveal';
import { SplitText } from '@/components/split-text';
import { Tilt } from '@/components/tilt';

/**
 * The one hand-written animation left on this page: the nonce tail draws
 * its own underline once, shortly after the hero settles.
 *
 * It stays hand-written rather than becoming another motion component
 * because it is the only element on the page whose animation is the
 * *argument* — the tail is what makes an invoice identifiable, and
 * underlining it is how the page says so before any prose does.
 */
const NONCE_UNDERLINE = `
  .nonce-rule {
    transform-origin: left center;
    transform: scaleX(1);
  }
  @media (prefers-reduced-motion: no-preference) {
    .nonce-rule {
      transform: scaleX(0);
      animation: draw-rule 620ms cubic-bezier(0.22, 1, 0.36, 1) 900ms forwards;
    }
    @keyframes draw-rule {
      to { transform: scaleX(1); }
    }
  }
`;

/**
 * Mirrors lib/payout-chains.ts, minus the "Testnet"/"Sepolia" suffixes
 * that belong in a settings dropdown rather than on a marquee. The
 * testnet caveat is stated once, in the footer, rather than nine times
 * in a scrolling row.
 */
const CHAINS = [
  'Ethereum',
  'Base',
  'Arbitrum',
  'Optimism',
  'Polygon',
  'Avalanche',
  'Unichain',
  'Linea',
  'Arc',
] as const;

/**
 * Six cells, and the wide ones widen only at `lg`. That combination is
 * what makes the grid tile with no holes at either breakpoint: two
 * columns take the cells 2-2-2 with no spans at all, three columns take
 * them 2+1, 1+2, 2+1. Five cells cannot do this — whichever way they are
 * ordered, a three-column row is left one cell short.
 */
const FEATURES = [
  {
    title: 'Non-custodial by construction',
    body: 'We never hold, request, or store your private key or your recovery phrase. Funds move from your customer into your wallet directly, and there is no step in the flow where your money is ours to lose.',
    wide: true,
  },
  {
    title: 'Every invoice signs itself',
    body: 'Each one carries four digits of its own in the sub-cent places, so an incoming transfer can only ever match a single invoice of yours.',
    wide: false,
  },
  {
    title: 'A link, or a square',
    body: 'Share an invoice as a URL or as a QR code on a counter. Your customer needs no account and no app to pay it.',
    wide: false,
  },
  {
    title: 'Pay the whole team in one pass',
    body: 'Payroll runs as a single batch out of the same wallet you get paid into, and each person can be paid on the chain they actually use.',
    wide: true,
  },
  {
    title: 'A name instead of an address',
    body: 'Register acme.eth so customers see a business rather than forty hex characters — then hand out finance.acme.eth and john.acme.eth to the people who work for you.',
    wide: true,
  },
  {
    title: 'Nothing to reconcile',
    body: 'Every invoice keeps its own timeline, from the moment you wrote it to the block that settled it.',
    wide: false,
  },
] as const;

const STEPS = [
  {
    title: 'Bring a wallet, or make one here',
    body: 'Connect the wallet you already use, or create one in the browser in a few seconds. Either way it is yours, and the keys never reach us.',
  },
  {
    title: 'Write the invoice',
    body: 'Enter the amount of USDC you want to end up with. That is the only decision the form asks you to make.',
  },
  {
    title: 'Send the link',
    body: 'Put it in an email, a message, or print the QR code for a counter. Your customer pays from whatever wallet and whatever token they already hold.',
  },
  {
    title: 'Watch it settle',
    body: 'The invoice flips to paid the moment Arc confirms the transfer, with its own timeline underneath. Nothing to match up by hand at the end of the week.',
  },
] as const;

export default function Home() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.replace('/dashboard');
  }, [ready, authenticated, router]);

  /**
   * The page is dark end to end, so every control here inverts its focus
   * ring: `accent` measures 3.20:1 on this ground and a ring nobody can
   * see is not a ring.
   *
   * It renders a span rather than a disabled button while Privy
   * initialises, because a disabled primary sits at `opacity-40`, which
   * on this ground all but erases the first thing a visitor sees. The
   * span keeps the button's footprint at full opacity and offers nothing
   * to click, which is the truth of that moment.
   */
  const cta = (label: string, size: 'sm' | 'md' | 'lg' = 'md', extra?: string) =>
    ready ? (
      <button onClick={login} className={buttonClass({ size, onDark: true, className: extra })}>
        {label}
      </button>
    ) : (
      <span
        aria-hidden="true"
        className={buttonClass({
          variant: 'glass',
          size,
          className: cx('cursor-default text-muted-inverse', extra),
        })}
      >
        Loading…
      </span>
    );

  return (
    /*
     * `reducedMotion="user"` is what makes every motion component on this
     * page honour the visitor's system preference, and it is the reason
     * none of them check that preference themselves. It suppresses
     * transform animations when they play rather than when they render,
     * so the markup is the same for everybody and there is no hydration
     * mismatch to pay for. Opacity still animates, which is intended: a
     * fade is not the thing reduced-motion settings exist to prevent.
     *
     * The shader and the marquee sit outside motion's reach and are
     * handled where they live — a matchMedia check in Aurora, a
     * no-preference media query around the marquee's keyframes.
     */
    <MotionConfig reducedMotion="user">
      <main className="relative flex-1 bg-canvas-inverse text-ink-inverse">
        <style>{NONCE_UNDERLINE}</style>

        {/* The pill nav floats over the shader rather than sitting on a bar
            of its own, so the hero reads as one uninterrupted field. */}
        <header className="sticky top-4 z-50 px-4">
          {/* glass-strong rather than glass: this bar passes over the hero's
              shader, over paragraphs and over lit panels, and at the
              lighter fill each of those showed through as a distinct patch
              behind the wordmark. */}
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-pill border border-glass-line-strong bg-glass-strong px-5 py-2.5 backdrop-blur-xl">
            <span className="flex items-center gap-2 text-subhead font-semibold tracking-tight">
              <img src="/yucarn-icon.png" alt="Yucarn" className="w-5 h-5 rounded-md object-cover shrink-0" />
              <span>
                Yucarn{' '}
                <span className="hidden font-normal text-muted-inverse sm:inline">for business</span>
              </span>
            </span>
            <div className="flex items-center gap-1">
              <a
                href="#features"
                className={cx(
                  linkClass('hidden px-3 py-1.5 text-body no-underline sm:inline-block'),
                  'text-muted-inverse hover:text-ink-inverse focus-visible:outline-accent-inverse',
                )}
              >
                Features
              </a>
              <a
                href="#how"
                className={cx(
                  linkClass('hidden px-3 py-1.5 text-body no-underline sm:inline-block'),
                  'text-muted-inverse hover:text-ink-inverse focus-visible:outline-accent-inverse',
                )}
              >
                How it works
              </a>
              <Magnetic className="ml-2">{cta('Connect wallet', 'sm', 'star-border')}</Magnetic>
            </div>
          </nav>
        </header>

        {/* ---------------------------------------------------------------
            The hero. Aurora behind, content in front, and the nav overlaps
            both — which is why this section carries the negative top margin
            rather than the header carrying a height.
            --------------------------------------------------------------- */}
        <section className="relative -mt-16 overflow-hidden pt-32">
          <Aurora className="h-[560px]" amplitude={1.1} blend={0.62} />

          {/* The ground fades back in under the aurora so the shader has an
              edge to end on instead of a hard horizontal line. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[300px] h-[300px] bg-linear-to-b from-transparent to-canvas-inverse"
          />

          <div className="relative mx-auto grid w-full max-w-5xl gap-14 px-6 pb-20 pt-10 lg:grid-cols-[1fr_minmax(0,23rem)] lg:items-center lg:pb-28">
            <div>
              <Reveal y={0}>
                <span className="inline-flex items-center gap-2 rounded-pill border border-glass-line bg-glass px-3 py-1.5 text-label uppercase text-muted-inverse backdrop-blur-xl">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-accent-inverse" />
                  Non-custodial · Settles on Arc
                </span>
              </Reveal>

              {/* 20ch, not 16: at 16 this headline set four lines of hero
                  type, which is a wall rather than an opening. Three is
                  the most a line this size can hold and still be read as
                  one sentence. */}
              <SplitText
                className="mt-7 max-w-[20ch] text-hero"
                text="One invoice. Any chain. Exactly what you asked for."
                highlight="Any chain."
                delay={0.15}
              />

              <Reveal delay={0.5}>
                <p className="mt-6 max-w-[52ch] text-lead text-muted-inverse">
                  Send a link. Your customer pays from the wallet and the token they already
                  hold. Yucarn routes it, converts it, and settles USDC on Arc in the wallet you
                  control — down to the cent.
                </p>
              </Reveal>

              <Reveal delay={0.62}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Magnetic>
                    {cta('Connect or create a wallet', 'lg', 'shadow-glow star-border')}
                  </Magnetic>
                  <a href="#how" className={buttonClass({ variant: 'glass', size: 'lg' })}>
                    See how it works
                  </a>
                </div>
              </Reveal>
            </div>

            {/* The payment request as the merchant's customer meets it. */}
            <Reveal delay={0.38} y={26}>
              <Tilt>
                <SpotlightPanel as="figure" padded={false} className="shadow-glow-soft">
                  <div className="p-7">
                    <figcaption className="text-body text-muted-inverse">Acme Corp</figcaption>
                    <Figure
                      size="lg"
                      tone="inverse"
                      className="mt-3"
                      amount={
                        <>
                          100.00
                          <span className="relative text-muted-inverse">
                            4417
                            <span
                              aria-hidden="true"
                              className="nonce-rule absolute -bottom-1.5 left-0 block h-px w-full bg-accent-inverse"
                            />
                          </span>
                        </>
                      }
                    />
                    <dl className="mt-7 space-y-2.5 border-t border-glass-line pt-5 text-body">
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-inverse">You asked for</dt>
                        <dd className="font-mono text-ink-inverse">100.00 USDC</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-inverse">Settles on</dt>
                        <dd className="text-ink-inverse">Arc</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-inverse">Customer needs</dt>
                        <dd className="text-ink-inverse">No account</dd>
                      </div>
                    </dl>
                  </div>
                </SpotlightPanel>
              </Tilt>
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-5xl px-6 pb-20">
          <Reveal>
            <p className="text-label uppercase text-muted-inverse">Your customer can pay from</p>
          </Reveal>
          <Marquee className="mt-5" items={CHAINS} />
        </section>

        {/* The conversion, stated as two figures and the arrow between them. */}
        <section className="mx-auto w-full max-w-5xl px-6 pb-24">
          <Reveal>
            <GlassPanel className="grid gap-10 p-8 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-8 lg:p-12">
              <div>
                <p className="text-label uppercase text-muted-inverse">They send</p>
                <p className="mt-3 font-mono text-display text-ink-inverse">
                  <CountUp to={0.031} decimals={3} />
                  <span className="align-baseline text-[0.42em] font-normal tracking-normal text-muted-inverse">
                    {' '}
                    ETH
                  </span>
                </p>
                <p className="mt-2 text-muted-inverse">on Base, from the wallet they already use</p>
              </div>

              <div
                aria-hidden="true"
                className="hidden h-px w-24 bg-linear-to-r from-glass-line via-accent-inverse to-glass-line sm:block"
              />

              <div>
                <p className="text-label uppercase text-muted-inverse">You receive</p>
                <p className="mt-3 font-mono text-display text-accent-inverse">
                  <CountUp to={100} decimals={2} />
                  <span className="align-baseline text-[0.42em] font-normal tracking-normal text-muted-inverse">
                    {' '}
                    USDC
                  </span>
                </p>
                <p className="mt-2 text-muted-inverse">on Arc, in the wallet you control</p>
              </div>
            </GlassPanel>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------------
            The bento. Cells light their own borders under the pointer, which
            is what keeps five panels reading as one surface.
            --------------------------------------------------------------- */}
        <section id="features" className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 pb-24">
          <Reveal>
            <h2 className="max-w-[20ch] text-title">
              Built for getting paid, not for holding your money
            </h2>
          </Reveal>

          <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <RevealItem key={feature.title} className={cx('h-full', feature.wide && 'lg:col-span-2')}>
                <SpotlightPanel as="article" className="h-full">
                  <h3 className="text-subhead text-ink-inverse">{feature.title}</h3>
                  {/* A wide cell gets a wider measure, but not an unbounded
                      one. Holding every cell to 42ch leaves the two-column
                      ones empty down their whole right half; letting them
                      run free set a 90-character line, which is past the
                      point where the eye reliably finds the next one. */}
                  <p
                    className={cx(
                      'mt-2.5 text-muted-inverse',
                      feature.wide ? 'max-w-[66ch]' : 'max-w-[42ch]',
                    )}
                  >
                    {feature.body}
                  </p>
                </SpotlightPanel>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* The tail, given its own quiet moment. It is the mechanism the
            whole product rests on, and it deserves more than a bullet. */}
        <section className="mx-auto w-full max-w-5xl px-6 pb-24">
          <Reveal>
            <div className="border-l-2 border-accent-inverse pl-6">
              <p className="max-w-[62ch] text-lead text-muted-inverse">
                Look again at the figure above:{' '}
                <span className="font-mono text-ink-inverse">100.00</span>
                <span className="font-mono text-accent-inverse">4417</span>. Those last four
                digits are the invoice&rsquo;s own, and they are how a transfer arriving on Arc
                finds the invoice it belongs to. The tail is always added and never subtracted,
                so the amount you asked for is the floor, not an estimate.
              </p>
            </div>
          </Reveal>
        </section>

        {/* --------------------------------------------------------------- */}
        <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 pb-24">
          <Reveal>
            <h2 className="text-title">Taking your first payment</h2>
          </Reveal>

          <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2" stagger={0.09}>
            {STEPS.map((step, index) => (
              <RevealItem key={step.title}>
                <SpotlightPanel as="article" className="h-full">
                  <span className="font-mono text-body text-accent-inverse">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 text-subhead text-ink-inverse">{step.title}</h3>
                  <p className="mt-2 max-w-[46ch] text-muted-inverse">{step.body}</p>
                </SpotlightPanel>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* The closing ask, over an echo of the hero's shader. */}
        <section className="relative overflow-hidden border-t border-glass-line">
          {/* Masked at both ends. The hero's shader can start hard against
              the top of the page because there is nothing above it; this
              one has a section above and a footer below, and without the
              fades it lands as two horizontal seams. */}
          <Aurora
            className="h-[320px] opacity-70 [mask-image:linear-gradient(to_bottom,transparent,#000_45%,transparent)]"
            amplitude={0.85}
            blend={0.75}
            speed={0.28}
          />

          <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-24 sm:flex-row sm:items-center sm:justify-between">
            <Reveal>
              <h2 className="max-w-[24ch] text-display">
                Your first invoice takes about a minute.
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <Magnetic>
                {cta('Connect or create a wallet', 'lg', 'shadow-glow star-border')}
              </Magnetic>
            </Reveal>
          </div>
        </section>

        <footer className="border-t border-glass-line">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-body text-muted-inverse">
            <span className="text-ink-inverse">Yucarn for Business</span>
            <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-accent-inverse" />
                Settling to USDC on Arc testnet
              </span>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noreferrer"
                className={cx(
                  linkClass(),
                  'text-accent-inverse focus-visible:outline-accent-inverse',
                )}
              >
                Arc explorer
              </a>
            </span>
          </div>
        </footer>
      </main>
    </MotionConfig>
  );
}
