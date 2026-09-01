import type { BlockDieFace } from "./NuffleArt";

/**
 * Miroir web de la table des faces du Dé de Blocage.
 *
 * SOURCE DE VÉRITÉ : `BLOCK_DIE_FACES` / `BLOCK_DIE_FACE_INFO` du
 * `@bb/game-engine` (`packages/game-engine/src/mechanics/block-dice-faces.ts`).
 * Le front n'a pas le moteur en dépendance runtime, d'où ce miroir —
 * verrouillé par `block-dice-faces-consistency.test.ts`, qui compare les
 * six faces et les libellés VF/VO au moteur.
 *
 * Le dé est un D6 décoré de CINQ icônes : `Repoussé` occupe deux faces,
 * les quatre autres une seule.
 */
export const BLOCK_DIE_FACES: readonly BlockDieFace[] = [
  "down",
  "bothdown",
  "push",
  "stumble",
  "pow",
  "push",
];

export interface BlockDieFaceLabel {
  /** Nom du résultat tel qu'il figure sur la face du dé. */
  readonly name: string;
  /** Effet du résultat (reformulé, cf. compendium `des-de-blocage`). */
  readonly effect: string;
  /** Rang de préférence pour l'attaquant (5 = meilleur). */
  readonly attackerRank: number;
}

export const BLOCK_DIE_FACE_LABELS: Record<
  "fr" | "en",
  Record<BlockDieFace, BlockDieFaceLabel>
> = {
  fr: {
    down: {
      name: "Attaquant Plaqué",
      effect:
        "Le joueur qui a annoncé l'Action de Blocage est Plaqué sur-le-champ, exactement comme si la cible avait elle-même effectué une Action de Blocage contre lui. Turnover.",
      attackerRank: 1,
    },
    bothdown: {
      name: "Les Deux Plaqués",
      effect:
        "Les deux joueurs sont Plaqués l'un par l'autre, chacun restant sur sa propre case, comme si chacun avait effectué une Action de Blocage contre l'autre. Turnover si l'attaquant tombe.",
      attackerRank: 2,
    },
    push: {
      name: "Repoussé",
      effect:
        "La cible recule de 1 case, poussée par l'attaquant. Ce dernier peut ensuite choisir de Poursuivre : il occupe alors la case que la cible vient de quitter.",
      attackerRank: 3,
    },
    stumble: {
      name: "Bousculé",
      effect:
        "Résultat à deux visages : la cible qui possède la Compétence Esquive s'en tire avec un simple Repoussé ; sans Esquive, le résultat se lit Défenseur Plaqué.",
      attackerRank: 4,
    },
    pow: {
      name: "Défenseur Plaqué",
      effect:
        "On applique d'abord le Repoussé ; une fois la cible déplacée, elle est Plaquée par l'attaquant sur sa NOUVELLE case, pas sur celle qu'elle occupait au départ.",
      attackerRank: 5,
    },
  },
  en: {
    down: {
      name: "Attacker Down",
      effect:
        "The blocking player is Knocked Down at once, exactly as if the target had made the Block Action against them instead. Turnover.",
      attackerRank: 1,
    },
    bothdown: {
      name: "Both Down",
      effect:
        "Both players are Knocked Down by one another, each staying on their own square, as if each had made a Block Action against the other. Turnover if the attacker goes down.",
      attackerRank: 2,
    },
    push: {
      name: "Push Back",
      effect:
        "The target is driven back 1 square by the blocking player, who may then choose to Follow Up into the square the target has just left.",
      attackerRank: 3,
    },
    stumble: {
      name: "Stumble",
      effect:
        "A two-faced result: a target with the Dodge Skill gets away with a plain Push Back; without Dodge, the result is read as Defender Down.",
      attackerRank: 4,
    },
    pow: {
      name: "Defender Down",
      effect:
        "Apply the Push Back first; once the target has moved, they are Knocked Down by the attacker on their NEW square, not the one they started on.",
      attackerRank: 5,
    },
  },
};
