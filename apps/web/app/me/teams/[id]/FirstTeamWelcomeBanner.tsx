"use client";

/**
 * Bannière d'accueil festive après création de la première équipe via
 * l'assistant d'onboarding.
 *
 * Déclenchée par le paramètre `?welcome=1` ajouté à la redirection
 * `/me/teams/[id]?welcome=1` en fin de wizard. Félicite le coach et met
 * en avant les prochaines actions (recruter des joueurs, exporter en PDF).
 *
 * À la fermeture, le paramètre `welcome` est retiré de l'URL pour ne pas
 * réafficher la bannière au rechargement — pas besoin de localStorage,
 * le paramètre n'apparaît qu'une fois juste après la création.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../../../contexts/LanguageContext";
import { EmblemCup, EmblemPdf, EmblemRosters } from "../../../components/home/NuffleArt";

interface FirstTeamWelcomeBannerProps {
  readonly teamId: string;
  readonly teamName?: string;
  /** Handler d'export PDF fourni par la page détail (optionnel). */
  readonly onExportPdf?: () => void;
}

export default function FirstTeamWelcomeBanner({
  teamId,
  teamName,
  onExportPdf,
}: FirstTeamWelcomeBannerProps): JSX.Element | null {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setVisible(params.get("welcome") === "1");
  }, []);

  const dismiss = (): void => {
    setVisible(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  };

  if (!visible) return null;

  const body = t.onboarding.welcomeBody.replace(
    "{team}",
    teamName ?? t.teams.team,
  );

  return (
    <div
      data-testid="first-team-welcome-banner"
      role="status"
      className="relative overflow-hidden rounded-2xl border border-nuffle-gold/60 bg-nuffle-anthracite px-5 py-4 text-nuffle-ivory shadow-lg font-body"
    >
      <button
        type="button"
        data-testid="welcome-banner-close"
        onClick={dismiss}
        aria-label={t.onboarding.close}
        className="absolute right-3 top-3 rounded-lg p-1 text-nuffle-ivory/70 transition hover:bg-white/10 hover:text-nuffle-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="flex items-start gap-4">
        <EmblemCup className="hidden h-12 w-12 shrink-0 text-nuffle-gold sm:block" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg sm:text-xl text-nuffle-gold">
            🎉 {t.onboarding.welcomeTitle}
          </h2>
          <p className="mt-1 text-sm text-nuffle-ivory/85">{body}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              data-testid="welcome-recruit"
              href={`/me/teams/${teamId}/edit`}
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 rounded-lg bg-nuffle-gold px-3.5 py-2 text-sm font-bold text-nuffle-anthracite shadow transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-ivory"
            >
              <EmblemRosters className="h-4 w-4" />
              {t.onboarding.welcomeRecruit}
            </Link>

            {onExportPdf && (
              <button
                type="button"
                data-testid="welcome-export"
                onClick={() => {
                  onExportPdf();
                  dismiss();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-nuffle-gold/60 px-3.5 py-2 text-sm font-semibold text-nuffle-ivory transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold"
              >
                <EmblemPdf className="h-4 w-4 text-nuffle-gold" />
                {t.onboarding.welcomeExport}
              </button>
            )}

            <button
              type="button"
              data-testid="welcome-dismiss"
              onClick={dismiss}
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-nuffle-ivory/70 underline-offset-2 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold"
            >
              {t.onboarding.welcomeDismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
