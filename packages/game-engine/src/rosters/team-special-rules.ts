/**
 * Règles spéciales d'équipes Blood Bowl Saison 3.
 *
 * Source : retranscription OCR officielle (docs/reference/extraction_blood_bowl.md,
 * docs/reference/extraction_competences_blood_bowl.md). Ce fichier expose le catalogue
 * canonique des règles spéciales d'équipe, indépendamment de l'attribution
 * roster-par-roster (qui reste configurée via `Roster.specialRules` dans la
 * base et `TeamRoster.specialRules` côté game-engine).
 *
 * Les règles spéciales sont des effets globaux qui s'appliquent à toute une
 * équipe (et non à un joueur individuel comme les Compétences/Traits) : impact
 * sur les PSP gagnés, accès à des Coups de Pouce particuliers, mécanique
 * autour des Star Players "Favori de...", etc.
 */

export interface TeamSpecialRuleDefinition {
  /** Slug unique en snake_case ASCII (utilisé en clé en base et dans l'API). */
  slug: string;
  /** Nom officiel français. */
  nameFr: string;
  /** Nom officiel anglais (canonique GW). */
  nameEn: string;
  /** Description complète en français issue du livre de règles. */
  description: string;
  /** Description anglaise correspondante. */
  descriptionEn?: string;
}

/**
 * Catalogue des règles spéciales d'équipe officielles.
 *
 * NB : les règles ci-dessous sont les règles "globales" applicables à une
 * équipe entière. La règle "Favori de..." existe en plusieurs alignements
 * (Hashut, Khorne, Nurgle, Slaanesh, Tzeentch, Chaos Universel) ; chacune
 * partage la même mécanique mais débloque des Star Players différents.
 */
