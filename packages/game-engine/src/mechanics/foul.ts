/**
 * Mécanique de faute (foul) pour Blood Bowl
 * Permet de frapper un joueur au sol avec risque d'expulsion
 */

import { GameState, Player, RNG } from '../core/types';
import { cloneGameState } from '../core/clone-state';
import { rollD6, calculateArmorTarget } from '../utils/dice';
import { isAdjacent, getAdjacentOpponents } from './movement';
import { createLogEntry } from '../utils/logging';
import { performInjuryRoll, handleSentOff } from './injury';
import { getFoulArmorSkillModifiers, getArmorSkillContext, isSneakyGitActive } from '../skills/skill-bridge';

/**
 * Vérifie si un joueur peut faire une faute sur une cible
 */
export function canFoul(state: GameState, attacker: Player, target: Player): boolean {
  // La cible doit être au sol (stunned)
  if (!target.stunned) return false;

  // La cible doit être adjacente
  if (!isAdjacent(attacker.pos, target.pos)) return false;

  // L'attaquant doit être de l'équipe active
  if (attacker.team !== state.currentPlayer) return false;

  // La cible doit être adverse
  if (target.team === attacker.team) return false;

  // L'attaquant ne doit pas être sonné
  if (attacker.stunned) return false;

  return true;
}

/**
 * Calcule les assists de foul (BB2020 / BB3) :
 *  - Offensifs : joueurs amis (hors fouleur) adjacents à la VICTIME → +1 chacun.
 *  - Défensifs : joueurs adverses (hors victime) adjacents au FOULEUR → -1 chacun.
 *
 * BUG fix : avant, les défensifs étaient comptés adjacents à la VICTIME
 * (la même position que les offensifs). Sous-estimation des modificateurs
 * négatifs quand un défenseur entoure le fouleur sans entourer la victime.
 * Source : BB2020 LRB "Fouls" §p.65 — "each team-mate of the fouler
 * adjacent to the player being fouled adds +1 ; each team-mate of the
 * victim adjacent to the fouler subtracts -1."
 */
export function calculateFoulAssists(state: GameState, attacker: Player, target: Player): number {
  let assists = 0;

  // Offensifs : amis adjacents à la VICTIME (hors fouleur)
  for (const player of state.players) {
    if (player.id === attacker.id) continue;
    if (player.team !== attacker.team) continue;
    if (player.stunned || player.state === 'knocked_out' || player.state === 'casualty') continue;
    if (isAdjacent(player.pos, target.pos)) {
      assists += 1;
    }
  }

  // Défensifs : adverses adjacents au FOULEUR (hors victime)
  for (const player of state.players) {
    if (player.id === target.id) continue;
    if (player.team !== target.team) continue;
    if (player.stunned || player.state === 'knocked_out' || player.state === 'casualty') continue;
    if (isAdjacent(player.pos, attacker.pos)) {
      assists -= 1;
    }
  }

  return assists;
}

/**
 * Exécute une faute
 */
