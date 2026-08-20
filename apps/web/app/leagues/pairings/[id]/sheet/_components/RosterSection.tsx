"use client";

import { useMemo, useState } from "react";
import {
  TEAM_ROSTERS_BY_RULESET,
  DEFAULT_RULESET,
  type Ruleset,
} from "@bb/game-engine";
import SkillTooltip from "../../../../../me/teams/components/SkillTooltip";
import type { SheetJourneyman, SheetPlayer } from "./MatchSheetPanels";

// ---------------------------------------------------------------------------
// E11 — roster « version du match » (snapshot figé à la 1re soumission).
// ---------------------------------------------------------------------------

export interface SnapshotPlayerView {
  name: string;
  /** Poste lisible quand on le connaît, slug sinon. */
  position: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  spp: number;
}

/** Parse tolérant (JSON string PG/sqlite ou objet natif). */
export function parseRosterSnapshot(raw: unknown): {
  capturedAt?: number;
  roster?: string;
  ruleset?: string;
  players: SnapshotPlayerView[];
} | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const players = (obj as { players?: unknown }).players;
  if (!Array.isArray(players)) return null;
  const o = obj as { capturedAt?: number; roster?: unknown; ruleset?: unknown };
  return {
    capturedAt: o.capturedAt,
    roster: typeof o.roster === "string" ? o.roster : undefined,
    ruleset: typeof o.ruleset === "string" ? o.ruleset : undefined,
    players: players as SnapshotPlayerView[],
  };
}

/**
 * Noms de poste lisibles pour un roster/ruleset donnés (le snapshot stocke
 * les SLUGS de position). Fallback : la valeur brute (déjà lisible pour la
 * vue live et les journaliers).
 */
export function positionNameResolver(
  roster: string | undefined,
  ruleset: string | undefined,
): (position: string) => string {
  const rs = (ruleset as Ruleset) ?? DEFAULT_RULESET;
  const map =
    TEAM_ROSTERS_BY_RULESET[rs] ?? TEAM_ROSTERS_BY_RULESET[DEFAULT_RULESET];
  const def = roster
    ? (
        map as Record<
          string,
          { positions?: ReadonlyArray<{ slug: string; displayName: string }> }
        >
      )[roster]
    : undefined;
  const names = new Map<string, string>();
  for (const p of def?.positions ?? []) names.set(p.slug, p.displayName);
  return (position: string) => names.get(position) ?? position;
}

/**
 * Roster courant (tel que chargé par la feuille) ramené à la même vue que
 * le snapshot. Les joueurs sortis du roster (morts, licenciés) et les
 * absents (missNextMatch : ils ratent CE match) ne font pas partie de
 * l'équipe qui va jouer : on ne les liste pas.
 */
export function livePlayersToView(
  players: readonly SheetPlayer[] | undefined,
  journeymen: readonly SheetJourneyman[] = [],
): SnapshotPlayerView[] | null {
  if ((!players || players.length === 0) && journeymen.length === 0) {
    return null;
  }
  return [
    ...(players ?? [])
      .filter((p) => !p.dead && !p.missNextMatch)
      .map((p) => ({
        name: p.name,
        position: p.positionName ?? p.position,
        number: p.number,
        ma: p.stats?.ma ?? 0,
        st: p.stats?.st ?? 0,
        ag: p.stats?.ag ?? 0,
        pa: p.stats?.pa ?? null,
        av: p.stats?.av ?? 0,
        skills: p.skills ?? "",
        spp: p.spp,
      })),
    // Journaliers dérivés (équipe à moins de 11 joueurs disponibles).
    ...journeymen.map((j) => ({
      name: j.name,
      position: j.positionName,
      number: j.number,
      ma: j.stats?.ma ?? 0,
      st: j.stats?.st ?? 0,
      ag: j.stats?.ag ?? 0,
      pa: j.stats?.pa ?? null,
      av: j.stats?.av ?? 0,
      skills: j.skills ?? "",
      spp: 0,
    })),
  ];
}

/**
 * Roster d'une équipe, consultable depuis la feuille par les deux coachs
 * (et le commissaire) — y compris celui de l'adversaire.
 *
 * Deux états possibles :
 *  - la « version du match » quand le snapshot existe (figé à la 1re
 *    soumission, cf. E11) : c'est la référence pour ce match ;
 *  - à défaut, le roster COURANT de l'équipe, explicitement annoncé comme
 *    non figé. Sans ce repli, l'adversaire ne pouvait rien consulter tant
 *    que personne n'avait soumis, c'est-à-dire pendant toute la
 *    préparation du match.
 */
export function RosterSection({
  label,
  raw,
  livePlayers,
  journeymen,
}: {
  label: string;
  raw: unknown;
  livePlayers?: readonly SheetPlayer[];
  /** Journaliers dérivés — inclus dans la vue « état actuel ». */
  journeymen?: readonly SheetJourneyman[];
}) {
  const [open, setOpen] = useState(false);
  const snapshot = useMemo(() => parseRosterSnapshot(raw), [raw]);
  const live = useMemo(
    () => (snapshot ? null : livePlayersToView(livePlayers, journeymen ?? [])),
    [snapshot, livePlayers, journeymen],
  );
  const positionName = useMemo(
    () => positionNameResolver(snapshot?.roster, snapshot?.ruleset),
    [snapshot?.roster, snapshot?.ruleset],
  );
  const players = snapshot?.players ?? live;
  if (!players || players.length === 0) return null;

  const heading = snapshot
    ? `Roster de ${label} — version du match${
        snapshot.capturedAt
          ? ` (figé le ${new Date(snapshot.capturedAt).toLocaleDateString("fr-FR")})`
          : ""
      }`
    : `Roster de ${label} — état actuel (figé à la 1re soumission)`;

  return (
    <div className="rounded border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={`snapshot-roster-toggle-${label}`}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-700"
      >
        <span>{heading}</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full text-xs">
            <thead className="text-left uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-1 py-1">N°</th>
                <th className="px-1 py-1">Nom</th>
                <th className="px-1 py-1">Poste</th>
                <th className="px-1 py-1">M</th>
                <th className="px-1 py-1">F</th>
                <th className="px-1 py-1">AG</th>
                <th className="px-1 py-1">CP</th>
                <th className="px-1 py-1">AR</th>
                <th className="px-1 py-1">Compétences</th>
                <th className="px-1 py-1">PSP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...players]
                .sort((a, b) => a.number - b.number)
                .map((p) => (
                  <tr key={`${p.number}-${p.name}`}>
                    <td className="px-1 py-1 font-mono">{p.number}</td>
                    <td className="px-1 py-1 font-medium">{p.name}</td>
                    <td className="px-1 py-1 text-slate-500">
                      {positionName(p.position)}
                    </td>
                    <td className="px-1 py-1 tabular-nums">{p.ma}</td>
                    <td className="px-1 py-1 tabular-nums">{p.st}</td>
                    <td className="px-1 py-1 tabular-nums">{p.ag}+</td>
                    <td className="px-1 py-1 tabular-nums">
                      {p.pa != null ? `${p.pa}+` : "—"}
                    </td>
                    <td className="px-1 py-1 tabular-nums">{p.av}+</td>
                    <td className="px-1 py-1">
                      {/* Noms français + infobulle (slug brut avant). */}
                      <SkillTooltip skillsString={p.skills} />
                    </td>
                    <td className="px-1 py-1 tabular-nums">{p.spp}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
