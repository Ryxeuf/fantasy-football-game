"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "../auth-client";
import { useLanguage } from "../contexts/LanguageContext";
import { UMAMI_EVENTS, trackUmamiEvent } from "../lib/umami-events";

const KOFI_USERNAME = "nufflearena";
const KOFI_URL = `https://ko-fi.com/${KOFI_USERNAME}`;

function useKofiLinkCode(): {
  code: string | null;
  loading: boolean;
  isAuthenticated: boolean;
} {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;
    if (!token) {
      setLoading(false);
      return;
    }
    setIsAuthenticated(true);
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const linkCode: unknown = data?.user?.kofiLinkCode;
        if (typeof linkCode === "string") setCode(linkCode);
      })
      .catch(() => {
        /* ignore — pas bloquant pour la page /support */
      })
      .finally(() => setLoading(false));
  }, []);

  return { code, loading, isAuthenticated };
}

function KofiLinkCodeCard({
  code,
  loading,
  isAuthenticated,
  labels,
}: {
  code: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  labels: {
    title: string;
    description: string;
    copy: string;
    copied: string;
    anonHint: string;
  };
}) {
  const [justCopied, setJustCopied] = useState(false);

  if (loading) return null;

  if (!isAuthenticated || !code) {
    return (
      <div className="mt-8 max-w-2xl mx-auto rounded-xl border-2 border-nuffle-bronze/30 bg-nuffle-ivory/40 p-5 text-center">
        <p className="text-sm text-nuffle-anthracite/80 font-body">
          {labels.anonHint}
        </p>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setJustCopied(true);
      window.setTimeout(() => setJustCopied(false), 2000);
    } catch {
      /* clipboard permission refused — utilisateur peut copier à la main */
    }
  };

  return (
    <div className="mt-8 max-w-2xl mx-auto rounded-xl border-2 border-nuffle-gold/60 bg-white p-6 shadow-lg">
      <h3 className="font-heading font-bold text-lg text-nuffle-anthracite mb-2">
        {labels.title}
      </h3>
      <p className="text-sm text-nuffle-anthracite/80 font-body mb-4">
        {labels.description}
      </p>
      <div className="flex items-center gap-3">
        <code className="flex-1 px-4 py-3 rounded-lg bg-nuffle-anthracite/5 border border-nuffle-bronze/30 font-mono text-lg font-bold text-nuffle-anthracite tracking-widest text-center">
          {code}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-3 rounded-lg bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold transition-colors"
        >
          {justCopied ? labels.copied : labels.copy}
        </button>
      </div>
    </div>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function CoffeeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" />
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg className={`${className} transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-nuffle-bronze/20 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left font-subtitle font-semibold text-nuffle-anthracite hover:text-nuffle-gold transition-colors"
        aria-expanded={open}
      >
        <span>{question}</span>
        <ChevronIcon open={open} className="w-5 h-5 flex-shrink-0 ml-4" />
      </button>
      {open && (
        <p className="pb-4 text-nuffle-anthracite/80 font-body leading-relaxed">
          {answer}
        </p>
      )}
    </div>
  );
}

export default function SupportPage() {
  const { t } = useLanguage();
  const s = t.support;
  const { code, loading, isAuthenticated } = useKofiLinkCode();

  return (
    <div className="w-full min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-nuffle-anthracite via-nuffle-bronze to-nuffle-anthracite">
        <div className="w-full px-4 sm:px-6 py-12 sm:py-16 md:py-20 text-center">
          <HeartIcon className="w-12 h-12 sm:w-16 sm:h-16 text-nuffle-gold mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-nuffle-ivory">
            {s.title}
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-nuffle-ivory/80 font-body leading-relaxed">
            {s.subtitle}
          </p>
          <div className="mt-8">
            <a
              href={KOFI_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackUmamiEvent(UMAMI_EVENTS.SUPPORT_CTA, { placement: "hero" })
              }
              className="inline-flex items-center gap-2 px-8 py-4 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-lg"
            >
              <CoffeeIcon className="w-6 h-6" />
              {s.kofiButton}
            </a>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(203,161,53,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(107,78,46,0.15),transparent_40%)]" />
      </section>

      {/* Ko-fi embed section */}
      <section className="w-full px-4 sm:px-6 py-12 md:py-16">
        <div className="max-w-2xl mx-auto text-center">
          <CoffeeIcon className="w-10 h-10 text-nuffle-bronze mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-3">
            {s.kofiTitle}
          </h2>
          <p className="text-nuffle-anthracite/80 font-body mb-8">
            {s.kofiDescription}
          </p>
          <KofiLinkCodeCard
            code={code}
            loading={loading}
            isAuthenticated={isAuthenticated}
            labels={{
              title: s.linkCodeTitle,
              description: s.linkCodeDescription,
              copy: s.linkCodeCopy,
              copied: s.linkCodeCopied,
              anonHint: s.linkCodeAnonHint,
            }}
          />
          <div className="rounded-xl border-2 border-nuffle-bronze/30 bg-white p-6 shadow-lg mt-8">
            <iframe
              id="kofiframe"
              src={`https://ko-fi.com/${KOFI_USERNAME}/?hidefeed=true&widget=true&embed=true&preview=true`}
              className="w-full border-0"
              height="712"
              title="Ko-fi donations"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Why support us */}
      <section className="w-full px-4 sm:px-6 py-12 md:py-16 bg-gradient-to-b from-nuffle-ivory/50 to-white">
        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite text-center mb-10">
          {s.whyTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 p-6 hover:border-nuffle-gold/50 transition-all">
            <ShieldIcon className="w-10 h-10 text-nuffle-gold mb-3" />
            <h3 className="font-heading font-bold text-lg text-nuffle-anthracite mb-2">
              {s.whyFreedom}
            </h3>
            <p className="text-nuffle-anthracite/80 font-body text-sm">
              {s.whyFreedomDesc}
            </p>
          </div>
          <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 p-6 hover:border-nuffle-gold/50 transition-all">
            <ServerIcon className="w-10 h-10 text-nuffle-gold mb-3" />
            <h3 className="font-heading font-bold text-lg text-nuffle-anthracite mb-2">
              {s.whyServers}
            </h3>
            <p className="text-nuffle-anthracite/80 font-body text-sm">
              {s.whyServersDesc}
            </p>
          </div>
          <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 p-6 hover:border-nuffle-gold/50 transition-all">
            <CodeIcon className="w-10 h-10 text-nuffle-gold mb-3" />
            <h3 className="font-heading font-bold text-lg text-nuffle-anthracite mb-2">
              {s.whyDev}
            </h3>
            <p className="text-nuffle-anthracite/80 font-body text-sm">
              {s.whyDevDesc}
            </p>
          </div>
          <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 p-6 hover:border-nuffle-gold/50 transition-all">
            <UsersIcon className="w-10 h-10 text-nuffle-gold mb-3" />
            <h3 className="font-heading font-bold text-lg text-nuffle-anthracite mb-2">
              {s.whyCommunity}
            </h3>
            <p className="text-nuffle-anthracite/80 font-body text-sm">
              {s.whyCommunityDesc}
            </p>
          </div>
        </div>
      </section>

      {/* Financial Transparency */}
      <section className="w-full px-4 sm:px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite text-center mb-3">
            {s.transparencyTitle}
          </h2>
          <p className="text-center text-nuffle-anthracite/80 font-body mb-10">
            {s.transparencyDescription}
          </p>
          <div className="rounded-xl border-2 border-nuffle-bronze/30 bg-white shadow-lg overflow-hidden">
            <div className="divide-y divide-nuffle-bronze/20">
              <div className="flex items-center justify-between p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <ServerIcon className="w-6 h-6 text-nuffle-bronze" />
                  <span className="font-subtitle font-semibold text-nuffle-anthracite">{s.transparencyServers}</span>
                </div>
                <div className="w-32 sm:w-48 bg-nuffle-bronze/10 rounded-full h-3">
                  <div className="bg-nuffle-gold rounded-full h-3" style={{ width: "50%" }} />
                </div>
                <span className="text-sm font-body text-nuffle-anthracite/70 w-12 text-right">~50%</span>
              </div>
              <div className="flex items-center justify-between p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <ShieldIcon className="w-6 h-6 text-nuffle-bronze" />
                  <span className="font-subtitle font-semibold text-nuffle-anthracite">{s.transparencyDomain}</span>
                </div>
                <div className="w-32 sm:w-48 bg-nuffle-bronze/10 rounded-full h-3">
                  <div className="bg-nuffle-gold rounded-full h-3" style={{ width: "20%" }} />
                </div>
                <span className="text-sm font-body text-nuffle-anthracite/70 w-12 text-right">~20%</span>
              </div>
              <div className="flex items-center justify-between p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <CodeIcon className="w-6 h-6 text-nuffle-bronze" />
                  <span className="font-subtitle font-semibold text-nuffle-anthracite">{s.transparencyDev}</span>
                </div>
                <div className="w-32 sm:w-48 bg-nuffle-bronze/10 rounded-full h-3">
                  <div className="bg-nuffle-gold rounded-full h-3" style={{ width: "20%" }} />
                </div>
                <span className="text-sm font-body text-nuffle-anthracite/70 w-12 text-right">~20%</span>
              </div>
              <div className="flex items-center justify-between p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <UsersIcon className="w-6 h-6 text-nuffle-bronze" />
                  <span className="font-subtitle font-semibold text-nuffle-anthracite">{s.transparencyReserve}</span>
                </div>
                <div className="w-32 sm:w-48 bg-nuffle-bronze/10 rounded-full h-3">
                  <div className="bg-nuffle-gold rounded-full h-3" style={{ width: "10%" }} />
                </div>
                <span className="text-sm font-body text-nuffle-anthracite/70 w-12 text-right">~10%</span>
              </div>
            </div>
            <div className="bg-nuffle-ivory/50 p-4 sm:p-5">
              <p className="text-sm text-nuffle-anthracite/60 font-body italic text-center">
                {s.transparencyNote}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="w-full px-4 sm:px-6 py-12 md:py-16 bg-gradient-to-b from-nuffle-ivory/50 to-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite text-center mb-10">
            {s.faqTitle}
          </h2>
          <div className="rounded-xl border-2 border-nuffle-bronze/30 bg-white shadow-lg p-6">
            <FaqItem question={s.faqQ1} answer={s.faqA1} />
            <FaqItem question={s.faqQ2} answer={s.faqA2} />
            <FaqItem question={s.faqQ3} answer={s.faqA3} />
            <FaqItem question={s.faqQ4} answer={s.faqA4} />
            <FaqItem question={s.faqQ5} answer={s.faqA5} />
          </div>
        </div>
      </section>

      {/* Thank you + CTA */}
      <section className="w-full px-4 sm:px-6 py-12 md:py-16">
        <div className="max-w-2xl mx-auto rounded-2xl bg-gradient-to-br from-nuffle-anthracite via-nuffle-bronze to-nuffle-anthracite text-nuffle-ivory p-8 sm:p-12 text-center shadow-xl border-2 border-nuffle-bronze/50">
          <HeartIcon className="w-12 h-12 text-nuffle-gold mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-heading font-bold mb-3">
            {s.thanksTitle}
          </h2>
          <p className="text-nuffle-ivory/80 font-body mb-8">
            {s.thanksDescription}
          </p>
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackUmamiEvent(UMAMI_EVENTS.SUPPORT_CTA, { placement: "footer-cta" })
            }
            className="inline-flex items-center gap-2 px-8 py-4 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-lg"
          >
            <CoffeeIcon className="w-6 h-6" />
            {s.kofiButton}
          </a>
        </div>
      </section>

      {/* Legal note */}
      <section className="w-full px-4 sm:px-6 pb-12">
        <p className="text-center text-xs text-nuffle-anthracite/50 font-body max-w-2xl mx-auto">
          Nuffle Arena — {" "}
          <Link href="/legal/mentions-legales" className="hover:text-nuffle-gold hover:underline transition-colors">
            {t.footer.legalNotice}
          </Link>
          {" "} — {" "}
          <Link href="/legal/conditions-utilisation" className="hover:text-nuffle-gold hover:underline transition-colors">
            {t.footer.termsOfService}
          </Link>
        </p>
      </section>
    </div>
  );
}
