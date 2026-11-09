import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NAF_MEMBER_URL,
  isValidNafNumber,
  nafCoachPageUrl,
  verifyNafNumber,
  type NafFetcher,
} from "./naf-verification";

const fixture = (name: string): string =>
  readFileSync(join(__dirname, "__fixtures__", "naf", name), "utf8");

function fetcherReturning(html: string, ok = true, status = 200) {
  return vi.fn<NafFetcher>(async () => ({ ok, status, text: async () => html }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("nafCoachPageUrl", () => {
  it("fiche coach de l'annuaire public par défaut", () => {
    expect(nafCoachPageUrl(7221)).toBe(
      `${DEFAULT_NAF_MEMBER_URL}?module=NAF&type=coachpage&coach=7221`,
    );
  });

  it("base surchargeable par NAF_MEMBER_URL (lue à l'appel)", () => {
    vi.stubEnv("NAF_MEMBER_URL", "http://naf.test/index.php");
    expect(nafCoachPageUrl(12)).toBe(
      "http://naf.test/index.php?module=NAF&type=coachpage&coach=12",
    );
  });
});

describe("isValidNafNumber", () => {
  it.each([
    [1, true],
    [9_999_999, true],
    [0, false],
    [10_000_000, false],
    [1.5, false],
  ])("%s ⇒ %s", (n, ok) => {
    expect(isValidNafNumber(n)).toBe(ok);
  });
});

describe("verifyNafNumber", () => {
  it("fiche trouvée au même numéro ⇒ vérifié, nom NAF officiel", async () => {
    const fetcher = fetcherReturning(fixture("coach-found-7221.html"));
    await expect(verifyNafNumber(7221, fetcher)).resolves.toEqual({
      status: "verified",
      nafNumber: 7221,
      nafName: "#5Renton",
      nation: "Spain",
    });
  });

  it("n'envoie QUE le numéro, avec un User-Agent générique", async () => {
    const fetcher = fetcherReturning(fixture("coach-found-7221.html"));
    await verifyNafNumber(7221, fetcher);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(nafCoachPageUrl(7221));
    expect(init.headers["User-Agent"]).toBe("NuffleArena");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("numéro inconnu ⇒ not_found", async () => {
    await expect(
      verifyNafNumber(99, fetcherReturning(fixture("coach-not-found.html"))),
    ).resolves.toEqual({ status: "not_found" });
  });

  it("la fiche porte un AUTRE numéro ⇒ pas de vérification", async () => {
    await expect(
      verifyNafNumber(7222, fetcherReturning(fixture("coach-found-7221.html"))),
    ).resolves.toEqual({ status: "unavailable", reason: "number_mismatch" });
  });

  it("HTTP en erreur ⇒ unavailable (http)", async () => {
    await expect(verifyNafNumber(7221, fetcherReturning("", false, 503))).resolves.toEqual({
      status: "unavailable",
      reason: "http",
    });
  });

  it("page illisible ⇒ unavailable (unparseable)", async () => {
    await expect(
      verifyNafNumber(7221, fetcherReturning("<html>maintenance</html>")),
    ).resolves.toEqual({ status: "unavailable", reason: "unparseable" });
  });

  it("réseau en échec ⇒ unavailable (network)", async () => {
    const fetcher = vi.fn<NafFetcher>(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(verifyNafNumber(7221, fetcher)).resolves.toEqual({
      status: "unavailable",
      reason: "network",
    });
  });

  it("annuaire trop lent ⇒ coupé au timeout, unavailable", async () => {
    const fetcher: NafFetcher = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    await expect(verifyNafNumber(7221, fetcher, { timeoutMs: 10 })).resolves.toEqual({
      status: "unavailable",
      reason: "network",
    });
  });

  it("numéro hors format ⇒ not_found sans appel réseau", async () => {
    const fetcher = fetcherReturning("");
    await expect(verifyNafNumber(0, fetcher)).resolves.toEqual({ status: "not_found" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
