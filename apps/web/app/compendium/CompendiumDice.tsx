import type { ReactNode } from "react";
import { BlockDieIcon } from "../components/dice/BlockDieIcon";
import { D6Icon } from "../components/dice/D6Icon";
import { NumberDieIcon } from "../components/dice/NumberDieIcon";
import { BLOCK_DIE_FACE_ARIA } from "../components/dice/labels";
import type { BlockDieFace } from "../components/dice/types";
import { BLOCK_DIE_FACES } from "../components/home/block-dice-faces";
import {
  diceColumnName,
  rangeLabel,
  rangeValues,
  type DiceColumn,
  type RollRange,
} from "./dice-notation";

/**
 * Dés du compendium. Toute face passe par `BlockDieIcon` / `D6Icon` /
 * `NumberDieIcon` : c'est ce qui applique le thème de dés du coach (dé
 * ORIGINAL or & charbon pour un visiteur, hors flag ou en erreur).
 *
 * Server components : les icônes sont des composants client, rendus en SSR
 * avec le thème par défaut puis réhydratés dans celui du coach.
 */

/**
 * Ordre du livre et de la table « Faces du Dé de Blocage » : de la pire à
 * la meilleure issue pour l'attaquant. (Pas d'import depuis un module
 * `"use client"` ici : côté serveur, ses exports ne sont que des références.)
 */
const BOOK_ORDER: readonly BlockDieFace[] = ["down", "bothdown", "push", "stumble", "pow"];

/**
 * Les six faces dans l'ordre du livre, chaque icône répétée autant de fois
 * qu'elle figure sur le dé. Le décompte vient du miroir du moteur
 * (`BLOCK_DIE_FACES`, verrouillé par `block-dice-faces-consistency.test.ts`) :
 * Repoussé apparaît deux fois.
 */
export const BLOCK_DIE_FIGURE_FACES: readonly BlockDieFace[] = BOOK_ORDER.flatMap(
  (face) => BLOCK_DIE_FACES.filter((f) => f === face),
);

interface BlockDiceFigureProps {
  readonly caption?: string;
}

/** Le Dé de Blocage « déplié » : ses six faces, nommées. */
export function BlockDiceFigure({ caption }: BlockDiceFigureProps): JSX.Element {
  return (
    <figure className="space-y-2" data-testid="compendium-block-dice">
      <ol className="grid grid-cols-3 gap-3 rounded-2xl border border-nuffle-bronze/25 bg-gradient-to-br from-nuffle-anthracite to-[#2c2620] p-4 sm:grid-cols-6 sm:p-5">
        {BLOCK_DIE_FIGURE_FACES.map((face, i) => (
          <li key={`${face}-${i}`} className="flex flex-col items-center gap-2 text-center">
            <BlockDieIcon face={face} px={64} className="h-14 w-14 drop-shadow sm:h-16 sm:w-16" />
            <span className="text-xs font-semibold leading-tight text-nuffle-ivory/85">
              {BLOCK_DIE_FACE_ARIA.fr[face]}
            </span>
          </li>
        ))}
      </ol>
      {caption ? (
        <figcaption className="text-xs italic text-nuffle-anthracite/60">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

interface BlockFaceCellProps {
  readonly face: BlockDieFace;
  readonly children: ReactNode;
}

/** Cellule qui nomme un résultat du Dé de Blocage : sa face, puis son nom. */
export function BlockFaceCell({ face, children }: BlockFaceCellProps): JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-nuffle-anthracite">
      <BlockDieIcon face={face} px={32} className="h-8 w-8 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

interface DiceRollCellProps {
  readonly column: DiceColumn;
  readonly range: RollRange;
}

/**
 * Cellule de jet : la plage dessinée en faces de dés. Le texte reste dans
 * le DOM pour les lecteurs d'écran, la recherche dans la page et
 * l'indexation (« 2D6 : 2 à 7 ») ; les faces sont décoratives.
 */
export function DiceRollCell({ column, range }: DiceRollCellProps): JSX.Element {
  const name = diceColumnName(column);
  return (
    <span className="inline-flex items-center whitespace-nowrap" data-testid="compendium-roll">
      <span className="sr-only">{`${name} : ${rangeLabel(range)}`}</span>
      <span aria-hidden className="inline-flex items-center gap-1">
        {column.kind === "d6" ? (
          rangeValues(range).map((v) => <D6Icon key={v} value={v} className="h-6 w-6" />)
        ) : (
          <>
            <NumberDieIcon
              value={range.from}
              sides={column.kind === "number" ? column.sides : undefined}
              className="h-7 w-7"
            />
            {range.to !== range.from ? (
              <>
                <span className="px-0.5 text-nuffle-bronze">–</span>
                <NumberDieIcon
                  value={range.to}
                  sides={column.kind === "number" ? column.sides : undefined}
                  className="h-7 w-7"
                />
              </>
            ) : null}
          </>
        )}
      </span>
    </span>
  );
}
