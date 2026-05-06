/**
 * S27.3.10 — Tests du module d'audit i18n mobile.
 *
 * Le module `i18n-audit` expose des helpers purs qui detectent les
 * chaines hardcodees (FR) restantes dans le source mobile. Tests sans
 * I/O : on passe le contenu source en argument.
 *
 * Heuristique : une chaine est consideree "hardcoded FR" si elle
 * contient des accents francais OU des mots-cles FR connus (Profil,
 * Erreur, Annuler, ...). On ignore les chaines deja passees a `t()`,
 * les chemins d'import, et les commentaires.
 */

import { describe, it, expect } from "vitest";
import {
  findHardcodedStrings,
  summarizeAudits,
  type FileAudit,
} from "./i18n-audit";

describe("findHardcodedStrings — accents FR", () => {
  it("detecte une chaine avec accents", () => {
    const src = `const msg = "Échec de la sauvegarde";`;
    const findings = findHardcodedStrings(src, "test.tsx");
    expect(findings).toHaveLength(1);
    expect(findings[0].text).toBe("Échec de la sauvegarde");
    expect(findings[0].reason).toBe("accents");
    expect(findings[0].line).toBe(1);
    expect(findings[0].file).toBe("test.tsx");
  });

  it("detecte plusieurs chaines avec accents", () => {
    const src = [
      `const a = "Opération réussie";`,
      `const b = "Données perdues";`,
      `const c = "ok";`,
    ].join("\n");
    const findings = findHardcodedStrings(src, "f.tsx");
    expect(findings).toHaveLength(2);
    expect(findings[0].line).toBe(1);
    expect(findings[1].line).toBe(2);
  });
});

describe("findHardcodedStrings — mots-cles FR", () => {
  it("detecte 'Profil' meme sans accents", () => {
    const src = `const t = "Profil";`;
    const findings = findHardcodedStrings(src, "f.tsx");
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe("keyword");
  });

  it("detecte 'Mot de passe'", () => {
    const src = `const t = "Mot de passe";`;
    const findings = findHardcodedStrings(src, "f.tsx");
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe("keyword");
  });

  it("detecte 'Annuler'", () => {
    const src = `<Button title="Annuler" />`;
    const findings = findHardcodedStrings(src, "f.tsx");
    expect(findings).toHaveLength(1);
    expect(findings[0].text).toBe("Annuler");
  });
});

describe("findHardcodedStrings — ignore EN/neutre", () => {
  it("ignore une chaine anglaise sans accents", () => {
    const src = `const msg = "Loading...";`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });

  it("ignore une chaine vide", () => {
    const src = `const msg = "";`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });

  it("ignore une chaine ASCII neutre (sans mot-cle FR)", () => {
    const src = `const msg = "ok"; const x = "test"; const y = "data";`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });
});

describe("findHardcodedStrings — exclusions", () => {
  it("ignore une chaine dans t(...)", () => {
    const src = `const x = t("settings.profile");`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });

  it("ignore t('...') avec apostrophes simples", () => {
    const src = `const x = t('settings.profile');`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });

  it("detecte la chaine FR meme si une autre chaine est dans t()", () => {
    const src = `const a = t("ok"); const b = "Erreur";`;
    const findings = findHardcodedStrings(src, "f.tsx");
    expect(findings).toHaveLength(1);
    expect(findings[0].text).toBe("Erreur");
  });

  it("ignore les imports", () => {
    const src = `import { foo } from "./modulé";`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });

  it("ignore les exports avec from", () => {
    const src = `export { x } from "./eteint";`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });

  it("ignore les commentaires single-line", () => {
    const src = `const x = 1; // Commentaire "Erreur grave" en francais`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });

  it("ignore le contenu d'une ligne JSDoc (commence par *)", () => {
    const src = `   * Description "Erreur" en francais`;
    expect(findHardcodedStrings(src, "f.tsx")).toEqual([]);
  });
});

describe("findHardcodedStrings — robustesse", () => {
  it("gere apostrophes simples dans une chaine FR a double-quotes", () => {
    const src = `const x = "Ne s'éteint pas";`;
    const findings = findHardcodedStrings(src, "f.tsx");
    expect(findings).toHaveLength(1);
    expect(findings[0].text).toContain("éteint");
  });

  it("gere les chaines multi-lignes apparentes (line correcte)", () => {
    const src = [
      `const a = 1;`,
      `const b = 2;`,
      `const msg = "Erreur";`,
      `const c = 3;`,
    ].join("\n");
    const findings = findHardcodedStrings(src, "f.tsx");
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe(3);
  });

  it("retourne tableau vide pour source vide", () => {
    expect(findHardcodedStrings("", "f.tsx")).toEqual([]);
  });
});

describe("summarizeAudits", () => {
  it("agrege par fichier et trie par count desc", () => {
    const audits: FileAudit[] = [
      {
        file: "a.tsx",
        findings: [
          { file: "a.tsx", line: 1, text: "Erreur", reason: "keyword" },
        ],
      },
      {
        file: "b.tsx",
        findings: [
          { file: "b.tsx", line: 1, text: "Profil", reason: "keyword" },
          { file: "b.tsx", line: 2, text: "Annuler", reason: "keyword" },
        ],
      },
      { file: "c.tsx", findings: [] },
    ];
    const summary = summarizeAudits(audits);
    expect(summary.totalFiles).toBe(2);
    expect(summary.totalFindings).toBe(3);
    expect(summary.perFile).toEqual([
      { file: "b.tsx", count: 2 },
      { file: "a.tsx", count: 1 },
    ]);
  });

  it("retourne 0/0 si aucun finding", () => {
    const summary = summarizeAudits([{ file: "a.tsx", findings: [] }]);
    expect(summary.totalFiles).toBe(0);
    expect(summary.totalFindings).toBe(0);
    expect(summary.perFile).toEqual([]);
  });
});
