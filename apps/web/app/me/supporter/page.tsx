"use client";

/**
 * Sprint R — Lot R.B.3 : page supporter (ad-free + early access).
 *
 * Affiche le statut supporter du user (tier, activeUntil, source) et
 * la liste des benefits. Si pas supporter, affiche un message CTA
 * vers la page de don Kofi (env `NEXT_PUBLIC_KOFI_URL`).
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";

interface SupporterBenefit {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

interface SupporterStatus {
  readonly isSupporter: boolean;
  readonly tier: string | null;
  readonly activeUntil: string | null;
  readonly source: "admin_override" | "kofi" | "patreon" | null;
  readonly benefits: readonly SupporterBenefit[];
}

const KOFI_URL =
  process.env.NEXT_PUBLIC_KOFI_URL ?? "https://ko-fi.com/nufflearena";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function SupporterPage(): JSX.Element {
  const [status, setStatus] = useState<SupporterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<SupporterStatus>("/me/supporter")
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur reseau"));
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Supporter</h1>
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      </main>
    );
  }

  if (status === null) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Supporter</h1>
        <p className="text-sm text-slate-400">Chargement…</p>
      </main>
    );
  }

  if (!status.isSupporter) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-2 text-2xl font-bold">Devenir supporter</h1>
        <p className="mb-4 text-sm text-slate-300">
          Soutiens le projet et debloque des avantages exclusifs.
        </p>
        <section
          data-testid="supporter-benefits-list"
          className="mb-6 space-y-3"
        >
          {[
            {
              id: "ad_free",
              label: "Ad-free",
              description:
                "Aucune banniere publicitaire. Le site reste vierge de pub pour les supporters.",
            },
            {
              id: "early_replay",
              label: "Acces replays anticipe",
              description:
                "Replays archives accessibles jusqu'a 7 jours avant les free users.",
            },
            {
              id: "profile_badge",
              label: "Badge supporter",
              description:
                "Flair distinctif sur ton profil coach + dans la Gazette.",
            },
          ].map((b) => (
            <article
              key={b.id}
              className="rounded border border-slate-800 bg-slate-900 p-3"
            >
              <h3 className="text-base font-semibold text-slate-100">
                {b.label}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{b.description}</p>
            </article>
          ))}
        </section>
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="supporter-cta-kofi"
          className="inline-flex rounded bg-emerald-700 px-4 py-2 text-sm text-emerald-50 hover:bg-emerald-600"
        >
          Soutenir sur Ko-fi
        </a>
        <p className="mt-4 text-xs text-slate-500">
          <Link href="/support" className="underline">
            En savoir plus sur le projet
          </Link>
        </p>
      </main>
    );
  }

  const activeUntilFr = formatDate(status.activeUntil);
  const isAdminGift = status.source === "admin_override";

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Tu es supporter</h1>
      <div
        data-testid="supporter-active-badge"
        className="mb-4 rounded border border-emerald-700 bg-emerald-900/30 p-3 text-sm"
      >
        <p className="font-semibold text-emerald-200">
          Statut actif{status.tier ? ` — ${status.tier}` : ""}
        </p>
        {isAdminGift ? (
          <p className="mt-1 text-emerald-300">
            Cadeau de l'equipe Nuffle Arena.
          </p>
        ) : activeUntilFr ? (
          <p className="mt-1 text-emerald-300">
            Actif jusqu'au {activeUntilFr}.
          </p>
        ) : null}
      </div>

      <h2 className="mb-2 text-lg font-semibold text-slate-100">Tes avantages</h2>
      <ul data-testid="supporter-benefits-list" className="space-y-2">
        {status.benefits.map((b) => (
          <li
            key={b.id}
            data-testid={`supporter-benefit-${b.id}`}
            className="rounded border border-slate-800 bg-slate-900 p-3"
          >
            <h3 className="text-base font-semibold text-slate-100">{b.label}</h3>
            <p className="mt-1 text-sm text-slate-400">{b.description}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-slate-500">
        <Link href="/support" className="underline">
          Page de don Ko-fi
        </Link>
      </p>
    </main>
  );
}
