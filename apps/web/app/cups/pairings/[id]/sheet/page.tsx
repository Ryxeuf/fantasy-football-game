/**
 * Feuille de match d'une rencontre de COUPE.
 *
 * La feuille est la MÊME que celle des ligues — mêmes routes serveur, mêmes
 * panneaux, même cycle de vie (avant-match, évènements, soumission des deux
 * coachs, validation du commissaire). Cette route ne fait qu'exposer la page
 * sous `/cups/...` pour que l'URL et le retour navigateur restent cohérents
 * avec la compétition ; la page s'adapte d'elle-même au `competitionKind`
 * servi par l'API (lien retour, phases d'après-match masquées).
 *
 * Aucune duplication volontaire : dupliquer la page, c'était garantir que les
 * deux versions divergent.
 */
export { default } from "../../../../leagues/pairings/[id]/sheet/page";
