/**
 * Audit round 9 (HIGH/XSS) -- helper pour les payloads JSON-LD injectes
 * via `dangerouslySetInnerHTML` dans des `<script type="application/ld+json">`.
 *
 * `JSON.stringify` n'echappe pas la sequence `</script>` ni les line
 * separators U+2028 / U+2029, qui peuvent breakout du `<script>` enclos
 * si une chaine dans les donnees contient ces tokens. Pour des champs
 * user-controlled (blog title, recap champion name, team name, etc.),
 * ca ouvre un XSS stocke trivial.
 *
 * `safeJsonLd(value)` retourne une string JSON safe a injecter telle
 * quelle dans `<script type="application/ld+json">`. Les caracteres
 * problematiques sont remplaces par leur escape unicode equivalent.
 *
 * Pattern recommande par OWASP et utilise par serialize-javascript
 * (sans la dependance externe pour eviter de gonfler le bundle).
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (c) => {
      switch (c) {
        case "<":
          return "\\u003c";
        case ">":
          return "\\u003e";
        case "&":
          return "\\u0026";
        case "\u2028":
          return "\\u2028";
        case "\u2029":
          return "\\u2029";
        default:
          return c;
      }
    },
  );
}
