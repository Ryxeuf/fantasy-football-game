/**
 * Les deux gels de la page d'édition ne disent pas la même chose.
 */
import { describe, it, expect } from "vitest";
import { resolveEditAccess } from "./edit-access";

describe("resolveEditAccess", () => {
  it("ouvre tout sur une équipe libre", () => {
    expect(
      resolveEditAccess({ canEdit: true, frozen: false, buildLocked: false }),
    ).toEqual({ redirect: false, rosterLocked: false });
  });

  it("garde la page ouverte quand seule la composition est figée", () => {
    // Cas de l'inscription en ligue avant le premier match : le coach doit
    // encore pouvoir défaire une compétence achetée sur son pool.
    expect(
      resolveEditAccess({ canEdit: true, frozen: true, buildLocked: false }),
    ).toEqual({ redirect: false, rosterLocked: true });
  });

  it("redirige dès l'entrée en jeu", () => {
    expect(
      resolveEditAccess({ canEdit: true, frozen: true, buildLocked: true }),
    ).toEqual({ redirect: true, rosterLocked: true });
  });

  it("redirige quand un match est en cours, quels que soient les gels", () => {
    expect(
      resolveEditAccess({ canEdit: false, frozen: false, buildLocked: false }),
    ).toEqual({ redirect: true, rosterLocked: false });
  });

  it("se ferme par défaut avant le premier chargement", () => {
    expect(resolveEditAccess({ canEdit: true })).toEqual({
      redirect: true,
      rosterLocked: true,
    });
  });

  it("retombe sur `frozen` face à un serveur qui ne sert pas `buildLocked`", () => {
    expect(resolveEditAccess({ canEdit: true, frozen: false })).toEqual({
      redirect: false,
      rosterLocked: false,
    });
    expect(resolveEditAccess({ canEdit: true, frozen: true })).toEqual({
      redirect: true,
      rosterLocked: true,
    });
  });
});
