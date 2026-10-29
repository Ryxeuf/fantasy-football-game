import { describe, expect, it } from "vitest";
import { freshnessBanner, type SheetChangeView } from "./freshness";

const J2: SheetChangeView = {
  pairingId: "pair-j2",
  kind: "validated",
  at: "2026-09-20T12:00:00.000Z",
  roundLabel: "journée 2",
  homeTeamName: "Paladins de la Dame",
  awayTeamName: "Elfes",
};

describe("freshnessBanner", () => {
  it("rien à montrer sans information de fraîcheur (coupe, validée, ancien serveur)", () => {
    for (const freshness of [null, undefined]) {
      expect(
        freshnessBanner({
          freshness,
          homeTeamName: "A",
          awayTeamName: "B",
          canEdit: true,
        }),
      ).toBeNull();
    }
  });

  it("gel périmé : une phrase par équipe, mise à jour possible", () => {
    const out = freshnessBanner({
      freshness: { home: J2, away: null, refreshable: true },
      homeTeamName: "Paladins de la Dame",
      awayTeamName: "Orques",
      canEdit: true,
    });
    expect(out).toEqual({
      stale: true,
      lines: [
        "Paladins de la Dame : la feuille de journée 2 (Paladins de la Dame – Elfes) a été validée le 20/09/2026, après l'ouverture de celle-ci.",
      ],
      canRefresh: true,
      blockedHint: null,
    });
  });

  it("une invalidation se dit « invalidée »", () => {
    const out = freshnessBanner({
      freshness: {
        home: null,
        away: { ...J2, kind: "invalidated" },
        refreshable: true,
      },
      homeTeamName: "A",
      awayTeamName: "Orques",
      canEdit: true,
    });
    expect(out?.lines[0]).toMatch(/^Orques : .* a été invalidée le/);
  });

  it("feuille déjà soumise : explique comment débloquer", () => {
    const out = freshnessBanner({
      freshness: { home: J2, away: null, refreshable: false },
      homeTeamName: "A",
      awayTeamName: "B",
      canEdit: true,
    });
    expect(out?.canRefresh).toBe(false);
    expect(out?.blockedHint).toMatch(/retirez les soumissions/);
  });

  it("un simple spectateur voit l'alerte, sans bouton ni consigne", () => {
    const out = freshnessBanner({
      freshness: { home: J2, away: null, refreshable: true },
      homeTeamName: "A",
      awayTeamName: "B",
      canEdit: false,
    });
    expect(out).toMatchObject({ stale: true, canRefresh: false, blockedHint: null });
  });

  it("gel à jour : la mise à jour reste proposée, sans alerte", () => {
    const out = freshnessBanner({
      freshness: { home: null, away: null, refreshable: true },
      homeTeamName: "A",
      awayTeamName: "B",
      canEdit: true,
    });
    expect(out).toEqual({
      stale: false,
      lines: [],
      canRefresh: true,
      blockedHint: null,
    });
  });
});
