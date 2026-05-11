"use client";

/**
 * Sprint O — Lot O.B.3 : modal d'onboarding post-signup.
 *
 * Affiche un modal welcome avec 3 CTAs quand un nouveau coach
 * arrive sur /me/teams pour la 1ere fois :
 *
 *   - Conditions : `createdAt < 24h` ET `teams.length === 0` ET pas
 *     deja "dismiss" (flag localStorage `onboarding_dismissed_v1`).
 *   - 3 CTAs : "Creer mon equipe" (lien /me/teams/new), "Faire le
 *     tutoriel" (lien /tutoriel), "Voir la Pro League" (lien
 *     /pro-league).
 *   - Skip / X : ferme + flag localStorage pour eviter re-affichage.
 *
 * Avant Lot O.B.3, un nouveau coach atterrissait sur /me/teams vide
 * sans guidance → 40% bounce day-0 estime.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "onboarding_dismissed_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface OnboardingModalProps {
  /** Date ISO du `createdAt` du user. Si null, le modal ne s'affiche pas. */
  readonly userCreatedAt: string | null | undefined;
  /** Nombre d'equipes de l'user. Modal seulement si 0. */
  readonly teamsCount: number;
}

export default function OnboardingModal({
  userCreatedAt,
  teamsCount,
}: OnboardingModalProps): JSX.Element | null {
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userCreatedAt) return;
    if (teamsCount > 0) return;

    // Skip si deja dismiss.
    const dismissed = window.localStorage.getItem(DISMISS_KEY);
    if (dismissed === "1") return;

    // Skip si compte trop ancien (> 24h).
    const createdMs = new Date(userCreatedAt).getTime();
    if (Number.isNaN(createdMs)) return;
    if (Date.now() - createdMs > MAX_AGE_MS) return;

    setOpen(true);
  }, [userCreatedAt, teamsCount]);

  const dismiss = (): void => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      data-testid="onboarding-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          data-testid="onboarding-close"
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <h2
          id="onboarding-title"
          className="mb-2 text-2xl font-bold text-slate-900"
        >
          Bienvenue dans l'arène, coach !
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          Trois façons de démarrer ton aventure Blood Bowl. Choisis celle qui
          te tente le plus — tu pourras revenir aux autres après.
        </p>

        <div className="space-y-3">
          <Link
            data-testid="onboarding-cta-team"
            href="/me/teams/new"
            onClick={dismiss}
            className="flex items-center gap-3 rounded-lg border border-emerald-600 bg-emerald-50 p-4 text-left transition hover:bg-emerald-100"
          >
            <span className="text-2xl" aria-hidden="true">
              🛡️
            </span>
            <div className="flex-1">
              <div className="font-semibold text-emerald-900">
                Crée ta première équipe
              </div>
              <div className="text-xs text-emerald-700">
                30 races jouables · Builder visuel · 1000kPo de budget de
                base
              </div>
            </div>
            <span className="text-emerald-700" aria-hidden="true">
              →
            </span>
          </Link>

          <Link
            data-testid="onboarding-cta-tutorial"
            href="/tutoriel"
            onClick={dismiss}
            className="flex items-center gap-3 rounded-lg border border-sky-600 bg-sky-50 p-4 text-left transition hover:bg-sky-100"
          >
            <span className="text-2xl" aria-hidden="true">
              📖
            </span>
            <div className="flex-1">
              <div className="font-semibold text-sky-900">
                Apprends les règles
              </div>
              <div className="text-xs text-sky-700">
                Tutoriel interactif : block, dodge, GFI, casualties — en 10
                min
              </div>
            </div>
            <span className="text-sky-700" aria-hidden="true">
              →
            </span>
          </Link>

          <Link
            data-testid="onboarding-cta-pro-league"
            href="/pro-league"
            onClick={dismiss}
            className="flex items-center gap-3 rounded-lg border border-amber-600 bg-amber-50 p-4 text-left transition hover:bg-amber-100"
          >
            <span className="text-2xl" aria-hidden="true">
              🏆
            </span>
            <div className="flex-1">
              <div className="font-semibold text-amber-900">
                Suis la Pro League
              </div>
              <div className="text-xs text-amber-700">
                16 équipes IA, matchs live mardi 21h, paris en Crowns +
                Gazette quotidienne
              </div>
            </div>
            <span className="text-amber-700" aria-hidden="true">
              →
            </span>
          </Link>
        </div>

        <button
          data-testid="onboarding-skip"
          onClick={dismiss}
          className="mt-5 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
