"use client";
import type { ReactNode } from "react";
import TeamLogo from "../TeamLogo";

/**
 * Carte de rencontre — la brique visuelle commune aux journées de ligue et
 * aux rondes de coupe.
 *
 * Lecture « affiche de match » : les deux équipes se font face de part et
 * d'autre d'un cartouche central qui porte le score (rencontre jouée) ou
 * un « VS » (à venir). Dessous, une ligne de statut (à jouer, prévu le…,
 * en attente de validation, forfait…) et les actions (feuille de match,
 * planification). Le vainqueur ressort en gras, le perdant s'estompe, et
 * la rencontre du coach connecté est mise en avant (« Mon match »).
 *
 * Composant PUREMENT présentationnel : aucun fetch, aucun i18n — les
 * libellés sont fournis par l'appelant, ce qui le rend réutilisable hors
 * ligue (coupes) et testable sans provider.
 */

export interface MatchCardTeam {
  readonly name: string;
  readonly roster: string;
  readonly logoUrl?: string | null;
  readonly coachName?: string | null;
  /** `data-testid` du bloc équipe (ex : `pairing-team-home`). */
  readonly testId?: string;
  /** `data-testid` du nom de coach. */
  readonly coachTestId?: string;
  /** Enveloppe du nom (lien vers le roster, etc.). Texte brut sinon. */
  readonly renderName?: (name: ReactNode) => ReactNode;
}

export type MatchCardTone =
  | "neutral"
  | "planned"
  | "live"
  | "pending"
  | "played"
  | "forfeit"
  | "cancelled";

export interface MatchCardStatus {
  readonly label: string;
  readonly tone: MatchCardTone;
  readonly testId?: string;
  readonly title?: string;
}

export interface MatchCardProps {
  readonly home: MatchCardTeam;
  /** `null` = équipe exemptée (bye) : pas d'adversaire ce tour. */
  readonly away: MatchCardTeam | null;
  /** Libellé affiché quand `away` est null (ex : « Exempt »). */
  readonly byeLabel?: string;
  /** Score déjà formaté (ex : « 2 – 1 ») ; absent = rencontre à venir. */
  readonly scoreLabel?: string | null;
  /** `data-testid` du cartouche de score. */
  readonly scoreTestId?: string;
  /** Vainqueur : dérivé du score si absent et que `scoreLabel` est « a – b ». */
  readonly winner?: "home" | "away" | "draw" | null;
  /** Texte du cartouche central sans score (défaut « VS »). */
  readonly centerLabel?: string;
  readonly status?: MatchCardStatus | null;
  /** Informations secondaires (date, échéance…), à côté du statut. */
  readonly meta?: ReactNode;
  /** Boutons / liens (feuille de match, planification…). */
  readonly actions?: ReactNode;
  /** Rencontre du coach connecté. */
  readonly highlighted?: boolean;
  readonly highlightLabel?: string;
  readonly testId?: string;
  /** Contenu additionnel sous la ligne de statut (détail des bonus…). */
  readonly children?: ReactNode;
}

const TONE_CLASSES: Record<MatchCardTone, string> = {
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
  planned: "bg-sky-50 text-sky-800 border-sky-200",
  live: "bg-amber-50 text-amber-800 border-amber-200",
  pending: "bg-indigo-50 text-indigo-800 border-indigo-200",
  played: "bg-emerald-50 text-emerald-800 border-emerald-200",
  forfeit: "bg-red-50 text-red-800 border-red-200",
  cancelled: "bg-gray-50 text-gray-500 border-gray-200 line-through",
};

