/**
 * Lecture PURE d'une fiche coach de l'annuaire public NAF
 * (`member.thenaf.net/index.php?module=NAF&type=coachpage&coach=<numéro>`).
 *
 * La NAF n'expose pas d'API : la fiche est une page HTML. On n'en lit que
 * le tableau `coach-info-table` (« NAF number », « NAF name », « Nation »)
 * et le titre « Coach Not Found » d'un numéro inconnu. Tout le reste de la
 * page (statistiques, classements, scripts) est ignoré — un changement de
 * mise en page ailleurs ne casse rien, et un changement de CE tableau rend
 * `unparseable` plutôt qu'une fausse vérification.
 *
 * Tolérant : attributs, guillemets, casse, espaces et entités HTML de base.
 * Aucune I/O (cf. `naf-verification` pour l'appel réseau).
 */

export type NafCoachPage =
  | {
      readonly status: "found";
      readonly nafNumber: number;
      readonly nafName: string;
      readonly nation?: string;
    }
  | { readonly status: "not_found" }
  | { readonly status: "unparseable" };

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Décode les entités HTML de base (nommées courantes + numériques). */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Texte d'une cellule : balises retirées, entités décodées, espaces réduits. */
function cellText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

const NOT_FOUND = /<h[1-6]\b[^>]*>\s*Coach\s+Not\s+Found\s*<\/h[1-6]>/i;
const INFO_TABLE =
  /<table\b[^>]*\bclass\s*=\s*["'][^"']*\bcoach-info-table\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i;
const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;

/** Libellé → valeur des lignes du tableau d'identité du coach. */
function readInfoTable(tableHtml: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const row of tableHtml.matchAll(ROW)) {
    const cells = [...row[1].matchAll(CELL)].map((c) => cellText(c[1]));
    if (cells.length < 2) continue;
    const label = cells[0].toLowerCase();
    if (!fields.has(label)) fields.set(label, cells[1]);
  }
  return fields;
}

export function parseNafCoachPage(html: string): NafCoachPage {
  if (typeof html !== "string" || html.length === 0) {
    return { status: "unparseable" };
  }
  const table = INFO_TABLE.exec(html);
  if (!table) {
    return NOT_FOUND.test(html) ? { status: "not_found" } : { status: "unparseable" };
  }
  const fields = readInfoTable(table[1]);
  const rawNumber = fields.get("naf number") ?? "";
  const nafName = fields.get("naf name") ?? "";
  if (!/^\d{1,7}$/.test(rawNumber) || nafName.length === 0) {
    return { status: "unparseable" };
  }
  const nation = fields.get("nation");
  return {
    status: "found",
    nafNumber: Number.parseInt(rawNumber, 10),
    nafName,
    ...(nation ? { nation } : {}),
  };
}
