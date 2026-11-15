import { describe, expect, it } from "vitest";
import {
  hasMeaningfulContent,
  isAllowedCompetitionImageUrl,
  sanitizeCompetitionPostHtml,
} from "./sanitize-competition-post-html";

const PREFIX = "/images/competition-blog/league-abc123/";
const ABS = "https://api.example.test/images/competition-blog/league-abc123/";
const opts = { allowedImagePrefixes: [PREFIX, ABS] };
const OK_IMG = `${PREFIX}0123456789abcdef.png`;

const clean = (html: string) => sanitizeCompetitionPostHtml(html, opts);

describe("sanitizeCompetitionPostHtml", () => {
  it("garde la mise en forme autorisée", () => {
    const html = "<h2>Bilan</h2><p><strong>Victoire</strong> des <em>Orques</em></p><ul><li>2 TD</li></ul>";
    expect(clean(html)).toBe(html);
  });

  it("retire script, gestionnaires d'évènements, style, class et iframe", () => {
    const out = clean(
      '<p class="x" style="color:red" onclick="alert(1)">a</p><script>alert(1)</script><iframe src="https://evil"></iframe>',
    );
    expect(out).toBe("<p>a</p>");
  });

  it("rabat h1 en h2", () => {
    expect(clean("<h1>T</h1>")).toBe("<h2>T</h2>");
  });

  it("force rel et target sur les liens, refuse javascript:", () => {
    expect(clean('<a href="https://nuffle.test">x</a>')).toBe(
      '<a href="https://nuffle.test" rel="nofollow ugc noopener noreferrer" target="_blank">x</a>',
    );
    expect(clean('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
  });

  it("garde une image de la compétition (relative ou absolue)", () => {
    expect(clean(`<img src="${OK_IMG}" alt="table" />`)).toBe(
      `<img src="${OK_IMG}" alt="table" />`,
    );
    const abs = `${ABS}fedcba9876543210.webp`;
    expect(clean(`<img src="${abs}" />`)).toContain(abs);
  });

  it("retire une image externe, d'une autre compétition ou au nom forgé", () => {
    for (const src of [
      "https://tracker.example/pixel.gif",
      "/images/competition-blog/cup-other/0123456789abcdef.png",
      `${PREFIX}../league-x/0123456789abcdef.png`,
      `${PREFIX}0123456789abcdef.png?x=1`,
      "//evil.test/0123456789abcdef.png",
    ]) {
      expect(clean(`<p>t</p><img src="${src}" />`)).toBe("<p>t</p>");
    }
  });
});

describe("isAllowedCompetitionImageUrl", () => {
  it("refuse l'absence d'URL", () => {
    expect(isAllowedCompetitionImageUrl(null, [PREFIX])).toBe(false);
    expect(isAllowedCompetitionImageUrl("", [PREFIX])).toBe(false);
  });
});

describe("hasMeaningfulContent", () => {
  it("vide après assainissement", () => {
    expect(hasMeaningfulContent("<p> &nbsp; </p>")).toBe(false);
    expect(hasMeaningfulContent(clean("<script>x</script>"))).toBe(false);
  });
  it("texte ou image", () => {
    expect(hasMeaningfulContent("<p>a</p>")).toBe(true);
    expect(hasMeaningfulContent(`<img src="${OK_IMG}" />`)).toBe(true);
  });
});
