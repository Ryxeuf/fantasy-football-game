/**
 * Logique d'affichage PURE de la fiche admin d'une équipe
 * (`/admin/teams/[id]`). Tout ce qui se teste sans monter React vit ici :
 * la page se contente de câbler.
 */

/** Slug de position d'un journalier/Star Player synthétique de feuille. */
export interface AdminTeamPlayer {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly number: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: string;
  readonly spp?: number;
  readonly matchesPlayed?: number;
  readonly dead?: boolean;
  readonly firedAt?: string | null;
  readonly missNextMatch?: boolean;
  readonly nigglingInjuries?: number;
  readonly isCaptain?: boolean;
}

export interface AdminOwnerTeam {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset: string;
  readonly teamValue: number;
  readonly currentValue: number;
  readonly createdAt: string;
  readonly deletedAt: string | null;
  readonly playerCount: number;
}

/** Montant en po -> « 1 000k po ». `formatCurrency` de la liste admin. */
export function formatGold(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value / 1000).toLocaleString("fr-FR")}k po`;
}

export type PlayerStatus = "active" | "dead" | "fired";

/**
 * Statut d'un joueur, dérivé comme partout ailleurs de `dead`/`firedAt`
 * (cf. `services/player-status.ts` côté serveur) : la mort prime sur le
 * licenciement.
 */
export function playerStatusOf(player: AdminTeamPlayer): PlayerStatus {
  if (player.dead) return "dead";
  if (player.firedAt) return "fired";
  return "active";
}

export const PLAYER_STATUS_BADGES: Record<
  Exclude<PlayerStatus, "active">,
  { readonly label: string; readonly className: string }
> = {
  dead: { label: "Mort", className: "bg-red-100 text-red-800" },
  fired: { label: "Licencié", className: "bg-gray-200 text-gray-700" },
};

/** Joueurs triés par numéro croissant, sans muter le tableau source. */
export function sortPlayersByNumber(
  players: readonly AdminTeamPlayer[],
): AdminTeamPlayer[] {
  return [...players].sort((a, b) => a.number - b.number);
}

/** Compte les joueurs par statut — l'en-tête annonce le roster ACTIF. */
export function countPlayersByStatus(players: readonly AdminTeamPlayer[]): {
  readonly active: number;
  readonly dead: number;
  readonly fired: number;
} {
  let active = 0;
  let dead = 0;
  let fired = 0;
  for (const player of players) {
    const status = playerStatusOf(player);
    if (status === "dead") dead += 1;
    else if (status === "fired") fired += 1;
    else active += 1;
  }
  return { active, dead, fired };
}

export interface OwnerTeamNavigation {
  /** Toutes les équipes du coach, ordre serveur préservé (récent d'abord). */
  readonly teams: readonly AdminOwnerTeam[];
  /** Rang 1-indexé de l'équipe courante, 0 si absente de la liste. */
  readonly position: number;
  readonly total: number;
  /** Équipe précédente/suivante dans la liste, null aux extrémités. */
  readonly previous: AdminOwnerTeam | null;
  readonly next: AdminOwnerTeam | null;
}

/**
 * Navigation entre les équipes d'un même coach. La liste vient du serveur
 * déjà triée (plus récente d'abord) : on ne la réordonne pas, on se contente
 * d'y situer l'équipe courante. Une équipe absente de la liste (cas
 * théorique d'incohérence) ne casse rien — on renvoie une navigation vide
 * plutôt que de désigner un voisin arbitraire.
 */
export function buildOwnerTeamNavigation(
  teams: readonly AdminOwnerTeam[] | null | undefined,
  currentTeamId: string,
): OwnerTeamNavigation {
  const list = teams ?? [];
  const index = list.findIndex((team) => team.id === currentTeamId);
  if (index === -1) {
    return {
      teams: list,
      position: 0,
      total: list.length,
      previous: null,
      next: null,
    };
  }
  return {
    teams: list,
    position: index + 1,
    total: list.length,
    previous: index > 0 ? list[index - 1] : null,
    next: index < list.length - 1 ? list[index + 1] : null,
  };
}

const RULESET_LABELS: Record<string, string> = {
  season_2: "Saison 2",
  season_3: "Saison 3",
};

export function rulesetLabel(ruleset: string | null | undefined): string {
  if (!ruleset) return "—";
  return RULESET_LABELS[ruleset] ?? ruleset;
}
