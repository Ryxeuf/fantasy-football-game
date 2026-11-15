/**
 * Assainissement du corps d'un article de blog de compétition.
 *
 * Plus strict que `sanitize-blog-html` (blog du site, écrit par un admin) :
 * l'auteur est ici n'importe quel coach membre.
 *  - pas d'`iframe`, de `script`, de `style`, de `class`, d'attribut `on*` ;
 *  - liens `http(s)` / `mailto` seulement, rendus
 *    `rel="nofollow ugc noopener noreferrer"` + `target="_blank"` ;
 *  - images seulement sous un préfixe autorisé (le dossier DE LA compétition),
 *    avec un nom de fichier généré par le serveur ; toute autre image est
 *    retirée ;
 *  - `h1` rabattu en `h2` (le titre de l'article est le seul `h1`).
 */

import sanitizeHtml from "sanitize-html";
import { COMPETITION_BLOG_FILENAME } from "./competition-blog-upload";

export interface CompetitionPostSanitizeOptions {
  /** Préfixes d'URL acceptés pour `img[src]` (cf. `competitionBlogImagePrefixes`). */
  readonly allowedImagePrefixes: readonly string[];
}

/** URL d'image sous un préfixe autorisé, suivie d'un nom généré (pas de `..`, pas de query). */
export function isAllowedCompetitionImageUrl(
  url: string | null | undefined,
  prefixes: readonly string[],
): boolean {
  if (!url) return false;
  for (const prefix of prefixes) {
    if (url.startsWith(prefix)) {
      return COMPETITION_BLOG_FILENAME.test(url.slice(prefix.length));
    }
  }
  return false;
}

export function sanitizeCompetitionPostHtml(
  rawHtml: string,
  options: CompetitionPostSanitizeOptions,
): string {
  const { allowedImagePrefixes } = options;
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "a",
      "img",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: "nofollow ugc noopener noreferrer",
          target: "_blank",
        },
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      !isAllowedCompetitionImageUrl(frame.attribs.src, allowedImagePrefixes),
  });
}

/** Le HTML assaini porte-t-il du contenu (texte ou image) ? */
export function hasMeaningfulContent(html: string): boolean {
  if (/<img\b/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}
