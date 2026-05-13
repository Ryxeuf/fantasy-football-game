import sanitizeHtml from "sanitize-html";

/// Allowlist stricte alignée sur les extensions TipTap utilisées côté admin
/// (StarterKit + Link + Image). Toute balise/attribut hors allowlist est
/// supprimé silencieusement par sanitize-html.
const BLOG_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
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
    "h1",
    "h2",
    "h3",
    "h4",
    "a",
    "img",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "noopener noreferrer nofollow",
        target: attribs.target === "_self" ? "_self" : "_blank",
      },
    }),
  },
};

export function sanitizeBlogHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, BLOG_SANITIZE_OPTIONS);
}
