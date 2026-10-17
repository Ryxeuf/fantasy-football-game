/**
 * Rejeu PUR du journal d'une feuille de COUPE en actions de match local
 * (`LocalMatchAction`).
 *
 * Extrait de `cup-match-sheet` (qui écrit en base) pour être lu sans Prisma :
 * la matérialisation d'une feuille validée ET la carrière d'un joueur
 * (`player-career-stats`) partagent ainsi la même traduction évènement →
 * geste compté. Une seule définition, donc la carte d'un joueur et les
 * classements individuels de la coupe ne peuvent pas diverger.
 */

import type { MatchEventKind, MatchEventTeam } from "./league-match-summary";

/** Événement de feuille, réduit à ce dont la matérialisation a besoin. */
export interface CupSheetEvent {
  readonly kind: MatchEventKind | string;
  readonly team?: MatchEventTeam | string | null;
  readonly actorPlayerId?: string | null;
  readonly targetPlayerId?: string | null;
  readonly causeDetail?: string | null;
  readonly injurySeverity?: string | null;
  readonly meta?: unknown;
}

/** Ligne `LocalMatchAction` à créer (sans `matchId`). */
export interface CupLocalMatchActionDraft {
  readonly half: number;
  readonly turn: number;
  readonly actionType: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly playerTeam: "A" | "B";
  readonly opponentId: string | null;
  readonly opponentName: string | null;
  readonly armorBroken: boolean;
  readonly opponentState: string | null;
}

/** Résolution `playerId -> nom affiché` (roster figé de la feuille). */
export type CupPlayerNameResolver = (playerId: string) => string | null;

function metaNumber(meta: unknown, key: "half" | "turn"): number | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Marque « cible sortie » d'une agression saisie en mode SIMPLIFIÉ
 * (`meta.eliminated === true`), qui ne porte pas de gravité. Lue par la seule
 * matérialisation de coupe : la ligue n'en écrit jamais et n'en lit jamais.
 * Strictement booléenne — aucune sortie n'est DÉDUITE d'une autre valeur.
 */
function isMarkedEliminated(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  return (meta as Record<string, unknown>).eliminated === true;
}

/**
 * Type d'action `LocalMatchAction` correspondant à une sortie infligée AU
 * CONTACT. Le cause detail d'un `casualty` porte le geste : seuls le blocage
 * et le blitz rapportent les points « sortie sur blocage » d'une coupe — une
 * esquive ratée ou la foule n'ont pas d'auteur.
 */
function contactActionType(causeDetail: string | null | undefined): string | null {
  if (causeDetail === "blitz") return "blitz";
  if (!causeDetail || causeDetail === "block") return "blocage";
  return null;
}

/**
 * Rejoue le journal d'une feuille en actions de match local. PUR :
 * l'appelant fournit la résolution des noms, aucune I/O ici.
 *
 * Seuls les gestes que le barème d'une coupe sait compter sont produits :
 * touchdown, sortie au contact (blocage / blitz), sortie à l'agression,
 * passe réussie et interception. Les autres évènements (coup d'envoi,
 * expulsion, temporisation…) restent dans la feuille, qui reste la source
 * de vérité de la rencontre.
 */
export function sheetEventsToLocalMatchActions(
  events: readonly CupSheetEvent[],
  resolveName: CupPlayerNameResolver,
): CupLocalMatchActionDraft[] {
  const out: CupLocalMatchActionDraft[] = [];
  for (const event of events) {
    const side = event.team === "home" ? "A" : event.team === "away" ? "B" : null;
    const actor = event.actorPlayerId ?? null;
    if (!side || !actor) continue;

    const half = metaNumber(event.meta, "half") ?? 1;
    const turn = metaNumber(event.meta, "turn") ?? 1;
    const base = {
      half,
      turn,
      playerId: actor,
      playerName: resolveName(actor) ?? "Joueur",
      playerTeam: side as "A" | "B",
      opponentId: event.targetPlayerId ?? null,
      opponentName: event.targetPlayerId
        ? (resolveName(event.targetPlayerId) ?? "Joueur")
        : null,
    };

    switch (event.kind) {
      case "touchdown":
        out.push({
          ...base,
          actionType: "td",
          opponentId: null,
          opponentName: null,
          armorBroken: false,
          opponentState: null,
        });
        break;
      case "casualty": {
        const actionType = contactActionType(event.causeDetail);
        if (!actionType) break;
        out.push({
          ...base,
          actionType,
          armorBroken: true,
          opponentState: "elimine",
        });
        break;
      }
      case "aggression": {
        // Une agression ne marque des points que si elle SORT le joueur :
        // une gravité saisie (saisie complète) OU la marque « cible sortie »
        // de la saisie simplifiée, qui ne demande pas de gravité.
        const eliminated =
          Boolean(event.injurySeverity) || isMarkedEliminated(event.meta);
        out.push({
          ...base,
          actionType: "aggression",
          armorBroken: eliminated,
          opponentState: eliminated ? "elimine" : null,
        });
        break;
      }
      case "pass_complete":
        out.push({
          ...base,
          actionType: "passe",
          armorBroken: false,
          opponentState: null,
        });
        break;
      case "interception":
        out.push({
          ...base,
          actionType: "interception",
          armorBroken: false,
          opponentState: null,
        });
        break;
      default:
        break;
    }
  }
  return out;
}