export const TEAM_SPECIAL_RULES: TeamSpecialRuleDefinition[] = [
  {
    slug: "bagarreurs_brutaux",
    nameFr: "Bagarreurs Brutaux",
    nameEn: "Bruisers",
    description:
      "Pour ces équipes, Blood Bowl est synonyme de violence, et ils n'hésitent pas à se jeter dans la mêlée sitôt que le sifflet retentit. En Jeu en Ligue, une équipe avec cette règle spéciale gagne des PSP un peu différemment : les joueurs gagnent 3 PSP au lieu de 2 pour avoir infligé une Élimination, et seulement 2 PSP au lieu de 3 pour avoir marqué un Touchdown.",
    descriptionEn:
      "For these teams, Blood Bowl is synonymous with violence and they throw themselves into the fray as soon as the whistle blows. In League play, players on this team gain 3 SPP instead of 2 for inflicting a Casualty, and only 2 SPP instead of 3 for scoring a Touchdown.",
  },
  {
    slug: "chantage_et_corruption",
    nameFr: "Chantage et Corruption",
    nameEn: "Bribery and Corruption",
    description:
      "Ces équipes sont notoirement sans scrupule : elles tordent les règles à la limite de l'infraction et n'hésitent pas à graisser la patte des officiels. Une fois par match, quand une équipe ayant cette règle spéciale obtient un 1 pour Contester la Décision, elle peut relancer le D6.",
    descriptionEn:
      "These teams are notoriously unscrupulous and known for bending rules to the breaking point and bribing officials. Once per match, when a team with this special rule rolls a 1 on an Argue the Call attempt, they may re-roll the D6.",
  },
  {
    slug: "favori_de",
    nameFr: "Favori de...",
    nameEn: "Favoured of...",
    description:
      "Les partisans des Dieux du Chaos sont attirés par la nature violente du Blood Bowl. Certaines équipes ont un alignement automatique (ex. Favoris de Khorne), d'autres ont le choix lors de la création de la Liste d'Équipe (ex. Favoris de [Khorne, Nurgle, Slaanesh ou Tzeentch]). Ce choix est définitif. Certains Star Players ne peuvent jouer que pour des équipes alignées sur un Dieu spécifique. Alignements possibles : Hashut, Khorne, Nurgle, Slaanesh, Tzeentch, Chaos Universel.",
    descriptionEn:
      "Followers of the Chaos Gods are naturally drawn to the violent nature of Blood Bowl. Some teams have an automatic alignment (e.g. Favoured of Khorne), others choose at roster creation between several options (e.g. Favoured of [Khorne, Nurgle, Slaanesh or Tzeentch]). The choice is permanent. Some Star Players can only play for teams Favoured by a specific Chaos God. Available alignments: Hashut, Khorne, Nurgle, Slaanesh, Tzeentch, Universal Chaos.",
  },
  {
    slug: "trois_quarts_a_vil_prix",
    nameFr: "Trois-quarts à vil prix",
    nameEn: "Cheap Linemen",
    description:
      "Certaines équipes ont si peu d'égard pour leurs trois-quarts qu'elles ne se préoccupent pas toujours de les rémunérer. En Jeu en Ligue, quand une équipe ayant cette règle spéciale calcule sa Valeur d'Équipe Actuelle, traitez les Coûts d'Embauche des joueurs Trois-quarts comme étant de 0 pièce d'or. Toute augmentation de valeur de ces joueurs est incluse normalement.",
    descriptionEn:
      "Some teams have so little regard for their linemen that they don't always bother paying them. In League play, when a team with this special rule calculates its Current Team Value, treat the hiring cost of Lineman players as 0 gold pieces. Any increase in value gained by these players is included normally.",
  },
  {
    slug: "maitres_de_la_non_vie",
    nameFr: "Maîtres de la Non-vie",
    nameEn: "Masters of Undeath",
    description:
      "Une fois par match, si un joueur adverse ayant une Force de 4 ou moins et n'ayant pas le Trait Minus subit un résultat Mort lors du jet sur le Tableau d'Élimination, une équipe avec cette règle spéciale peut Relever le Mort : elle ajoute immédiatement un joueur Trois-quart depuis sa Fiche d'Équipe à son Box des Réserves (ce qui peut amener temporairement plus de 16 joueurs). À la Séquence d'Après Match, ce nouveau joueur peut être embauché gratuitement à condition que la Liste d'Équipe ne compte pas déjà 16 joueurs.",
    descriptionEn:
      "Once per match, if an opposition player with Strength 4 or less and without the Titchy trait suffers a Dead result on the Casualty table, a team with this special rule may Raise the Dead: they immediately add a Lineman player from their roster to their Reserves Box (this can temporarily exceed 16 players). During the Post-Game Sequence, this new player can be hired for free, provided the team roster doesn't already contain 16 players.",
  },
  {
    slug: "deferlement",
    nameFr: "Déferlement",
    nameEn: "Swarming",
    description:
      "Ces équipes regorgent de petits joueurs prêts à tous les mauvais coups, et la plupart des arbitres se montrent plus laxistes sur la règle des onze joueurs. Pendant la Séquence de Début de Phase, après que les deux équipes ont placé leurs joueurs, une équipe avec cette règle spéciale peut placer sur le terrain D3 joueurs Trois-quarts supplémentaires depuis son Box des Réserves, en respectant toutes les règles normales de placement. Ceci permet à une équipe de dépasser le maximum habituel de 11 joueurs sur le terrain.",
    descriptionEn:
      "These teams are full of small troublemakers, and most referees turn a blind eye to the eleven-player rule. During the Start of Drive Sequence, after both teams have set up, a team with this special rule may place D3 additional Lineman players from their Reserves Box on the pitch, following all normal setup rules. This allows the team to exceed the usual eleven-player maximum.",
  },
  {
    slug: "capitaine",
    nameFr: "Capitaine",
    nameEn: "Captain",
    description:
      "Quand vous sélectionnez une Liste d'Équipe pour une équipe avec cette règle spéciale, vous pouvez désigner n'importe quel joueur de votre liste de départ (sauf un Gros Bras) pour qu'il soit le Capitaine. Le Capitaine gagne immédiatement la Compétence Pro sans augmenter son coût. De plus, si votre Capitaine est sur le terrain, chaque fois que vous utilisez une Relance d'Équipe, jetez un D6 ; sur un 6 naturel, la Relance d'Équipe est gratuite. Lors du placement, vous devez aligner votre Capitaine si possible. Un Capitaine ne peut être renvoyé que s'il a subi une blessure réduisant une caractéristique. S'il est tué, vous pouvez nommer un nouveau Capitaine après le match.",
    descriptionEn:
      "When you select a roster for a team with this special rule, you may designate any starting player (except a Big Guy) to be the Captain. The Captain immediately gains the Pro Skill at no cost increase. Additionally, while the Captain is on the pitch, each time you use a Team Re-roll, roll a D6; on a natural 6, the Team Re-roll is free. The Captain must be set up whenever possible. A Captain may only be fired if they have suffered a stat-reducing injury. If killed, you may name a new Captain after the match.",
  },
];

/** Index par slug pour accès O(1). */
export const TEAM_SPECIAL_RULES_BY_SLUG: Record<string, TeamSpecialRuleDefinition> =
  TEAM_SPECIAL_RULES.reduce<Record<string, TeamSpecialRuleDefinition>>(
    (acc, rule) => {
      acc[rule.slug] = rule;
      return acc;
    },
    {},
  );

/** Récupère une règle spéciale par son slug. */
export function getTeamSpecialRuleBySlug(
  slug: string,
): TeamSpecialRuleDefinition | null {
  return TEAM_SPECIAL_RULES_BY_SLUG[slug] ?? null;
}

/** Type utilitaire des slugs valides. */
export type TeamSpecialRuleSlug = (typeof TEAM_SPECIAL_RULES)[number]["slug"];

import { TEAM_ROSTERS_BY_RULESET, DEFAULT_RULESET, type Ruleset } from "./positions";

/**
 * A53 — règles spéciales d'une équipe (slugs) depuis la source statique
 * des rosters (`TeamRoster.specialRules`, CSV). Sert notamment aux
 * restrictions/remises des Coups de Pouce (Assistant Funéraire, Pots-de-vin
 * à 50k avec Chantage et Corruption…).
 */
export function getSpecialRulesForTeam(
  rosterSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): string[] {
  const map = TEAM_ROSTERS_BY_RULESET[ruleset] ?? TEAM_ROSTERS_BY_RULESET[DEFAULT_RULESET];
  const csv = (map[rosterSlug] as { specialRules?: string } | undefined)?.specialRules ?? "";
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
