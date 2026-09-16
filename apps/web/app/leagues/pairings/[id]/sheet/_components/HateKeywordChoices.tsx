"use client";

/**
 * Haine (X) — choix du Mot-clé haï, AVANT la validation.
 *
 * Le D6 est lancé côté serveur à la validation (`HateRollsRecap` en rend
 * compte après coup) ; ce panneau-ci sert à dire, avant, QUEL Mot-clé le
 * joueur haïra s'il réussit son jet. Un adversaire en porte souvent
 * plusieurs — un Zombie est *Humain*, *Mort-Vivant* ET *Zombie* — et haïr
 * l'une ou l'autre lignée ne recouvre pas les mêmes adversaires au reste de
 * la saison.
 *
 * Les candidats sont DÉRIVÉS par le serveur des évènements saisis : corriger
 * l'auteur d'une sortie change la liste, et un choix devenu ineligible
 * retombe silencieusement sur le premier Mot-clé (`chosen: false`).
 */

import type { JSX } from "react";

/** Un candidat au jet, tel que servi par `GET .../sheet`. */
export interface HateCandidateView {
  readonly victimPlayerId: string;
  /** Côté du BLESSÉ : c'est lui qui gagnera le trait. */
  readonly side: "home" | "away";
  readonly causerPlayerId: string;
  /** Mots-clés de lignée de l'auteur, dans l'ordre du catalogue. */
  readonly keywords: readonly string[];
  /** Mot-clé qui sera retenu à la validation. */
  readonly keyword: string;
  /** Le choix stocké a-t-il été retenu ? (faux = repli sur le défaut) */
  readonly chosen: boolean;
}

export function HateKeywordChoices({
  candidates,
  playerLabel,
  teamLabel,
  canEdit,
  onChoose,
}: {
  readonly candidates: readonly HateCandidateView[];
  /** Libellé lisible d'un joueur (roster, journalier, Star Player). */
  readonly playerLabel: (playerId: string) => string;
  /** Nom de l'équipe d'un côté, pour situer le blessé. */
  readonly teamLabel: (side: "home" | "away") => string;
  /**
   * Le viewer peut-il choisir pour ce côté ? Un coach ne décide que pour ses
   * propres joueurs ; le commissaire pour les deux. Le serveur le revérifie.
   */
  readonly canEdit: (side: "home" | "away") => boolean;
  readonly onChoose: (victimPlayerId: string, keyword: string) => void;
}): JSX.Element | null {
  if (candidates.length === 0) return null;

  return (
    <section
      className="rounded-lg border border-purple-200 bg-purple-50 p-3"
      data-testid="hate-keyword-choices"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-purple-700">
        Haine (X) — mot-clé haï
      </h3>
      <p className="mt-1 text-xs text-purple-900/80">
        Ces joueurs sont sortis pour au moins le match suivant : à la
        validation, chacun jette <strong>1D6</strong> et gagne{" "}
        <em>Haine (X)</em> sur <strong>4+</strong>. Choisis dès maintenant le
        mot-clé de lignée qu&apos;il haïra parmi ceux de l&apos;adversaire qui
        l&apos;a mis sur la touche. Par défaut, c&apos;est le premier.
      </p>
      <ul className="mt-2 space-y-2 text-sm" data-testid="hate-choices-list">
        {candidates.map((c) => {
          const editable = canEdit(c.side);
          return (
            <li
              key={c.victimPlayerId}
              className="flex flex-wrap items-center gap-2"
              data-testid={`hate-choice-${c.victimPlayerId}`}
            >
              <span className="font-medium">
                {playerLabel(c.victimPlayerId)}
                <span className="font-normal text-slate-500">
                  {" "}
                  ({teamLabel(c.side)})
                </span>
              </span>
              <span className="text-xs text-slate-600">
                blessé par {playerLabel(c.causerPlayerId)} —
              </span>
              {c.keywords.length === 1 || !editable ? (
                <span
                  className="rounded border border-purple-300 bg-white px-2 py-1 text-xs font-semibold text-purple-800"
                  data-testid={`hate-choice-fixed-${c.victimPlayerId}`}
                >
                  Haine ({c.keyword})
                </span>
              ) : (
                <select
                  className="rounded border px-2 py-1 text-sm"
                  aria-label={`Mot-clé haï par ${playerLabel(c.victimPlayerId)}`}
                  data-testid={`hate-choice-select-${c.victimPlayerId}`}
                  value={c.keyword}
                  onChange={(e) => onChoose(c.victimPlayerId, e.target.value)}
                >
                  {c.keywords.map((k) => (
                    <option key={k} value={k}>
                      Haine ({k})
                    </option>
                  ))}
                </select>
              )}
              {/* Le choix ne s'applique plus : l'auteur de la sortie a changé
              depuis. Mieux vaut le dire que de laisser croire qu'il tient. */}
              {!c.chosen && c.keywords.length > 1 ? (
                <span className="text-xs text-slate-500">par défaut</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
