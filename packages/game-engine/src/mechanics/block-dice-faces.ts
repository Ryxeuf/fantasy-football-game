/**
 * Table des faces du Dé de Blocage — Blood Bowl saison 2025.
 *
 * Le Dé de Blocage est un dé à six faces décorées de CINQ icônes
 * différentes : la face « Repoussé » figure DEUX fois, les quatre autres
 * une seule fois. C'est cette asymétrie qui donne sa distribution au dé,
 * et elle doit rester la même partout :
 *
 *  1. `BLOCK_DIE_FACES` ci-dessous — moteur de jeu (`rollBlockDice`,
 *     `blockResultFromRoll`) et resolver `@bb/sim-engine` ;
 *  2. `apps/web/app/components/home/BlockDiceRoller.tsx` — simulateur de
 *     lancer de la page d'accueil (le web n'a pas `@bb/game-engine` en
 *     dépendance runtime, il en garde donc un miroir verrouillé par
 *     `block-dice-faces-consistency.test.ts`) ;
 *  3. `apps/web/app/compendium/data/rules-bb-2025.json`, chapitre
 *     `des-de-blocage` — version publiée et reformulée.
 *
 * Les effets sont REFORMULÉS (même posture que le compendium publié :
 * pas de reproduction littérale du livre), mais complets — l'ordre
 * « repousser puis plaquer » de Défenseur Plaqué en fait partie.
 *
 * ⚠️ Les libellés français sont ceux du livre : « Attaquant Plaqué »,
 * « Les Deux Plaqués », « Repoussé », « Bousculé », « Défenseur Plaqué ».
 * Ce sont eux que reprennent les descriptions de Compétences
 * (`skills/index.ts`, `static-skills-data-s3.ts`) : ne pas réintroduire
 * les approximations historiques (« Joueur à terre », « Hésitation »,
 * « Tous à terre », « POW ! ») qui rendaient l'interface incohérente avec
 * les règles affichées ailleurs sur le site.
 */

import { BlockResult } from '../core/types';

export interface BlockDieFaceInfo {
  /** Résultat moteur correspondant. */
  readonly result: BlockResult;
  /** Nom du résultat tel qu'il figure sur la face du dé (VF). */
  readonly nameFr: string;
  /** Nom du résultat (VO). */
  readonly nameEn: string;
  /** Effet du résultat, reformulé (cf. compendium). */
  readonly effectFr: string;
  /** Effet du résultat, reformulé (VO). */
  readonly effectEn: string;
  /**
   * Nombre de faces portant cette icône sur le dé.
   * `Repoussé` = 2, toutes les autres = 1 (total : 6).
   */
  readonly faces: number;
}

/**
 * Les cinq icônes du dé, dans l'ordre du livre.
 */
export const BLOCK_DIE_FACE_INFO: Record<BlockResult, BlockDieFaceInfo> = {
  PLAYER_DOWN: {
    result: 'PLAYER_DOWN',
    nameFr: 'Attaquant Plaqué',
    nameEn: 'Attacker Down',
    effectFr:
      "Le joueur qui a annoncé l'Action de Blocage est Plaqué sur-le-champ, exactement comme si la cible avait elle-même effectué une Action de Blocage contre lui. Turnover.",
    effectEn:
      'The blocking player is Knocked Down at once, exactly as if the target had made the Block Action against them instead. Turnover.',
    faces: 1,
  },
  BOTH_DOWN: {
    result: 'BOTH_DOWN',
    nameFr: 'Les Deux Plaqués',
    nameEn: 'Both Down',
    effectFr:
      "Les deux joueurs sont Plaqués l'un par l'autre, chacun restant sur sa propre case, comme si chacun avait effectué une Action de Blocage contre l'autre. Turnover si l'attaquant tombe.",
    effectEn:
      'Both players are Knocked Down by one another, each staying on their own square, as if each had made a Block Action against the other. Turnover if the attacker goes down.',
    faces: 1,
  },
  PUSH_BACK: {
    result: 'PUSH_BACK',
    nameFr: 'Repoussé',
    nameEn: 'Push Back',
    effectFr:
      "La cible recule de 1 case, poussée par l'attaquant. Ce dernier peut ensuite choisir de Poursuivre : il occupe alors la case que la cible vient de quitter.",
    effectEn:
      'The target is driven back 1 square by the blocking player, who may then choose to Follow Up into the square the target has just left.',
    faces: 2,
  },
  STUMBLE: {
    result: 'STUMBLE',
    nameFr: 'Bousculé',
    nameEn: 'Stumble',
    effectFr:
      "Résultat à deux visages : la cible qui possède la Compétence Esquive s'en tire avec un simple Repoussé ; sans Esquive, le résultat se lit Défenseur Plaqué.",
    effectEn:
      'A two-faced result: a target with the Dodge Skill gets away with a plain Push Back; without Dodge, the result is read as Defender Down.',
    faces: 1,
  },
  POW: {
    result: 'POW',
    nameFr: 'Défenseur Plaqué',
    nameEn: 'Defender Down',
    effectFr:
      "On applique d'abord le Repoussé ; une fois la cible déplacée, elle est Plaquée par l'attaquant sur sa NOUVELLE case, pas sur celle qu'elle occupait au départ.",
    effectEn:
      'Apply the Push Back first; once the target has moved, they are Knocked Down by the attacker on their NEW square, not the one they started on.',
    faces: 1,
  },
};

/**
 * Les six faces du dé, indexées par le jet D6 (index 0 = un 1).
 *
 * Deux faces `PUSH_BACK` : c'est le seul résultat qui apparaît deux fois.
 */
export const BLOCK_DIE_FACES: readonly BlockResult[] = [
  'PLAYER_DOWN',
  'BOTH_DOWN',
  'PUSH_BACK',
  'STUMBLE',
  'POW',
  'PUSH_BACK',
];

/** Nom VF d'un résultat de blocage, tel qu'il figure sur le dé. */
export function blockResultNameFr(result: BlockResult): string {
  return BLOCK_DIE_FACE_INFO[result].nameFr;
}

/** Nom VO d'un résultat de blocage. */
export function blockResultNameEn(result: BlockResult): string {
  return BLOCK_DIE_FACE_INFO[result].nameEn;
}

/** Nom VF + effet, pour un `title` / `alt` d'icone de resultat. */
export function blockResultDescriptionFr(result: BlockResult): string {
  const info = BLOCK_DIE_FACE_INFO[result];
  return `${info.nameFr} — ${info.effectFr}`;
}
