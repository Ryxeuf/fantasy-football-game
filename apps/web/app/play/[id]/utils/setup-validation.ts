/**
 * Helpers de validation du placement en phase de setup pre-match.
 *
 * Toutes les fonctions sont pures — elles reposent sur l'etat passe en
 * argument et ne touchent pas a l'etat React.
 *
 * Extraits de `play/[id]/page.tsx` dans le cadre du refactor S26.0c.
 */

import {
  type ExtendedGameState,
  type Position,
} from "@bb/game-engine";

/**
 * Determine de quel cote (A ou B) joue le coach courant en comparant les
 * noms d'equipe locaux a ceux du gameState. Retourne null si les noms
 * locaux ne sont pas encore charges.
 */
export function getMySide(
  ext: ExtendedGameState,
  teamNameA: string | null | undefined,
  teamNameB: string | null | undefined,
): "A" | "B" | null {
  if (!teamNameA || !teamNameB) return null;
  return teamNameA === ext.teamNames.teamA ? "A" : "B";
}

/**
 * Valide qu'un placement (playerId -> position) est legal en phase de
 * setup. Retourne `null` si le placement est valide, sinon une string
 * avec un message d'erreur localise (FR) destine a l'UI.
 *
 * @param ext L'etat de jeu enrichi (doit etre en phase setup).
 * @param playerId L'id du joueur a placer (ou repositionner).
 * @param pos La cellule cible.
 * @param mySide Le cote du coach courant (A/B) ou null si inconnu.
 */
export function validatePlacement(
  ext: ExtendedGameState,
  playerId: string,
  pos: Position,
  mySide: "A" | "B" | null,
): string | null {
  if (ext.preMatch?.phase !== "setup")
    return "Placement uniquement en phase de configuration";
  const player = ext.players.find((p) => p.id === playerId);
  if (!player) return "Joueur introuvable";
  if (mySide && mySide !== ext.preMatch.currentCoach)
    return "Ce n'est pas votre tour de placer";
  if (mySide && player.team !== mySide)
    return "Vous ne pouvez placer que vos joueurs";
  // Position legale (autorisee par le moteur dans la moitie de terrain).
  const legal = ext.preMatch.legalSetupPositions.some(
    (p) => p.x === pos.x && p.y === pos.y,
  );
  if (!legal)
    return "Position illégale: hors de votre moitié (jusqu'à la LOS)";

  // Aucune collision avec un autre joueur sur la cellule cible.
  const simulatedPlayers = ext.players.map((p) =>
    p.id === playerId ? { ...p, pos } : p,
  );
  const existingPlayerAtPos = simulatedPlayers.find(
    (p) => p.pos.x === pos.x && p.pos.y === pos.y && p.id !== playerId,
  );
  if (existingPlayerAtPos) {
    return "Position déjà occupée par un autre joueur";
  }

  // Maximum 11 joueurs sur le terrain (en tenant compte du repositionnement).
  const teamId = player.team;
  const isRepositioning = player.pos.x >= 0;
  const onPitch = ext.players.filter(
    (p) => p.team === teamId && p.pos.x >= 0,
  ).length;
  const effectiveOnPitch = isRepositioning ? onPitch : onPitch + 1;
  if (effectiveOnPitch > 11) return "Maximum 11 joueurs sur le terrain";

  // Wide zones : max 2 joueurs par WZ apres placement.
  const isLeftWZ = (y: number) => y >= 0 && y <= 2;
  const isRightWZ = (y: number) => y >= 12 && y <= 14;
  const teamPlayersAfter = ext.players
    .map((p) => (p.id === playerId ? { ...p, pos } : p))
    .filter((p) => p.team === teamId && p.pos.x >= 0);
  const leftCount = teamPlayersAfter.filter((p) => isLeftWZ(p.pos.y)).length;
  const rightCount = teamPlayersAfter.filter((p) =>
    isRightWZ(p.pos.y),
  ).length;
  if (leftCount > 2) return "Maximum 2 joueurs dans la large zone gauche";
  if (rightCount > 2) return "Maximum 2 joueurs dans la large zone droite";

  // LOS : au moins 3 joueurs sur la ligne d'engagement avant la fin du
  // placement. On verifie a partir du 9e joueur place car c'est le
  // moment ou il devient possible de bloquer le placement final.
  if (teamPlayersAfter.length >= 9) {
    const isOnLos = (x: number) => (teamId === "A" ? x === 12 : x === 13);
    const losCount = teamPlayersAfter.filter((p) => isOnLos(p.pos.x)).length;
    const remainingPlayers = 11 - teamPlayersAfter.length;
    const minLosRequired = 3;

    if (
      losCount < minLosRequired &&
      losCount + remainingPlayers < minLosRequired
    ) {
      return "Au moins 3 joueurs doivent être sur la LOS";
    }
  }
  return null;
}