/** « 2 – 1 » → vainqueur ; tout autre format → null. */
export function winnerFromScoreLabel(
  scoreLabel: string | null | undefined,
): "home" | "away" | "draw" | null {
  if (!scoreLabel) return null;
  const m = /^\s*(\d+)\s*[–-]\s*(\d+)\s*$/.exec(scoreLabel);
  if (!m) return null;
  const home = Number(m[1]);
  const away = Number(m[2]);
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

interface TeamCellProps {
  readonly team: MatchCardTeam;
  readonly side: "home" | "away";
  readonly emphasis: "winner" | "loser" | "neutral";
}

function TeamCell({ team, side, emphasis }: TeamCellProps) {
  const alignment =
    side === "home"
      ? "sm:flex-row-reverse sm:text-right"
      : "sm:flex-row sm:text-left";
  const nameClass =
    emphasis === "winner"
      ? "font-bold text-nuffle-anthracite"
      : emphasis === "loser"
        ? "font-medium text-gray-500"
        : "font-semibold text-nuffle-anthracite";
  const name = (
    <span className={`text-sm sm:text-base leading-tight break-words ${nameClass}`}>
      {team.name}
    </span>
  );
  return (
    <div
      data-testid={team.testId}
      data-emphasis={emphasis}
      className={`flex min-w-0 flex-col items-center gap-1.5 text-center sm:items-center sm:gap-3 ${alignment}`}
    >
      <TeamLogo
        slug={team.roster}
        logoUrl={team.logoUrl ?? null}
        size={40}
        title={team.name}
        className={`shrink-0 ${emphasis === "loser" ? "opacity-60" : ""}`}
      />
      <div className="min-w-0">
        {team.renderName ? team.renderName(name) : name}
        {team.coachName ? (
          <span
            data-testid={team.coachTestId}
            className="block truncate text-xs font-normal text-gray-500"
          >
            {team.coachName}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function MatchCard({
  home,
  away,
  byeLabel = "Exempt",
  scoreLabel = null,
  scoreTestId,
  winner,
  centerLabel = "VS",
  status,
  meta,
  actions,
  highlighted = false,
  highlightLabel = "Mon match",
  testId,
  children,
}: MatchCardProps) {
  const resolvedWinner = winner === undefined ? winnerFromScoreLabel(scoreLabel) : winner;
  const emphasisFor = (side: "home" | "away") =>
    resolvedWinner === null || resolvedWinner === "draw"
      ? "neutral"
      : resolvedWinner === side
        ? "winner"
        : "loser";
  const played = !!scoreLabel;
  const isBye = away === null;

  return (
    <li
      data-testid={testId}
      data-highlighted={highlighted ? "true" : undefined}
      className={`relative rounded-xl border p-3 transition-shadow sm:p-4 ${
        highlighted
          ? // `mt-2.5` : la pastille flotte au-dessus du bord superieur ; sans
            // marge, elle chevaucherait l'en-tete de poule qui precede.
            "mt-2.5 border-nuffle-gold/70 bg-nuffle-gold/5 shadow-[0_0_0_1px_rgba(203,161,53,0.35)]"
          : "border-gray-200 bg-white hover:shadow-sm"
      }`}
    >
      {highlighted ? (
        <span
          data-testid={testId ? `${testId}-mine` : undefined}
          className="absolute -top-2.5 left-3 rounded-full bg-nuffle-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
        >
          {highlightLabel}
        </span>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <TeamCell team={home} side="home" emphasis={emphasisFor("home")} />

        <div
          data-testid={scoreTestId}
          className={`flex min-w-[68px] items-center justify-center rounded-lg px-3 py-2 font-score text-2xl tracking-[0.15em] sm:min-w-[96px] sm:text-3xl ${
            played
              ? "bg-nuffle-anthracite text-white shadow-md"
              : "border border-dashed border-gray-300 bg-gray-50 text-lg text-gray-400 sm:text-xl"
          }`}
          aria-label={played ? scoreLabel ?? undefined : centerLabel}
        >
          {played ? scoreLabel : centerLabel}
        </div>

        {isBye ? (
          <div
            data-testid={testId ? `${testId}-bye` : undefined}
            className="flex min-w-0 flex-col items-center justify-center text-center text-sm font-medium italic text-gray-400"
          >
            {byeLabel}
          </div>
        ) : (
          <TeamCell team={away} side="away" emphasis={emphasisFor("away")} />
        )}
      </div>

      {status || meta || actions ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
          {status ? (
            <span
              data-testid={status.testId}
              title={status.title}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE_CLASSES[status.tone]}`}
            >
              {status.label}
            </span>
          ) : null}
          {meta}
          {actions}
        </div>
      ) : null}

      {children}
    </li>
  );
}