export function executeFoul(
  state: GameState,
  attacker: Player,
  target: Player,
  rng: RNG
): GameState {
  let newState = cloneGameState(state);

  const assists = calculateFoulAssists(newState, attacker, target);

  const foulLog = createLogEntry(
    'action',
    `${attacker.name} commet une faute sur ${target.name} (assists: ${assists >= 0 ? '+' : ''}${assists})`,
    attacker.id,
    attacker.team
  );
  newState.gameLog = [...newState.gameLog, foulLog];

  // Jet d'armure avec bonus d'assists + Dirty Player
  // Iron Hard Skin annule les modificateurs positifs de l'attaquant
  // (ex. Dirty Player). Les assists de foul ne sont PAS un modificateur
  // de skill de l'attaquant et restent appliqués.
  const die1 = rollD6(rng);
  const die2 = rollD6(rng);
  const dirtyPlayerBonusRaw = getFoulArmorSkillModifiers(newState, attacker);
  const { ironHardSkinActive } = getArmorSkillContext(newState, attacker, target);
  const dirtyPlayerBonus = ironHardSkinActive ? 0 : dirtyPlayerBonusRaw;
  const armorRoll = die1 + die2 + assists + dirtyPlayerBonus;
  // BUG fix audit round 6 (HIGH) : avant, `armorRoll >= target.av` utilisait
  // la valeur d'armure brute → le malus Stunty (-1 AV) etait silencieusement
  // ignore sur les fouls. Une faute contre un Halfling/Goblin/Skink utilisait
  // AV=7 au lieu de 6. La regle BB applique Stunty a TOUS les jets d'armure,
  // y compris les fouls. Fix : utiliser `calculateArmorTarget` qui inclut le
  // -1 Stunty (et clamp 2-12).
  const armorTarget = calculateArmorTarget(target, 0);
  const armorBroken = armorRoll >= armorTarget;

  const ihsTag = ironHardSkinActive ? ' [Iron Hard Skin]' : '';
  const dpTag = dirtyPlayerBonus > 0 ? ` [Dirty Player +${dirtyPlayerBonus}]` : '';
  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure (foul): ${die1}+${die2}${assists !== 0 ? (assists > 0 ? '+' + assists : assists.toString()) : ''}${dpTag}${ihsTag} = ${armorRoll}/${armorTarget} ${armorBroken ? '✗ (percée)' : '✓ (tient)'}`,
    target.id,
    target.team,
    { die1, die2, assists, total: armorRoll, target: armorTarget, ironHardSkin: ironHardSkinActive }
  );
  newState.gameLog = [...newState.gameLog, armorLog];

  // Doublet armor (sur les dés bruts) — check pour expulsion.
  const armorDoubles = die1 === die2;

  // BB2020 : si l'armure casse, jet de blessure. Roule les dés ICI pour
  // pouvoir tester le doublet sur le jet d'injury et déclencher
  // l'expulsion (BB rule : doubles sur armor OR injury → fouleur expulsé).
  // Avant ce fix, seul le doublet armor déclenchait l'expulsion ; les
  // doublets injury (3-3, 4-4 etc.) étaient ignorés.
  let injuryDoubles = false;
  if (armorBroken) {
    const injuryDie1 = rollD6(rng);
    const injuryDie2 = rollD6(rng);
    injuryDoubles = injuryDie1 === injuryDie2;
    const targetPlayer = newState.players.find(p => p.id === target.id)!;
    newState = performInjuryRoll(
      newState,
      targetPlayer,
      rng,
      0,
      attacker.id,
      [injuryDie1, injuryDie2],
    );
  }

  const isDoubles = armorDoubles || injuryDoubles;
  // Expulsion si doublet, sauf si l'attaquant possede Sneaky Git
  const sneakyGit = isSneakyGitActive(newState, attacker);

  // BB2020 Officious Ref (kickoff event 11) : ce drive, chaque foul
  // declenche un D6 supplementaire ; sur 1, le fouleur est expulse
  // (en plus du doublet armor/injury). Le check s'ajoute, ne remplace pas.
  let officiousRefSendOff = false;
  if (newState.officiousRefForDrive) {
    const refRoll = rollD6(rng);
    const refLog = createLogEntry(
      'dice',
      `Officious Ref D6: ${refRoll}${refRoll === 1 ? ' → expulsion automatique' : ''}`,
      attacker.id,
      attacker.team,
      { refRoll, officiousRef: true }
    );
    newState.gameLog = [...newState.gameLog, refLog];
    officiousRefSendOff = refRoll === 1;
  }

  const sendOffTriggered = (isDoubles && !sneakyGit) || officiousRefSendOff;

  if (sendOffTriggered) {
    const attackerPlayer = newState.players.find(p => p.id === attacker.id);
    if (attackerPlayer) {
      // BB2020 Bribe : un coach peut depenser un Pot-de-vin pour eviter
      // l'expulsion sur foul (D6 2+). Avant le fix, les bribes n'etaient
      // jamais consultes sur foul send-off — l'inducement Bribe acheté
      // specifiquement pour cet usage primaire (cf. catalogue.description)
      // etait silencieusement mort. Roll D6 sur 2+ = bribe consume + skip.
      const teamKey = attacker.team === 'A' ? 'teamA' : 'teamB';
      const bribesAvailable = (newState.bribesRemaining?.[teamKey] ?? 0) > 0;
      let bribeUsed = false;
      if (bribesAvailable) {
        const bribeRoll = rollD6(rng);
        // Consommer le bribe que le jet reussisse ou non (BB rule).
        newState.bribesRemaining = {
          ...newState.bribesRemaining!,
          [teamKey]: newState.bribesRemaining![teamKey] - 1,
        };
        if (bribeRoll >= 2) {
          bribeUsed = true;
          const bribeLog = createLogEntry(
            'action',
            `Pot-de-vin utilisé (D6: ${bribeRoll}) — ${attacker.name} échappe à l'expulsion. Bribes restantes : ${newState.bribesRemaining[teamKey]}`,
            attacker.id,
            attacker.team,
            { bribeRoll, bribesRemaining: newState.bribesRemaining[teamKey] }
          );
          newState.gameLog = [...newState.gameLog, bribeLog];
        } else {
          const bribeFailLog = createLogEntry(
            'action',
            `Pot-de-vin gaspillé (D6: ${bribeRoll}) — ${attacker.name} sera expulsé. Bribes restantes : ${newState.bribesRemaining[teamKey]}`,
            attacker.id,
            attacker.team,
            { bribeRoll, bribesRemaining: newState.bribesRemaining[teamKey] }
          );
          newState.gameLog = [...newState.gameLog, bribeFailLog];
        }
      }

      if (!bribeUsed) {
        const source = officiousRefSendOff && !isDoubles
          ? 'Officious Ref'
          : (armorDoubles ? 'Doublet armure' : 'Doublet blessure');
        const expulsionLog = createLogEntry(
          'action',
          `${source} ! ${attacker.name} est expulsé par l'arbitre !`,
          attacker.id,
          attacker.team
        );
        newState.gameLog = [...newState.gameLog, expulsionLog];
        newState = handleSentOff(newState, attackerPlayer);
      }
    }
  } else if (isDoubles && sneakyGit) {
    const sneakyLog = createLogEntry(
      'action',
      `Doublet ! ${attacker.name} evite l'expulsion grâce à Sneaky Git.`,
      attacker.id,
      attacker.team
    );
    newState.gameLog = [...newState.gameLog, sneakyLog];
  }

  return newState;
}
