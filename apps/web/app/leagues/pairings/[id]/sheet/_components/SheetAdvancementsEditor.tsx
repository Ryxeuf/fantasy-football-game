"use client";
/**
 * Saisie des évolutions DANS la feuille de match (staging).
 *
 * Nouveau workflow : les évolutions font partie de la saisie du match —
 * chaque coach choisit les évolutions de SES joueurs contre leur PSP
 * projeté (PSP actuel + PSP gagnés dans ce match), puis « Valider ma
 * saisie » couvre le match dans son ensemble (fin de match + évolutions).
 * Rien n'est appliqué au roster avant la validation commissaire : les
 * choix sont stockés sur la feuille (`advancementsHome/Away`) et
 * appliqués/validés côté serveur à la validation.
 *
 * Réutilise la carte joueur de l'éditeur de level-up
 * (`AdvancementEditor.PlayerRow`) en mode `stage`.
 */

import { useEffect, useMemo, useState } from "react";
import {
  SKILL_ACCESS_SEASON3,
  getNextAdvancementPspCost,
} from "@bb/game-engine";
import { apiRequest } from "../../../../../lib/api-client";
import {
  PlayerRow,
  type PendingAdvancementItem,
  type SkillCatalogItem,
  type StagedAdvancementChoice,
} from "../../../../../components/AdvancementEditor";
import type { SheetPlayer } from "./MatchSheetPanels";

/** Entrée stagée telle que stockée sur la feuille (choix + playerId). */
export interface StagedAdvancementEntry extends StagedAdvancementChoice {
  playerId: string;
}

export interface SheetAdvancementsEditorProps {
  readonly teamId: string;
  readonly ruleset: string;
  readonly players: readonly SheetPlayer[];
  /** PSP gagnés dans CE match (calcul serveur), par playerId. */
  readonly computedSpp: Record<string, number>;
  /** PSP bonus « Nuffle » saisis en fin de match, par playerId. */
  readonly sppBonus: ReadonlyArray<{ playerId: string; spp: number }>;
  readonly staged: readonly StagedAdvancementEntry[];
  readonly onChange: (next: StagedAdvancementEntry[]) => void;
  /** Saisie verrouillée (côté déjà soumis / pas le coach). */
  readonly disabled?: boolean;
}

/**
 * Liste des joueurs de MON équipe pouvant staguer une évolution : PSP
 * projeté ≥ coût du palier le moins cher (tirage aléatoire Principale).
 */
export function SheetAdvancementsEditor({
  teamId,
  ruleset,
  players,
  computedSpp,
  sppBonus,
  staged,
  onChange,
  disabled,
}: SheetAdvancementsEditorProps): JSX.Element {
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ skills: SkillCatalogItem[] }>(
      `/api/skills?ruleset=${encodeURIComponent(ruleset || "season_3")}`,
    )
      .then((r) => {
        if (!cancelled) setCatalog(r.skills ?? []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ruleset]);

  const bonusByPlayer = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of sppBonus) {
      m.set(b.playerId, (m.get(b.playerId) ?? 0) + b.spp);
    }
    return m;
  }, [sppBonus]);

  const stagedByPlayer = useMemo(() => {
    const m = new Map<string, StagedAdvancementEntry>();
    for (const e of staged) m.set(e.playerId, e);
    return m;
  }, [staged]);

  // Items au format PendingAdvancementItem (réutilisation de PlayerRow).
  // `spp` = PSP PROJETÉ (actuel + match + bonus) : le serveur re-vérifie
  // à l'application (validation commissaire).
  const items = useMemo(() => {
    const out: PendingAdvancementItem[] = [];
    for (const p of players) {
      if (p.dead) continue;
      const taken = p.advancementsTaken ?? 0;
      if (taken >= 6) continue;
      const projected =
        p.spp + (computedSpp[p.id] ?? 0) + (bonusByPlayer.get(p.id) ?? 0);
      const cheapest = getNextAdvancementPspCost(taken, "random-primary");
      if (projected < cheapest && !stagedByPlayer.has(p.id)) continue;
      const access = SKILL_ACCESS_SEASON3[p.position];
      out.push({
        sequenceId: "",
        matchId: "",
        seasonId: "",
        teamPlayerId: p.id,
        playerName: `N°${p.number} ${p.name}`,
        spp: projected,
        advancementsTaken: taken,
        nextAdvancementCost: cheapest,
        createdAt: "",
        position: p.position,
        primarySkills: access?.primary ?? null,
        secondarySkills: access?.secondary ?? null,
        stats: p.stats,
        skills: p.skills ?? null,
      });
    }
    return out;
  }, [players, computedSpp, bonusByPlayer, stagedByPlayer]);

  if (items.length === 0) {
    return (
      <div
        data-testid="sheet-advancements-empty"
        className="rounded border border-dashed border-gray-300 py-6 text-center text-sm text-gray-500"
      >
        Aucun joueur de ton équipe n&apos;atteint un palier d&apos;évolution
        sur ce match.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        PSP projetés = PSP actuels + PSP gagnés sur ce match. Les choix
        ci-dessous font partie de ta saisie : ils seront appliqués aux
        rosters à la validation du commissaire (qui re-vérifie tout).
      </p>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        data-testid="sheet-advancements-list"
      >
        {items.map((it) => {
          const entry = stagedByPlayer.get(it.teamPlayerId) ?? null;
          return (
            <PlayerRow
              key={it.teamPlayerId}
              item={it}
              teamId={teamId}
              catalog={catalog}
              onApplied={() => undefined}
              stage={{
                staged: entry,
                disabled,
                onStage: (choice) =>
                  onChange([
                    ...staged.filter((e) => e.playerId !== it.teamPlayerId),
                    { playerId: it.teamPlayerId, ...choice },
                  ]),
                onUnstage: () =>
                  onChange(
                    staged.filter((e) => e.playerId !== it.teamPlayerId),
                  ),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Récap post-validation : ce qui a été appliqué (ou refusé) par le
 * serveur pour un côté, à partir des entrées enrichies de la feuille.
 */
export function StagedAdvancementsRecap({
  entries,
  players,
  title,
}: {
  readonly entries: readonly StagedAdvancementEntry[];
  readonly players: readonly SheetPlayer[];
  readonly title: string;
}): JSX.Element | null {
  if (entries.length === 0) return null;
  const nameOf = (id: string): string => {
    const p = players.find((pl) => pl.id === id);
    return p ? `N°${p.number} ${p.name}` : id;
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <ul className="mt-1 space-y-1 text-sm" data-testid="sheet-advancements-recap">
        {entries.map((e, i) => (
          <li key={`${e.playerId}-${i}`} className="flex items-center gap-2">
            <span>
              {nameOf(e.playerId)} —{" "}
              {e.type === "characteristic"
                ? `+${(e.stat ?? "").toUpperCase()}`
                : e.skillSlug}
            </span>
            {e.applied === true ? (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                ✓ appliqué{typeof e.cost === "number" ? ` · ${e.cost} PSP` : ""}
              </span>
            ) : e.applied === false ? (
              <span
                className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800"
                title={e.skipReason}
              >
                refusé ({e.skipReason ?? "?"})
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                en attente de validation
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
