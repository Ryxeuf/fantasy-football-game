"use client";
import type { ReactNode } from "react";
import { useFeatureFlagContext } from "../contexts/FeatureFlagContext";
import { OFFLINE_MATCH_FLAG } from "../lib/featureFlagKeys";
import { useLanguage } from "../contexts/LanguageContext";

interface OfflineMatchGateProps {
  children: ReactNode;
}

/**
 * Gate client-side de la brique « partie offline » (`/local-matches`).
 *
 * Miroir d'`OnlinePlayGate` / `LeagueGate` sur le flag `offline_match`, OFF
 * par défaut : la saisie d'un résultat passe par la feuille de match. L'écran
 * de repli le DIT plutôt que de renvoyer à l'accueil sans explication — un
 * coach qui arrive par un signet doit savoir où saisir son match.
 *
 * La sécurité réelle est côté serveur (`requireFeatureFlag("offline_match")`
 * sur `/local-match`) : ce composant est cosmétique et n'autorise rien.
 */
export function OfflineMatchGate({ children }: OfflineMatchGateProps) {
  const { flags, loading } = useFeatureFlagContext();
  const { language: lang } = useLanguage();

  if (loading) {
    return (
      <div
        data-testid="offline-match-gate-loading"
        className="min-h-[60vh] flex items-center justify-center"
      >
        <div className="text-nuffle-anthracite/60 font-body">
          {lang === "en" ? "Loading..." : "Chargement..."}
        </div>
      </div>
    );
  }

  if (flags.has(OFFLINE_MATCH_FLAG)) {
    return <>{children}</>;
  }

  return (
    <div
      data-testid="offline-match-gate-disabled"
      className="min-h-[60vh] flex items-center justify-center px-4"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-nuffle-bronze/20 flex items-center justify-center">
          <span className="text-3xl" aria-hidden="true">
            🎮
          </span>
        </div>
        <h1 className="text-2xl font-heading font-bold text-nuffle-anthracite">
          {lang === "en"
            ? "Offline matches are not available"
            : "Les parties offline ne sont pas disponibles"}
        </h1>
        <p className="text-nuffle-anthracite/70 font-body">
          {lang === "en"
            ? "This feature is currently disabled. A league or cup result is recorded on the match sheet of the fixture."
            : "Cette fonctionnalité est actuellement désactivée. Un résultat de ligue ou de coupe se saisit sur la feuille de match de la rencontre."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="/leagues"
            data-testid="offline-match-gate-leagues"
            className="inline-block px-6 py-3 rounded-lg bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            {lang === "en" ? "My competitions" : "Mes compétitions"}
          </a>
          <a
            href="/"
            className="inline-block px-6 py-3 rounded-lg border border-nuffle-bronze/40 text-nuffle-anthracite font-subtitle font-semibold hover:bg-nuffle-bronze/10 transition-all"
          >
            {lang === "en" ? "Back to home" : "Retour à l'accueil"}
          </a>
        </div>
      </div>
    </div>
  );
}
