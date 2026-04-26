/**
 * Tests pour le builder de codes de verification webmasters
 * (Q.17 — Sprint 23).
 *
 * Le builder est pur : il prend les codes depuis l'env et produit un
 * objet `verification` consommable par `metadata.verification` de
 * Next.js. Validation defensive pour eviter de leaker des placeholders
 * ("votre-code-...", chaines vides, espaces).
 */
import { describe, it, expect } from "vitest";
import {
  buildWebmasterVerification,
  type WebmasterVerificationEnv,
} from "./webmaster-verification";

describe("buildWebmasterVerification", () => {
  it("retourne un objet vide quand aucun code fourni", () => {
    expect(buildWebmasterVerification({})).toEqual({});
    expect(buildWebmasterVerification(undefined)).toEqual({});
  });

  it("propage google quand fourni et valide", () => {
    const env: WebmasterVerificationEnv = {
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "abcDEF1234567890validCode",
    };
    expect(buildWebmasterVerification(env).google).toBe(
      "abcDEF1234567890validCode",
    );
  });

  it("propage yandex et bing quand fournis", () => {
    const env: WebmasterVerificationEnv = {
      NEXT_PUBLIC_YANDEX_VERIFICATION: "yandex-deadbeef1234",
      NEXT_PUBLIC_BING_SITE_VERIFICATION: "BING1234567890abcdefABC123",
    };
    const result = buildWebmasterVerification(env);
    expect(result.yandex).toBe("yandex-deadbeef1234");
    expect(result.other?.["msvalidate.01"]).toBe("BING1234567890abcdefABC123");
  });

  it("ignore les chaines vides", () => {
    const env: WebmasterVerificationEnv = {
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "",
      NEXT_PUBLIC_YANDEX_VERIFICATION: "   ",
    };
    expect(buildWebmasterVerification(env)).toEqual({});
  });

  it("ignore les codes avec espaces internes (probable mauvais collage)", () => {
    const env: WebmasterVerificationEnv = {
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "abc def ghi",
    };
    expect(buildWebmasterVerification(env)).toEqual({});
  });

  it("ignore les placeholders evidents (defense contre commit accidentel)", () => {
    const placeholders = [
      "votre-code-google",
      "votre code yandex",
      "your-code-bing",
      "TODO",
      "FIXME",
      "xxx",
      "<insert>",
    ];
    for (const placeholder of placeholders) {
      const env: WebmasterVerificationEnv = {
        NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: placeholder,
      };
      expect(
        buildWebmasterVerification(env).google,
        `placeholder accepte: ${placeholder}`,
      ).toBeUndefined();
    }
  });

  it("ignore un code trop long (> 200 chars, defense)", () => {
    const env: WebmasterVerificationEnv = {
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "a".repeat(201),
    };
    expect(buildWebmasterVerification(env).google).toBeUndefined();
  });

  it("trim les espaces de bord avant validation", () => {
    const env: WebmasterVerificationEnv = {
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "  validCode123  ",
    };
    expect(buildWebmasterVerification(env).google).toBe("validCode123");
  });

  it("garde other.msvalidate.01 vide quand bing absent", () => {
    const env: WebmasterVerificationEnv = {
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "validCode123",
    };
    expect(buildWebmasterVerification(env).other).toBeUndefined();
  });

  it("est deterministe : meme entree -> meme sortie", () => {
    const env: WebmasterVerificationEnv = {
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "validCode123",
      NEXT_PUBLIC_YANDEX_VERIFICATION: "validYandex456",
    };
    expect(buildWebmasterVerification(env)).toEqual(
      buildWebmasterVerification(env),
    );
  });
});
