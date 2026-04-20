"use client";
import type { ReactNode } from "react";
import { useFeatureFlagContext } from "../contexts/FeatureFlagContext";
import { ONLINE_PLAY_FLAG } from "../lib/featureFlagKeys";
import { useLanguage } from "../contexts/LanguageContext";

interface OnlinePlayGateProps {
  children: ReactNode;
}

/**
 * Gate client-side pour toute la partie "Jouer en ligne".
 *
 * - Pendant le chargement des flags, affiche un écran neutre (évite le
 *   flash "indisponible" pour les admins ou utilisateurs autorisés).
 * - Si le flag `online_play` est actif pour l'utilisateur courant, rend
 *   `children`.
 * - Sinon affiche un écran "fonctionnalité indisponible".
 *
 * La sécurité réelle est assurée côté serveur par le middleware
 * `requireFeatureFlag("online_play")` sur /match et /matchmaking : ce
 * composant est cosmétique et n'autorise rien à lui seul.
 */
export function OnlinePlayGate({ children }: OnlinePlayGateProps) {
  const { flags, loading } = useFeatureFlagContext();
  const { language: lang } = useLanguage();

  if (loading) {
    return (
      <div
        data-testid="online-play-gate-loading"
        className="min-h-[60vh] flex items-center justify-center"
      >
        <div className="text-nuffle-anthracite/60 font-body">
          {lang === "en" ? "Loading..." : "Chargement..."}
        </div>
      </div>
    );
  }

  if (flags.has(ONLINE_PLAY_FLAG)) {
    return <>{children}</>;
  }

  return (
    <div
      data-testid="online-play-gate-disabled"
      className="min-h-[60vh] flex items-center justify-center px-4"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-nuffle-bronze/20 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-nuffle-bronze"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-heading font-bold text-nuffle-anthracite">
          {lang === "en"
            ? "Online play is not available"
            : "La partie en ligne n'est pas disponible"}
        </h1>
        <p className="text-nuffle-anthracite/70 font-body">
          {lang === "en"
            ? "This feature is currently disabled. Check back later."
            : "Cette fonctionnalité est actuellement désactivée. Revenez plus tard."}
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 rounded-lg bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          {lang === "en" ? "Back to home" : "Retour à l'accueil"}
        </a>
      </div>
    </div>
  );
}
