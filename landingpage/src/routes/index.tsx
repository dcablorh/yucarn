import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, Check, ExternalLink } from "lucide-react";
import yucarnLogo from "@/assets/yucarn-logo.png";
import yucarnIcon from "@/assets/yucarn-icon.png";
import { YucarnButton } from "@/components/YucarnButton";

// Build-time: Vite inlines both into the server and browser bundles alike, so
// the rendered HTML and hydration always agree. Changing either needs a
// rebuild. Written as plain property access because that is the only form Vite
// statically replaces.
const CLIENT_URL = import.meta.env.VITE_CLIENT_URL || "http://localhost:5173";
const BUSINESS_URL = import.meta.env.VITE_BUSINESS_URL || "http://localhost:3000";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yucarn | Move Stablecoins Across Networks" },
      { name: "description", content: "Send, receive, invoice, and pay teams in stablecoins across supported networks with Yucarn." },
      { property: "og:title", content: "Yucarn | Move Stablecoins Across Networks" },
      { property: "og:description", content: "One business. Multiple networks. One simple stablecoin payment experience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const capabilities = [
  "lets customers pay from the network they prefer",
  "send to any supported network",
  "receive stablecoins",
  "accepts payments from anywhere",
  "receive stablecoins on your preferred network",
  "pay with any supported wallet",
  "create and send invoices",
  "pay teams across multiple networks",
];

