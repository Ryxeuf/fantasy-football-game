/**
 * Textes d'aperçu d'un roster partagé — titre, description, troncature.
 *
 * Pourquoi un module dédié : les trois surfaces de partage (metadata HTML
 * de `/r/[token]`, metadata de `/me/teams/[id]`, sous-titre de l'image OG)
 * doivent afficher LE MÊME texte, à la longueur près. Les avoir écrites
 * trois fois, c'est se garantir qu'elles divergeront.
 *
 * 100 % pur : aucune dépendance React, satori ou réseau.
 */

/** Nom du site, toujours présent dans le titre d'un aperçu partagé. */
export const SITE_NAME = "Nuffle Arena";

/**
 * Borne de la meta description. Les scrapers coupent de toute façon entre
 * 150 et 300 caractères ; tronquer nous-mêmes évite une phrase amputée au
 * milieu d'un mot.
 */
export const SHARE_DESCRIPTION_MAX = 200;

/**
 * Borne du sous-titre de l'image OG. Plus courte que la meta : le bloc
 * dispose de deux ou trois lignes dans la carte, au-delà il pousserait les
 * badges hors du cadre.
 */
export const OG_SUBTITLE_MAX = 120;

/**
 * Tronque sur une frontière de mot et suffixe une ellipse.
 *
 * Le texte est d'abord normalisé (retours à la ligne et espaces multiples
 * ramenés à une espace) : une description sur trois paragraphes doit tenir
 * sur une ligne dans un aperçu.
 */
export function truncateOnWordBoundary(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  // -1 pour laisser la place à l'ellipse.
  const hardCut = normalized.slice(0, max - 1);
  const lastSpace = hardCut.lastIndexOf(" ");
  // Un mot unique plus long que la borne n'a pas d'espace où couper : on
  // coupe alors au caractère plutôt que de rendre une chaîne vide.
  const cut = lastSpace > max / 2 ? hardCut.slice(0, lastSpace) : hardCut;
  return `${cut.replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * Titre d'aperçu d'un roster : nom de l'équipe ET nom du site.
 *
 * Le nom du site est écrit ICI plutôt que laissé au `title.template` de
 * `app/layout.tsx` : ce template ne s'applique qu'à `<title>`, pas à
 * `og:title`, et c'est justement `og:title` que Discord, Slack et X
 * affichent.
 */
export function buildRosterShareTitle(input: {
  teamName: string;
  raceName?: string;
}): string {
  const race = input.raceName?.trim();
  const head = race ? `${input.teamName} — ${race}` : input.teamName;
  return `${head} | ${SITE_NAME}`;
}

export interface RosterShareDescriptionInput {
  teamName: string;
  raceName: string;
  playerCount: number;
  teamValue: number;
  /** Fluff saisi par le coach. Prend la place du texte généré. */
  description?: string | null;
  /** Borne de troncature (défaut : la meta description). */
  max?: number;
}

/** Formate une valeur en or : 1150000 → « 1 150 000 ». */
function formatGold(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString("fr-FR");
}

/**
 * Texte d'aperçu d'un roster.
 *
 * Quand le coach a écrit une description, c'est ELLE qui est servie : le
 * fluff d'une équipe dit mieux ce qu'est cette équipe que trois chiffres.
 * Sinon, repli sur la description générée (race, effectif, VE) — jamais
 * sur le texte générique du site, qui ne dit rien du roster partagé.
 */
export function buildRosterShareDescription(
  input: RosterShareDescriptionInput,
): string {
  const max = input.max ?? SHARE_DESCRIPTION_MAX;
  const own = input.description?.trim();
  if (own) return truncateOnWordBoundary(own, max);

  const generated = `Découvrez ${input.teamName}, équipe ${input.raceName} Blood Bowl : ${input.playerCount} joueurs, valeur d'équipe ${formatGold(input.teamValue)} po. Composée sur ${SITE_NAME}.`;
  return truncateOnWordBoundary(generated, max);
}
