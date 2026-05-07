/**
 * S27.5 — Skeleton Saison 4 Blood Bowl 3 (BB3 — Games Workshop 2025-2026).
 *
 * **VIDE EN ATTENTE DES ROSTERS OFFICIELS GW 2025-2026.**
 *
 * Pattern : meme structure que `season3-rosters.ts`. Quand GW publiera
 * la saison 4 :
 *  1. Ajouter ici les rosters complets sous la cle slug d'equipe :
 *     ```
 *     export const SEASON_FOUR_ROSTERS: Record<string, TeamRoster> = {
 *       skaven: { name: "...", budget: 1_000_000, tier: "I", ..., positions: [...] },
 *       ...
 *     };
 *     ```
 *  2. Le mapping `TEAM_ROSTERS_BY_RULESET` (dans `positions.ts`) charge
 *     deja ce module via l'entree `season_4`. Aucune modification
 *     supplementaire requise.
 *
 * Tant que `SEASON_FOUR_ROSTERS` est vide, la saison 4 est selectionnable
 * comme ruleset mais ne fournit aucune equipe — `getTeamRoster("xxx",
 * "season_4")` renvoie `undefined`. Cela permet a l'infra (UI selecteur,
 * routes API, validation Zod) d'etre prete sans casser quoi que ce soit
 * pour les saisons existantes.
 *
 * Voir aussi `star-players.ts` (`SEASON_FOUR_STAR_PLAYER_OVERRIDES` +
 * `buildSeasonFourStarPlayers()`) pour le meme pattern applique aux
 * Star Players.
 */

import type { TeamRoster } from "./positions";

export const SEASON_FOUR_ROSTERS: Record<string, TeamRoster> = {};
