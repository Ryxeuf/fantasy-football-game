"use client";
import type { ReactNode } from "react";
import { useFeatureFlagContext } from "../contexts/FeatureFlagContext";
import { LEAGUE_FLAG } from "../lib/featureFlagKeys";
import { useLanguage } from "../contexts/LanguageContext";

interface LeagueGateProps {
  children: ReactNode;
}

/**
 * Gate client-side pour la brique "Ligue" (gestion de ligue Blood Bowl).
 *
 * Miroir d'`OnlinePlayGate` mais sur le flag dédié `league` : la ligue a son
 * propre flag pour pouvoir être activée indépendamment d'`online_play`.
 *
 * - Pendant le chargement des flags : écran neutre (évite le flash
 *   "indisponible").
 * - Flag `league` actif → rend `children`.
 * - Sinon → écran "fonctionnalité indisponible".
 *
 * Cosmétique : la sécurité réelle resterait côté serveur si/quand un
 * middleware `requireFeatureFlag("league")` est ajouté sur /leagues.
 */
export function LeagueGate({ children }: LeagueGateProps) {
  const { flags, loading } = useFeatureFlagContext();
  const { language: lang } = useLanguage();

  if (loading) {
    return (
      <div
        data-testid="league-gate-loading"
        className="min-h-[60vh] flex items-center justify-center"
      >
        <div className="text-nuffle-anthracite/60 font-body">
          {lang === "en" ? "Loading..." : "Chargement..."}
        </div>
      </div>
    );
  }

  if (flags.has(LEAGUE_FLAG)) {
    return <>{children}</>;
  }

  return (
    <div
      data-testid="league-gate-disabled"
      className="min-h-[60vh] flex items-center justify-center px-4"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-nuffle-bronze/20 flex items-center justify-center">
          <span className="text-3xl" aria-hidden="true">
            🏅
          </span>
        </div>
        <h1 className="text-2xl font-heading font-bold text-nuffle-anthracite">
          {lang === "en"
            ? "Leagues are not available"
            : "Les ligues ne sont pas disponibles"}
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
