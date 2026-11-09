import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, parseNafCoachPage } from "./naf-coach-page";

const fixture = (name: string): string =>
  readFileSync(join(__dirname, "__fixtures__", "naf", name), "utf8");

describe("parseNafCoachPage — pages réelles (extraits)", () => {
  it("fiche trouvée : numéro, nom NAF officiel et nation", () => {
    expect(parseNafCoachPage(fixture("coach-found-7221.html"))).toEqual({
      status: "found",
      nafNumber: 7221,
      nafName: "#5Renton",
      nation: "Spain",
    });
  });

  it("numéro inconnu : « Coach Not Found »", () => {
    expect(parseNafCoachPage(fixture("coach-not-found.html"))).toEqual({
      status: "not_found",
    });
  });
});

describe("parseNafCoachPage — tolérance", () => {
  it("attributs, guillemets simples, casse et espaces", () => {
    const html = `
      <TABLE id='x' class='card coach-info-table wide'>
        <TR class="odd">
          <TD class="label"> NAF Number </TD>
          <TD>  42  </TD>
        </TR>
        <tr><th>NAF name</th><td><b>Grim&nbsp;&amp;&#32;Gore</b></td></tr>
      </TABLE>`;
    expect(parseNafCoachPage(html)).toEqual({
      status: "found",
      nafNumber: 42,
      nafName: "Grim & Gore",
    });
  });

  it("titre « Coach Not Found » avec attributs", () => {
    expect(parseNafCoachPage('<h2 class="t">  Coach   not found </h2>')).toEqual({
      status: "not_found",
    });
  });

  it.each([
    ["page vide", ""],
    ["page sans tableau ni message", "<html><body>Maintenance</body></html>"],
    [
      "numéro illisible",
      '<table class="coach-info-table"><tr><td>NAF number</td><td>abc</td></tr><tr><td>NAF name</td><td>X</td></tr></table>',
    ],
    [
      "nom manquant",
      '<table class="coach-info-table"><tr><td>NAF number</td><td>12</td></tr></table>',
    ],
  ])("%s ⇒ unparseable", (_label, html) => {
    expect(parseNafCoachPage(html)).toEqual({ status: "unparseable" });
  });
});

describe("decodeHtmlEntities", () => {
  it("décode les entités nommées et numériques de base", () => {
    expect(decodeHtmlEntities("&lt;a&gt; &quot;b&quot; &#39;c&#x27; &amp;amp;")).toBe(
      "<a> \"b\" 'c' &amp;",
    );
  });

  it("laisse intactes les entités inconnues", () => {
    expect(decodeHtmlEntities("&foo; &#xZZ;")).toBe("&foo; &#xZZ;");
  });
});
