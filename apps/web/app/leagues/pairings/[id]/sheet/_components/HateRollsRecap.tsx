"use client";

/**
 * Haine (X) — récapitulatif des jets d'après-match.
 *
 * Le D6 est lancé CÔTÉ SERVEUR à la validation de la feuille : sans ce
 * panneau, un coach verrait un jour un trait apparaître sur la fiche d'un
 * joueur sans savoir d'où il vient — ou, pire, ne saurait jamais qu'un jet
 * a eu lieu et a échoué.
 *
 * On affiche donc TOUS les dés lancés, réussis comme ratés, avec le mot-clé
 * en jeu et l'issue réelle de l'attribution (`granted`), qui n'est pas la
 * simple relecture de « 4+ » : un jet réussi peut ne rien accorder si la
 * compétence n'a pas pu être garantie au catalogue.
 */

import { useMemo } from "react";
import type { JSX } from "react";
import { useSkillCatalog } from "./SheetAdvancementsEditor";
import type { SkillCatalogItem } from "../../../../../components/AdvancementEditor";

/** Un jet de Haine tel que servi par l'API (cf. `services/league-hate-trait`). */
export interface HateRollView {
  readonly playerId: string;
  /** Nom figé à l'écriture : reste lisible même si le joueur a disparu. */
  readonly playerName: string;
  readonly teamId: string;
  readonly keyword: string;
  readonly skillSlug: string;
  readonly roll: number;
  readonly granted: boolean;
  readonly failure?: string;
}

/** Seuil de réussite du jet (1D6). Doit rester aligné sur le moteur. */
const HATE_ROLL_TARGET = 4;

const FAILURE_LABELS: Readonly<Record<string, string>> = {
  "skill-unavailable":
    "jet réussi, mais le trait n'a pas pu être créé au catalogue — préviens le commissaire",
  "write-failed":
    "jet réussi, mais l'écriture sur le joueur a échoué — préviens le commissaire",
};

export function HateRollsRecap({
  rolls,
  teamNames,
  ruleset,
}: {
  readonly rolls: readonly HateRollView[];
  /** Nom d'équipe par teamId, pour situer le joueur blessé. */
  readonly teamNames?: Readonly<Record<string, string>>;
  /** Édition de l'équipe : résout le libellé officiel du trait. */
  readonly ruleset?: string;
}): JSX.Element | null {
  const catalog = useSkillCatalog(ruleset ?? "season_3");
  const catalogBySlug = useMemo(() => {
    const m = new Map<string, SkillCatalogItem>();
    for (const s of catalog) m.set(s.slug, s);
    return m;
  }, [catalog]);

  if (rolls.length === 0) return null;

  /**
   * Libellé du trait. Repli sur « Haine (X) » reconstruit depuis le mot-clé
   * plutôt que sur le slug brut : le trait vient peut-être d'être créé, et
   * le catalogue chargé par le navigateur peut être antérieur.
   */
  const traitLabel = (r: HateRollView): string =>
    catalogBySlug.get(r.skillSlug)?.nameFr ??
    (r.keyword ? `Haine (${r.keyword})` : r.skillSlug);

  const grantedCount = rolls.filter((r) => r.granted).length;

  return (
    <section
      className="rounded-lg border border-purple-200 bg-purple-50 p-3"
      data-testid="hate-rolls-recap"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-purple-700">
        Haine (X) — jets d&apos;après-match
      </h3>
      <p className="mt-1 text-xs text-purple-900/80">
        Un joueur sorti pour au moins le match suivant (amoché, blessure
        sérieuse, séquelle) jette <strong>1D6</strong> : sur{" "}
        <strong>{HATE_ROLL_TARGET}+</strong>, il gagne <em>Haine (X)</em>, où X
        est un mot-clé de lignée du joueur qui l&apos;a éliminé. Les mots-clés
        de poste (Blitzer, Coureur…) n&apos;entrent jamais en jeu.
      </p>
      <ul className="mt-2 space-y-1 text-sm" data-testid="hate-rolls-list">
        {rolls.map((r, i) => {
          const teamName = r.teamId ? teamNames?.[r.teamId] : undefined;
          return (
            <li
              key={`${r.playerId}-${r.skillSlug}-${i}`}
              className="flex flex-wrap items-center gap-2"
              data-testid={r.granted ? "hate-roll-granted" : "hate-roll-failed"}
            >
              <span
                aria-label={`Résultat du dé : ${r.roll}`}
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                  r.granted
                    ? "border-purple-400 bg-white text-purple-800"
                    : "border-slate-300 bg-white text-slate-500"
                }`}
              >
                {r.roll}
              </span>
              <span className="font-medium">
                {r.playerName || r.playerId}
                {teamName ? (
                  <span className="font-normal text-slate-500">
                    {" "}
                    ({teamName})
                  </span>
                ) : null}
              </span>
              {r.granted ? (
                <span className="text-purple-800">
                  — gagne <strong>{traitLabel(r)}</strong>
                </span>
              ) : (
                <span className="text-slate-600">
                  —{" "}
                  {r.failure
                    ? (FAILURE_LABELS[r.failure] ?? "aucun trait accordé")
                    : `aucun trait accordé (${HATE_ROLL_TARGET}+ requis)`}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-purple-900/70">
        {grantedCount === 0
          ? "Aucun trait accordé sur ce match."
          : `${grantedCount} trait${grantedCount > 1 ? "s" : ""} accordé${
              grantedCount > 1 ? "s" : ""
            } — visible${
              grantedCount > 1 ? "s" : ""
            } sur la fiche du joueur. Le trait ne coûte rien en VE et ne se choisit jamais à l'évolution.`}
      </p>
    </section>
  );
}
