/**
 * Tests pour le client IndexNow pur (Q.18 — Sprint 23).
 *
 * IndexNow est un protocole partage par Bing, Yandex, Naver, Seznam, Yep
 * pour notifier les moteurs de recherche d un changement d URL sans
 * attendre le re-crawl. Une cle unique sert tous les operateurs.
 *
 * Ce module fournit :
 *   - validation de la cle (alphanumerique, 8-128 chars)
 *   - construction du payload JSON conforme au spec
 *   - selection de l endpoint en fonction du moteur
 *   - filtrage des URLs (meme host obligatoire, https seulement)
 */
import { describe, it, expect } from "vitest";
import {
  buildIndexNowPayload,
  isValidIndexNowKey,
  filterIndexNowUrls,
  INDEXNOW_ENDPOINTS,
} from "./indexnow";

const VALID_KEY = "abc123def456ghi789";

describe("isValidIndexNowKey", () => {
  it("accepte une cle alphanumerique entre 8 et 128 chars", () => {
    expect(isValidIndexNowKey("abcdef12")).toBe(true);
    expect(isValidIndexNowKey("a".repeat(128))).toBe(true);
    expect(isValidIndexNowKey("ABC123-DEF_456")).toBe(true); // tirets/underscores autorises par le spec
  });

  it("rejette une cle trop courte", () => {
    expect(isValidIndexNowKey("abc")).toBe(false);
    expect(isValidIndexNowKey("")).toBe(false);
  });

  it("rejette une cle trop longue", () => {
    expect(isValidIndexNowKey("a".repeat(129))).toBe(false);
  });

  it("rejette une cle avec caracteres invalides", () => {
    expect(isValidIndexNowKey("abc def ghi")).toBe(false);
    expect(isValidIndexNowKey("abc/def/ghi")).toBe(false);
    expect(isValidIndexNowKey("abc!@#")).toBe(false);
  });

  it("rejette undefined / null", () => {
    expect(isValidIndexNowKey(undefined)).toBe(false);
    expect(isValidIndexNowKey(null as unknown as string)).toBe(false);
  });
});

describe("filterIndexNowUrls", () => {
  it("garde uniquement les URLs https sur le host attendu", () => {
    const result = filterIndexNowUrls(
      [
        "https://nufflearena.fr/teams",
        "https://nufflearena.fr/skills",
        "http://nufflearena.fr/insecure", // protocole rejete
        "https://other-site.com/page", // host different rejete
        "not-a-url", // invalide
      ],
      "nufflearena.fr",
    );
    expect(result).toEqual([
      "https://nufflearena.fr/teams",
      "https://nufflearena.fr/skills",
    ]);
  });

  it("dedoublonne les URLs", () => {
    const result = filterIndexNowUrls(
      [
        "https://nufflearena.fr/teams",
        "https://nufflearena.fr/teams",
        "https://nufflearena.fr/skills",
      ],
      "nufflearena.fr",
    );
    expect(result).toEqual([
      "https://nufflearena.fr/teams",
      "https://nufflearena.fr/skills",
    ]);
  });

  it("retourne un tableau vide pour une entree vide", () => {
    expect(filterIndexNowUrls([], "nufflearena.fr")).toEqual([]);
  });
});

describe("buildIndexNowPayload", () => {
  const validInput = {
    host: "nufflearena.fr",
    key: VALID_KEY,
    keyLocation: "https://nufflearena.fr/indexnow-key.txt",
    urls: ["https://nufflearena.fr/teams"],
  };

  it("produit un payload conforme au spec IndexNow", () => {
    const payload = buildIndexNowPayload(validInput);
    expect(payload.host).toBe("nufflearena.fr");
    expect(payload.key).toBe(VALID_KEY);
    expect(payload.keyLocation).toBe(
      "https://nufflearena.fr/indexnow-key.txt",
    );
    expect(payload.urlList).toEqual(["https://nufflearena.fr/teams"]);
  });

  it("filtre les URLs incompatibles avant emission", () => {
    const payload = buildIndexNowPayload({
      ...validInput,
      urls: [
        "https://nufflearena.fr/a",
        "https://other.com/b",
        "http://nufflearena.fr/c",
      ],
    });
    expect(payload.urlList).toEqual(["https://nufflearena.fr/a"]);
  });

  it("rejette si la cle est invalide", () => {
    expect(() =>
      buildIndexNowPayload({ ...validInput, key: "bad" }),
    ).toThrow(/key/i);
  });

  it("rejette si keyLocation n est pas une URL https valide", () => {
    expect(() =>
      buildIndexNowPayload({ ...validInput, keyLocation: "not-a-url" }),
    ).toThrow(/key.?location/i);
    expect(() =>
      buildIndexNowPayload({
        ...validInput,
        keyLocation: "http://nufflearena.fr/indexnow-key.txt",
      }),
    ).toThrow(/https/i);
  });

  it("rejette si urlList est vide apres filtrage", () => {
    expect(() =>
      buildIndexNowPayload({
        ...validInput,
        urls: ["http://nufflearena.fr/a", "https://other.com/b"],
      }),
    ).toThrow(/url/i);
  });

  it("plafonne urlList a 10000 (limite IndexNow)", () => {
    const urls = Array.from(
      { length: 10100 },
      (_, i) => `https://nufflearena.fr/page-${i}`,
    );
    const payload = buildIndexNowPayload({ ...validInput, urls });
    expect(payload.urlList.length).toBe(10000);
  });
});

describe("INDEXNOW_ENDPOINTS", () => {
  it("expose les endpoints documentes par les operateurs", () => {
    const hosts = INDEXNOW_ENDPOINTS.map((url) => new URL(url).hostname);
    expect(hosts).toContain("api.indexnow.org");
    expect(hosts.some((h) => h.includes("bing"))).toBe(true);
    expect(hosts.some((h) => h.includes("yandex"))).toBe(true);
  });

  it("toutes les URLs sont en https", () => {
    for (const url of INDEXNOW_ENDPOINTS) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });
});
