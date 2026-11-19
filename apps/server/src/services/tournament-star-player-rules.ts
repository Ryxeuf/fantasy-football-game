/**
 * Règlement de tournoi ↔ Star Players d'une équipe DÉJÀ créée.
 *
 * Le règlement était appliqué à la création (`POST /team/build`) et nulle
 * part ensuite : `POST /team/:id/star-players` recrutait un Star Player
 * banni, sur un roster qui n'y a pas droit, sans taxe de PSP ni cumul retiré.
 * Ce module porte la décision (pure) et sa lecture ; les deux handlers
 * (recrutement, renvoi) et la liste des recrutables en partent.
 *
 * Le pool stocké (`Team.startingPspPool`) est le pool du tier MOINS la taxe
 * des Star Players recrutés à la création. Tout changement de Star Players
 * le déplace donc de l'écart de taxe — dans les deux sens : un renvoi rend
 * la taxe.
 */

import {
  DEFAULT_RULESET,
  getTournamentRosterRules,
  maxTwoSkillPlayersWithStars,
  parseAdvancements,
  tournamentStackingError,
  tournamentStarPlayerSppTax,
  type Ruleset,
  type TournamentRulesetDefinition,
} from '@bb/game-engine';
import { prisma } from '../prisma';
import { getStarPlayerBySlugDb } from '../utils/star-player-repository';
import { isActivePlayer } from './player-status';
import {
  fallbackPspCostForTeam,
  poolSpentForTeamId,
} from './team-advancement-editing';
import { hasSecretWeapon } from './tournament-inducements';
import { getTournamentRulesetDefinition } from './tournament-ruleset-repository';

/** Un Star Player de l'équipe, au prix payé (po). */
export interface PackStar {
  readonly slug: string;
  readonly cost: number;
  /** Porte-t-il Arme Secrète (plafond conditionnel de coups de pouce) ? */
  readonly secretWeapon?: boolean;
}

export interface PackStarChangeInput {
  readonly pack: TournamentRulesetDefinition;
  readonly rosterSlug: string;
  /** Joueurs réguliers actifs (ni morts ni licenciés). */
  readonly regularPlayerCount: number;
  readonly currentStars: readonly PackStar[];
  readonly nextStars: readonly PackStar[];
  /** Pool stocké (tier − taxe courante). */
  readonly startingPspPool: number;
  /** PSP déjà dépensés en compétences. */
  readonly poolSpent: number;
  /** Joueurs portant déjà 2 compétences achetées. */
  readonly doubledPlayers: number;
  /** Coups de pouce achetés à la création (slug → quantité). */
  readonly inducements?: ReadonlyMap<string, number>;
}

export type PackStarChangeDecision =
  | { readonly ok: true; readonly nextPool: number }
  | { readonly ok: false; readonly error: string };

const totalCostK = (stars: readonly PackStar[]): number =>
  stars.reduce((sum, s) => sum + s.cost, 0) / 1000;

/**
 * Le règlement autorise-t-il de passer de `currentStars` à `nextStars` ?
 * Un RENVOI (aucun Star Player ajouté) n'est jamais refusé : il ne fait que
 * rendre la taxe. Un roster que le règlement ne liste pas n'est contraint
 * par rien (même lecture que `isImposedByTournament`).
 */
export function decidePackStarChange(
  input: PackStarChangeInput,
): PackStarChangeDecision {
  const { pack, currentStars, nextStars } = input;
  const rules = getTournamentRosterRules(pack, input.rosterSlug);
  if (!rules) return { ok: true, nextPool: input.startingPspPool };

  const nextPool =
    input.startingPspPool +
    tournamentStarPlayerSppTax(pack, totalCostK(currentStars)) -
    tournamentStarPlayerSppTax(pack, totalCostK(nextStars));

  const currentSlugs = new Set(currentStars.map((s) => s.slug));
  const added = nextStars.filter((s) => !currentSlugs.has(s.slug));
  if (added.length === 0) return { ok: true, nextPool };

  const refuse = (error: string): PackStarChangeDecision => ({
    ok: false,
    error,
  });

  if (!rules.starPlayersAllowed) {
    return refuse(
      `Le règlement ${pack.shortLabel} n'autorise pas les Star Players pour ce roster`,
    );
  }
  const banned = added.filter((s) => pack.bannedStarPlayers.includes(s.slug));
  if (banned.length > 0) {
    return refuse(
      `Star Player(s) interdit(s) par le règlement ${pack.shortLabel} : ${banned.map((s) => s.slug).join(', ')}`,
    );
  }
  if (input.regularPlayerCount < pack.minRegularPlayersBeforeStars) {
    return refuse(
      `Le règlement ${pack.shortLabel} exige ${pack.minRegularPlayersBeforeStars} joueurs réguliers avant de recruter un Star Player (${input.regularPlayerCount} dans l'équipe)`,
    );
  }
  if (nextPool < input.poolSpent) {
    const tax = input.startingPspPool - nextPool;
    return refuse(
      `Budget SPP insuffisant pour la taxe Star Players : ${tax} SPP de plus, ${Math.max(0, input.startingPspPool - input.poolSpent)} disponible(s). Retirez d'abord des compétences.`,
    );
  }
  if (
    input.doubledPlayers >
    maxTwoSkillPlayersWithStars(pack, rules, nextStars.length)
  ) {
    return refuse(
      `${tournamentStackingError(pack, rules, nextStars.length)}. Retirez d'abord une compétence.`,
    );
  }
  if (nextStars.some((s) => s.secretWeapon)) {
    for (const rule of pack.allowedInducements) {
      const cap = rule.maxWithSecretWeaponStar;
      const owned = input.inducements?.get(rule.slug) ?? 0;
      if (cap !== undefined && owned > cap) {
        return refuse(
          `Le règlement ${pack.shortLabel} limite « ${rule.slug} » à ${cap} avec un Star Player à Arme Secrète (${owned} acheté(s))`,
        );
      }
    }
  }
  return { ok: true, nextPool };
}

