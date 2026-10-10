/**
 * Catalogue EFFECTIF de coups de pouce d'une équipe dans son contexte —
 * accès apothicaire et règles spéciales lus en base, Ligue régionale,
 * remises, liste de la compétition, règlement de tournoi.
 *
 * Partagé par la feuille de match (avant-match) et par la construction
 * d'équipe (coupe en mode `build`, règlement de tournoi) : une seule
 * résolution, sinon le builder et la feuille finiraient par servir deux
 * prix différents pour le même coup de pouce.
 */

import {
  INDUCEMENT_CATALOGUE,
  canPurchaseInducement,
  getInducementCost,
  getInducementMaxQuantity,
  qualifiesForInducementDiscount,
  resolveTeamRegionalRules,
  type InducementContext,
  type Ruleset,
  type TournamentRulesetDefinition,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { resolveSpecialRulesForTeam } from "../utils/team-values";
import { getDeclaredRegionalRules } from "../utils/roster-helpers";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import { loadInducementCatalogue } from "./inducement-repository";
import {
  applyPackInducementRules,
  effectiveInducementAllowlist,
  hasSecretWeapon,
} from "./tournament-inducements";
import { getStarPlayerBySlugDb } from "../utils/star-player-repository";

/** Une option de coup de pouce, prix et plafond résolus pour l'équipe. */
export interface InducementOption {
  readonly slug: string;
  readonly name: string;
  readonly cost: number;
  readonly maxQuantity: number;
  readonly description: string;
  /** A53 — prix variable (ex: Mercenaires) : le coach saisit le coût. */
  readonly variableCost?: boolean;
}

/**
 * Catalogue de coups de pouce ACCESSIBLES a une equipe : on filtre selon
 * `canPurchase` (apothicaire itinerant / Igor selon l'acces apothicaire du
 * roster) et on resout le cout effectif (rabais regional). `star_player`
 * est traite a part. Suit les regles officielles d'acces par equipe.
 */
export async function inducementOptionsFor(
  roster: string,
  // Ruleset REEL de l'équipe : `DEFAULT_RULESET` était forcé ici, donc les
  // Ligues et remises d'une équipe Saison 2 étaient arbitrées sur la table
  // Saison 3 (S8 de l'audit).
  ruleset: Ruleset,
  // FR17 — allowlist de coups de pouce au niveau ligue. `null` = tous
  // autorisés (défaut). Les Star Players ne sont jamais filtrés ici.
  allowedInducements: string[] | null = null,
  // Ligue régionale CHOISIE par l'équipe : c'est elle (et l'alignement
  // qu'elle apporte) qui ouvre les Coups de Pouce régionaux, pas l'union
  // des Ligues du roster. `null` = équipe sans choix enregistré.
  regionalLeague: string | null = null,
  // Règlement de tournoi de la ligue : liste FERMÉE de coups de pouce, avec
  // ses prix et quantités (ils priment sur le catalogue du moteur).
  pack: TournamentRulesetDefinition | null = null,
  // Ce que l'équipe a déjà recruté et qui borne le règlement (Star Player à
  // Arme Secrète ⇒ Pots-de-vin plafonnés sous NAF WC 2027).
  team: { readonly hasSecretWeaponStar?: boolean } = {},
): Promise<InducementOption[]> {
  // Acces apothicaire et regles speciales lus EN BASE
  // (`RosterStaffConfig.apothecaryAllowed`, `Roster.specialRules`) : ils
  // arbitrent le prix, la quantite et la disponibilite des coups de pouce,
  // donc le debit de tresorerie post-match (S9 de l'audit). Les tables
  // compilees `APOTHECARY_FORBIDDEN_ROSTERS` / `getSpecialRulesForTeam` ne
  // sont plus que le repli, porte par les resolveurs eux-memes.
  const [declaredRules, staffConfig, specialRules, catalogue] =
    await Promise.all([
      getDeclaredRegionalRules(roster, ruleset),
      // Le Jeu en Ligue se joue en BB11 : la config staff est declaree par
      // couple roster x format et la feuille de ligue n'a pas d'autre format.
      resolveStaffConfigBySlug(roster, ruleset, "bb11"),
      resolveSpecialRulesForTeam(prisma, roster, ruleset),
      // Lot 6.1 — prix, plafonds et conditions servis par la base.
      loadInducementCatalogue(ruleset),
    ]);
  const ctx: InducementContext = {
    teamId: "A" as const,
    regionalRules: resolveTeamRegionalRules(
      roster,
      ruleset,
      regionalLeague,
      // Ligues DÉCLARÉES par le roster (`Roster.regionalRules`) : sans elles
      // la résolution retombe sur la table compilée et une Ligue éditée en
      // admin ne changeait ni les remises ni l'offre de stars.
      declaredRules,
    ),
    hasApothecary: staffConfig.apothecaryAllowed,
    rosterSlug: roster,
    // A53 — les restrictions/remises officielles dépendent des règles
    // spéciales d'équipe (Maîtres de la Non-vie, Chantage et Corruption…).
    specialRules: [...specialRules],
    ruleset,
    catalogue,
  };
  const effective = effectiveInducementAllowlist(allowedInducements, pack);
  const allow = effective ? new Set(effective) : null;
  // Lot 6.1 — catalogue servi par la base (`Inducement`), repli compilé.
  const options = (ctx.catalogue ?? INDUCEMENT_CATALOGUE)
    .filter((d) => d.slug !== "star_player")
    .filter((d) => canPurchaseInducement(d, ctx))
    .filter((d) => allow === null || allow.has(d.slug))
    .map((d) => ({
      slug: d.slug,
      name: d.displayNameFr,
      cost: getInducementCost(d.slug, ctx),
      maxQuantity: getInducementMaxQuantity(d.slug, ctx),
      description: d.description,
      ...(d.variableCost ? { variableCost: true } : {}),
    }));
  // Prix, quantités et précisions du règlement priment sur le catalogue. Le
  // règlement fixe le montant d'une remise, le catalogue désigne qui y a
  // droit (Pots-de-vin pour Chantage et Corruption, Chef pour les Halflings).
  const defsBySlug = new Map(
    (ctx.catalogue ?? INDUCEMENT_CATALOGUE).map((d) => [d.slug, d]),
  );
  return applyPackInducementRules(options, pack, {
    hasSecretWeaponStar: team.hasSecretWeaponStar ?? false,
    qualifiesForDiscount: (slug) => {
      const def = defsBySlug.get(slug);
      return def ? qualifiesForInducementDiscount(def, ctx) : false;
    },
  }) as InducementOption[];
}

/** Contexte de construction d'une équipe pour le catalogue du builder. */
export interface BuildInducementCatalogueInput {
  readonly roster: string;
  readonly ruleset: Ruleset;
  readonly regionalLeague?: string | null;
  /** Règlement de tournoi (liste fermée, prix imposés). */
  readonly pack?: TournamentRulesetDefinition | null;
  /** Liste autorisée par la coupe (`null` = tout le catalogue). */
  readonly allowlist?: string[] | null;
  /** Star Players recrutés au même build (plafond Arme Secrète). */
  readonly hiredStarSlugs?: readonly string[];
}

/**
 * Catalogue de coups de pouce achetables À LA CONSTRUCTION. Même résolution
 * que la feuille (`inducementOptionsFor`), moins :
 *  - les Star Players, qui ont leur propre sélecteur au builder ;
 *  - les coups de pouce à coût VARIABLE (Mercenaires) : leur prix dépend
 *    d'un choix de poste et de compétence que le builder ne sait pas porter.
 */
export async function buildInducementCatalogue(
  input: BuildInducementCatalogueInput,
): Promise<InducementOption[]> {
  const hasSecretWeaponStar = await anyStarHasSecretWeapon(
    input.hiredStarSlugs ?? [],
    input.ruleset,
  );
  const options = await inducementOptionsFor(
    input.roster,
    input.ruleset,
    input.allowlist ?? null,
    input.regionalLeague ?? null,
    input.pack ?? null,
    { hasSecretWeaponStar },
  );
  return options.filter((o) => o.slug !== "star_player" && !o.variableCost);
}

/** Un des Star Players recrutés porte-t-il Arme Secrète (fiche en base) ? */
async function anyStarHasSecretWeapon(
  slugs: readonly string[],
  ruleset: Ruleset,
): Promise<boolean> {
  for (const slug of slugs) {
    try {
      const def = await getStarPlayerBySlugDb(slug, ruleset);
      if (hasSecretWeapon(def?.skills)) return true;
    } catch {
      // Fiche illisible : on ne présume pas d'Arme Secrète.
    }
  }
  return false;
}
