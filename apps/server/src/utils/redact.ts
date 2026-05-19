/**
 * Audit round 5 (HIGH/PII) — helpers de redaction pour les logs.
 *
 * Avant, les routes auth (login, register, password reset) loggaient
 * l'email brut + le role + le flag valid de chaque tentative. Les
 * logs typiquement flow vers un aggregator (Loki / Sentry / etc.) :
 *  - Email en cleartext = PII sous GDPR.
 *  - Role en cleartext = aide a un attaquant qui gagne acces aux logs
 *    en identifiant les comptes a forte privilege.
 *
 * Les helpers ci-dessous remplacent l'identifiant log par :
 *  - `redactEmail(email)` → "u***@example.com" (preserve domaine
 *    pour le debug operationnel).
 *  - `userTag(id)` → "user_abc12345" (prefix + 8 chars de l'id, sans
 *    leak de l'email ni de l'id complet).
 *
 * Les deux sont volontairement non-reversibles cote logs : pour
 * remonter a l'email reel, il faut une requete DB explicite.
 */

/**
 * Masque le local-part d'un email tout en gardant le domaine pour
 * permettre le filtrage par tenant / ESP. Exemples :
 *   "alice@example.com" → "a***@example.com"
 *   "a@x"               → "*@x"
 *   ""                  → ""
 */
export function redactEmail(email: string | null | undefined): string {
  if (typeof email !== "string" || email.length === 0) return "";
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "***";
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  if (local.length === 0) return `***${domain}`;
  if (local.length === 1) return `*${domain}`;
  return `${local[0]}***${domain}`;
}

/**
 * Retourne un identifiant log court derive de `id` (CUID). Format :
 * `user_<8 premiers chars>` ou `user_unknown` si id absent.
 */
export function userTag(id: string | null | undefined): string {
  if (typeof id !== "string" || id.length === 0) return "user_unknown";
  return `user_${id.slice(0, 8)}`;
}