const activity = [
  ["Invoice #4821", "Northwind Co", "$12,400.00", "Settled"],
  ["Payment link", "Studio Bazaar", "$3,150.00", "Settled"],
  ["Team payout", "14 recipients", "$8,900.00", "Pending"],
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#top" className="flex items-center gap-2.5 group" aria-label="Yucarn home">
      <span className={`${compact ? "size-7 sm:size-8" : "size-9 sm:size-10"} overflow-hidden rounded-xl bg-primary/20 p-1 flex items-center justify-center border border-foreground/10 group-hover:scale-105 transition-transform shrink-0`}>
        <img src={yucarnIcon} alt="Yucarn Logo" className="size-full object-contain" />
      </span>
      <span className={`${compact ? "text-base" : "text-lg sm:text-xl"} font-bold tracking-tight text-foreground`}>Yucarn</span>
    </a>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-foreground/10 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[70px] max-w-[1440px] items-center justify-between px-3.5 sm:px-8 gap-2">
        <Brand />
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-2.5">
          <YucarnButton
            href={CLIENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="mint"
            className="!min-h-8 sm:!min-h-9 !px-2.5 xs:!px-3.5 sm:!px-4 !py-1 sm:!py-2 text-[11px] sm:text-xs font-semibold"
          >
            Personal <ExternalLink size={11} className="ml-0.5 sm:ml-1 inline" />
          </YucarnButton>
          <YucarnButton
            href={BUSINESS_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="ink"
            className="!min-h-8 sm:!min-h-9 !px-2.5 xs:!px-3.5 sm:!px-4 !py-1 sm:!py-2 text-[11px] sm:text-xs font-semibold"
          >
            Business <ExternalLink size={11} className="ml-0.5 sm:ml-1 inline" />
          </YucarnButton>
        </div>
      </div>
    </header>
  );
}

function Rail() {
  return (
    <div id="networks" className="mx-auto mt-14 w-full max-w-[1440px] sm:mt-20">
      <div className="relative h-32 overflow-hidden" aria-label="Stablecoins moving between supported networks">
        <div className="animate-pulse-line absolute inset-x-0 top-1/2 h-px bg-foreground/25" />
        {["left-0", "left-[33%]", "left-[66%]", "right-0"].map((pos, index) => <span key={pos} className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full ${pos} ${index === 1 || index === 2 ? "animate-gate bg-primary" : "bg-foreground"}`} />)}
        <span className="animate-ride absolute top-[42%] z-10 whitespace-nowrap rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">Stablecoins · $1,250.00</span>
        <span className="animate-ride absolute top-[58%] z-10 whitespace-nowrap rounded-full border border-foreground/15 bg-background px-3 py-1.5 text-xs font-semibold text-foreground" style={{ animationDelay: "3.5s" }}>Stablecoins · $40,000.00</span>
      </div>
      <div className="grid grid-cols-5 text-center text-[11px] font-semibold uppercase text-foreground/45 sm:text-xs">
        <span className="text-left">Ethereum</span><span>Base</span><span>Arbitrum</span><span>Polygon</span><span className="text-right">More</span>
      </div>
    </div>
  );
}

function CapabilityScroll() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-capability]");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset["capability"]));
    }), { rootMargin: "-42% 0px -42% 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-[.72fr_1.28fr] md:px-8 md:py-0">
        <div className="md:sticky md:top-0 md:flex md:h-screen md:items-center">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={yucarnIcon} alt="Yucarn Icon" className="size-8 object-contain" />
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Possibilities, simplified</p>
            </div>
            <p className="font-serif text-6xl italic text-secondary sm:text-8xl">Yucarn</p>
            <div className="mt-8 flex gap-2">{capabilities.map((_, i) => <span key={i} className={`h-1 w-6 transition-colors ${i === active ? "bg-secondary" : "bg-background/15"}`} />)}</div>
          </div>
        </div>
        <div>{capabilities.map((item, i) => <div data-capability={i} key={item} className="flex min-h-[42vh] items-center border-b border-background/10 py-14 last:border-0 md:min-h-[58vh]"><p className={`max-w-[19ch] font-serif text-4xl leading-tight transition-all duration-700 sm:text-5xl ${active === i ? "translate-y-0 text-background opacity-100" : "translate-y-4 text-background/25 opacity-60"}`}>{item}.</p></div>)}</div>
      </div>
    </section>
  );
}

function Index() {
  return (
    <main id="top">
      <Header />
      <section className="flex min-h-[92vh] flex-col justify-center px-5 pb-10 pt-32 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="animate-rise inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
            <img src={yucarnIcon} alt="Yucarn Icon" className="size-4 object-contain" />
            <span>Cross-network stablecoin payments</span>
          </div>
          <h1 className="mt-5 max-w-[15ch] text-balance font-serif text-[clamp(3.2rem,7vw,6.7rem)] leading-[.94] text-foreground">
            <span className="animate-rise block">Money that moves</span><span className="animate-rise block italic text-primary" style={{ animationDelay: "100ms" }}>across networks.</span>
          </h1>
          <p className="animate-rise mt-7 max-w-[58ch] text-pretty text-base leading-relaxed text-foreground/65 sm:text-lg" style={{ animationDelay: "180ms" }}>Send, receive, and accept stablecoins across supported blockchain networks. No manual bridging. No network switching. Just stablecoins, sent where they need to go.</p>
          <div className="animate-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "260ms" }}>
            <YucarnButton href={CLIENT_URL} target="_blank" rel="noopener noreferrer">
              Send stablecoins <ArrowRight size={16} className="ml-1 inline" />
            </YucarnButton>
            <YucarnButton href={BUSINESS_URL} target="_blank" rel="noopener noreferrer" variant="outline">
              Yucarn for business
            </YucarnButton>
          </div>
        </div>
        <Rail />
        <a href="#promise" className="mx-auto mt-5 flex items-center gap-2 text-xs font-semibold text-foreground/45">Explore <ArrowDown size={14} /></a>
      </section>

      <section id="promise" className="border-y border-foreground/10 px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div>
            <p className="max-w-[25ch] font-serif text-4xl leading-tight sm:text-6xl">One payment. <span className="italic text-primary">Any supported network.</span></p>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-foreground/60">The sender chooses the destination network. The recipient provides their address. You choose the amount. Yucarn handles the rest.</p>
          </div>
          <div className="shrink-0 p-6 rounded-2xl border border-foreground/10 bg-background/50 backdrop-blur-sm max-w-xs flex flex-col items-center text-center">
            <img src={yucarnLogo} alt="Yucarn Logo" className="h-14 object-contain mb-3" />
            <p className="text-xs text-foreground/60 font-medium">Universal Stablecoin Cross-Chain Settlement Engine</p>
          </div>
        </div>
      </section>

      <CapabilityScroll />

      <section className="grid lg:grid-cols-2">
        <article id="personal" className="px-5 py-20 sm:px-10 lg:px-[max(3rem,calc((100vw-72rem)/2))] lg:py-28">
          <p className="text-xs font-semibold uppercase text-primary">01 · For individuals</p>
          <h2 className="mt-5 max-w-[13ch] font-serif text-5xl leading-tight">Send stablecoins without the network work.</h2>
          <p className="mt-5 max-w-lg leading-relaxed text-foreground/65">Send to friends, family, clients, and anyone else. Choose where they want to receive, enter their wallet address and amount, and Yucarn handles the transfer.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {["Pay with any supported wallet", "Send to the recipient’s preferred network", "No bridges or manual network switching"].map(x => <li key={x} className="flex items-center gap-3"><Check size={15} className="text-primary" />{x}</li>)}
          </ul>
          <YucarnButton href={CLIENT_URL} target="_blank" rel="noopener noreferrer" className="mt-9">
            Start sending <ArrowRight size={16} className="ml-1 inline" />
          </YucarnButton>
        </article>
        <article id="business" className="border-t border-foreground/10 bg-muted px-5 py-20 sm:px-10 lg:border-l lg:border-t-0 lg:px-[max(3rem,calc((100vw-72rem)/2))] lg:py-28">
          <p className="text-xs font-semibold uppercase text-primary">02 · For businesses</p>
          <h2 className="mt-5 max-w-[14ch] font-serif text-5xl leading-tight">Payment infrastructure that grows with you.</h2>
          <p className="mt-5 max-w-lg leading-relaxed text-foreground/65">Accept stablecoins from customers, receive funds on your preferred network, create invoices, and pay teams across networks—all from one place.</p>
          <div className="mt-9 overflow-hidden rounded-lg bg-foreground text-background">
            <div className="flex justify-between border-b border-background/10 px-5 py-4 text-xs text-background/60"><span>Payment activity</span><span>Live</span></div>
            {activity.map(([type,name,amount,status]) => <div key={type} className="grid grid-cols-[1fr_auto] gap-3 border-b border-background/10 px-5 py-4 last:border-0"><div><p className="text-sm">{type}</p><p className="text-xs text-background/45">{name}</p></div><div className="text-right"><p className="text-sm">{amount}</p><p className={status === "Settled" ? "text-xs text-secondary" : "text-xs text-background/45"}>{status}</p></div></div>)}
          </div>
          <YucarnButton href={BUSINESS_URL} target="_blank" rel="noopener noreferrer" variant="ink" className="mt-9">
            Explore business payments <ArrowRight size={16} className="ml-1 inline" />
          </YucarnButton>
        </article>
      </section>

      <section id="how" className="bg-secondary/25 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase text-primary">One simple payment experience</p>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {[["01","Choose the network","Select where your recipient wants the stablecoins to arrive."],["02","Enter the details","Add their wallet address and the amount you want to send."],["03","Yucarn handles it","Your payment moves across supported networks—without the busywork."]].map(([n,t,d]) => <div key={n} className="border-t border-foreground/20 pt-5"><span className="font-serif text-3xl text-primary">{n}</span><h3 className="mt-5 font-serif text-2xl">{t}</h3><p className="mt-2 text-sm leading-relaxed text-foreground/60">{d}</p></div>)}
          </div>
        </div>
      </section>

      <section id="start" className="bg-foreground px-5 py-24 text-background sm:px-8 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase text-secondary">Built for modern payments</p>
          <h2 className="mt-5 max-w-[18ch] font-serif text-5xl leading-tight sm:text-6xl">One business. Multiple networks. One simple experience.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-lg border border-background/15 p-7 sm:p-9">
              <p className="text-xs font-semibold uppercase text-secondary">For individuals</p>
              <p className="mt-5 font-serif text-3xl">Move stablecoins wherever they need to go.</p>
              <p className="mt-3 text-sm text-background/55">Simple transfers across supported networks.</p>
              <YucarnButton href={CLIENT_URL} target="_blank" rel="noopener noreferrer" className="mt-7">
                Start sending <ArrowRight size={16} className="ml-1 inline" />
              </YucarnButton>
            </div>
            <div className="rounded-lg border border-background/15 p-7 sm:p-9">
              <p className="text-xs font-semibold uppercase text-secondary">For businesses</p>
              <p className="mt-5 font-serif text-3xl">Accept payments. Pay teams. Stay organized.</p>
              <p className="mt-3 text-sm text-background/55">Infrastructure for cross-network stablecoin operations.</p>
              <YucarnButton href={BUSINESS_URL} target="_blank" rel="noopener noreferrer" variant="light" className="mt-7">
                Start with Yucarn Merchant <ExternalLink size={14} className="ml-1 inline" />
              </YucarnButton>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-foreground/10 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-7 text-sm text-foreground/50 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Brand compact />
            <span>Stablecoins, sent where they need to go.</span>
          </div>
          <div className="flex flex-wrap gap-6">
            <a href="#personal" className="hover:text-foreground">Personal</a>
            <a href="#business" className="hover:text-foreground">Business</a>
            <a href="#networks" className="hover:text-foreground">Networks</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href={CLIENT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-primary font-medium">Launch App</a>
            <a href={BUSINESS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-primary font-medium">Merchant Dashboard</a>
          </div>
          <span>© 2026 Yucarn</span>
        </div>
      </footer>
    </main>
  );
}