/**
 * Pourquoi le règlement ferme-t-il CE Star Player à ce roster, quel que soit
 * l'état de l'équipe ? `null` = il ne le ferme pas. Sert la liste des
 * recrutables (`canHire`) sans rejouer la décision complète par candidat.
 */
export function packStarBlockReason(
  pack: TournamentRulesetDefinition | null,
  rosterSlug: string,
  starSlug: string,
): string | null {
  if (!pack) return null;
  const rules = getTournamentRosterRules(pack, rosterSlug);
  if (!rules) return null;
  if (!rules.starPlayersAllowed) {
    return `Le règlement ${pack.shortLabel} n'autorise pas les Star Players pour ce roster`;
  }
  if (pack.bannedStarPlayers.includes(starSlug)) {
    return `Star Player interdit par le règlement ${pack.shortLabel}`;
  }
  return null;
}

/** Équipe telle que la chargent les handlers de Star Players. */
export interface PackStarTeam {
  readonly id: string;
  readonly roster: string;
  readonly ruleset?: string | null;
  readonly tournamentRuleset?: string | null;
  readonly startingPspPool?: number | null;
  readonly players: ReadonlyArray<{
    readonly dead?: boolean | null;
    readonly firedAt?: Date | null;
    readonly advancements?: unknown;
  }>;
  readonly starPlayers: ReadonlyArray<{
    readonly starPlayerSlug: string;
    readonly cost: number;
  }>;
}

/**
 * Décision du règlement de l'équipe pour un nouvel ensemble de Star Players
 * (`{ slug, cost }` en po). `null` = équipe sans règlement : rien à vérifier,
 * rien à écrire — et aucune requête de plus.
 */
export async function decidePackStarChangeForTeam(
  team: PackStarTeam,
  nextStars: ReadonlyArray<{ readonly slug: string; readonly cost: number }>,
): Promise<PackStarChangeDecision | null> {
  if (!team.tournamentRuleset) return null;
  const pack = await getTournamentRulesetDefinition(team.tournamentRuleset);
  if (!pack) return null;

  const ruleset = (team.ruleset ?? DEFAULT_RULESET) as Ruleset;
  const withSecretWeapon = async (star: {
    slug: string;
    cost: number;
  }): Promise<PackStar> => ({
    ...star,
    secretWeapon: hasSecretWeapon(
      (await getStarPlayerBySlugDb(star.slug, ruleset))?.skills,
    ),
  });

  const [next, poolSpent, inducementRows] = await Promise.all([
    Promise.all(nextStars.map(withSecretWeapon)),
    poolSpentForTeamId(
      team.id,
      await fallbackPspCostForTeam(team.tournamentRuleset, team.ruleset ?? null),
    ),
    prisma.teamInducement.findMany({
      where: { teamId: team.id },
      select: { slug: true, quantity: true },
    }),
  ]);

  const active = team.players.filter((p) =>
    isActivePlayer(p),
  );
  return decidePackStarChange({
    pack,
    rosterSlug: team.roster,
    regularPlayerCount: active.length,
    currentStars: team.starPlayers.map((s) => ({
      slug: s.starPlayerSlug,
      cost: s.cost,
    })),
    nextStars: next,
    startingPspPool: team.startingPspPool ?? 0,
    poolSpent,
    doubledPlayers: active.filter(
      (p) => parseAdvancements(p.advancements).length >= 2,
    ).length,
    inducements: new Map(
      inducementRows.map((r: { slug: string; quantity: number }) => [
        r.slug,
        r.quantity,
      ]),
    ),
  });
}
