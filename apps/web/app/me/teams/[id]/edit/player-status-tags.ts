/**
 * Étiquettes d'état d'un joueur dans « Gérer mon équipe ».
 *
 * L'écran d'édition du roster ne montrait ni les morts, ni les joueurs qui
 * ratent le prochain match, ni les Blessures Persistantes : un coach y
 * préparait donc son équipe sans voir qui était réellement disponible. Les
 * mêmes trois informations sont déjà servies par la fiche d'équipe de ligue
 * (`/leagues/[id]/teams/[teamId]`) — on reprend ici son vocabulaire :
 *
 *  - ☠ Mort           : `dead` (le joueur reste au roster, barré) ;
 *  - Absent           : `missNextMatch` (rate le prochain match) ;
 *  - « N BP »         : `nigglingInjuries` (sigle officiel, invariable) ;
 *  - Séquelles        : réductions de caractéristique cumulées.
 *
 * Fonction PURE (aucun accès DOM/API) : le rendu se contente de la mapper.
 */

export interface PlayerStatusSource {
  readonly dead?: boolean | null;
  readonly missNextMatch?: boolean | null;
  readonly nigglingInjuries?: number | null;
  readonly maReduction?: number | null;
  readonly stReduction?: number | null;
  readonly agReduction?: number | null;
  readonly paReduction?: number | null;
  readonly avReduction?: number | null;
}

export type PlayerStatusTagKey = "dead" | "absent" | "niggling" | "sequelae";

export interface PlayerStatusTag {
  readonly key: PlayerStatusTagKey;
  readonly label: string;
  readonly title: string;
  readonly className: string;
}

const DEAD_CLASS = "bg-gray-800 text-white";
const ABSENT_CLASS = "bg-red-100 text-red-700";
const NIGGLING_CLASS = "bg-amber-100 text-amber-800";
const SEQUELAE_CLASS = "bg-orange-100 text-orange-800";

/**
 * Libellé compact des réductions de caractéristique (Séquelles). Même
 * convention d'affichage que la fiche d'équipe de ligue : AG et CP sont des
 * jets à réussir, une « perte » y augmente donc la valeur affichée.
 */
function sequelaeLabel(p: PlayerStatusSource): string {
  const parts: string[] = [];
  if ((p.maReduction ?? 0) > 0) parts.push(`-${p.maReduction} M`);
  if ((p.stReduction ?? 0) > 0) parts.push(`-${p.stReduction} F`);
  if ((p.agReduction ?? 0) > 0) parts.push(`+${p.agReduction} AG`);
  if ((p.paReduction ?? 0) > 0) parts.push(`+${p.paReduction} CP`);
  if ((p.avReduction ?? 0) > 0) parts.push(`-${p.avReduction} AR`);
  return parts.join(", ");
}

/**
 * Étiquettes à afficher pour un joueur, dans l'ordre de gravité
 * (mort > absence > blessures durables). Tableau vide = joueur sain.
 */
export function playerStatusTags(p: PlayerStatusSource): PlayerStatusTag[] {
  const tags: PlayerStatusTag[] = [];
  if (p.dead) {
    tags.push({
      key: "dead",
      label: "☠ Mort",
      title: "Joueur mort — il ne peut plus jouer",
      className: DEAD_CLASS,
    });
  } else if (p.missNextMatch) {
    // Un mort ne « rate » pas le prochain match : il ne joue plus du tout.
    tags.push({
      key: "absent",
      label: "Absent",
      title: "Rate le prochain match (blessure)",
      className: ABSENT_CLASS,
    });
  }
  const bp = p.nigglingInjuries ?? 0;
  if (bp > 0) {
    tags.push({
      key: "niggling",
      label: `${bp} BP`,
      title: `${bp} Blessure(s) Persistante(s)`,
      className: NIGGLING_CLASS,
    });
  }
  const sequelae = sequelaeLabel(p);
  if (sequelae) {
    tags.push({
      key: "sequelae",
      label: sequelae,
      title: "Séquelles (caractéristiques perdues)",
      className: SEQUELAE_CLASS,
    });
  }
  return tags;
}
