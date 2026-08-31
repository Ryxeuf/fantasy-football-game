/**
 * Helpers d'affichage pour les rosters partagés.
 *
 * Les équipes utilisateur ne stockent que le slug de race (ex.
 * "imperial_nobility") et les Star Players que leur slug
 * ("griff_oberwald"). Faute de nom localisé dans le payload public, on
 * prettifie le slug en Title Case — suffisant pour l'affichage et l'OG.
 *
 * Il n'y a volontairement PAS de parseur de compétences ici : `TeamPlayer.skills`
 * est une CSV de slugs (« block,dodge »), pas du JSON. Le parseur maison qui
 * vivait dans ce module tentait un `JSON.parse` et rendait donc une liste VIDE
 * pour tous les joueurs — la page publique affichait « — » en face de chacun.
 * La lecture passe par `me/teams/skills-data.parseSkills`, celui de la fiche
 * du coach.
 */

export function prettifySlug(slug: string): string {
  if (!slug) return "";
  return slug
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
