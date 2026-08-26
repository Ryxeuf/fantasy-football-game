/**
 * Tests du contexte d'audit ambiant : isolation entre requêtes concurrentes
 * (c'est tout l'enjeu de l'AsyncLocalStorage) et dégradation gracieuse hors
 * contexte.
 */

import { describe, expect, it } from "vitest";

import {
  createAuditContext,
  currentCorrelationId,
  getAuditContext,
  nextAuditStep,
  runAsAuditJob,
  runWithAuditContext,
  setAuditActor,
} from "./audit-context";

describe("createAuditContext", () => {
  it("génère une corrélation et démarre le compteur d'étape à 0", () => {
    const ctx = createAuditContext();
    expect(ctx.correlationId).toMatch(/[0-9a-f-]{36}/);
    expect(ctx.step).toBe(0);
    expect(ctx.source).toBe("job");
    expect(ctx.actorUserId).toBeNull();
  });
});

describe("runWithAuditContext", () => {
  it("expose le contexte au code appelé", () => {
    const ctx = createAuditContext({ correlationId: "req-1", source: "http" });
    runWithAuditContext(ctx, () => {
      expect(getAuditContext()?.correlationId).toBe("req-1");
      expect(getAuditContext()?.source).toBe("http");
    });
  });

  it("ne fuit pas hors de son exécution", () => {
    runWithAuditContext(createAuditContext({ correlationId: "req-1" }), () => {});
    expect(getAuditContext()).toBeUndefined();
  });

  it("isole deux requêtes concurrentes (compteurs d'étape indépendants)", async () => {
    const collected: Array<[string, number]> = [];

    async function simulateRequest(id: string, steps: number) {
      return runWithAuditContext(
        createAuditContext({ correlationId: id }),
        async () => {
          for (let i = 0; i < steps; i += 1) {
            // Un `await` entre deux étapes : c'est là qu'un contexte porté
            // par une variable de module se ferait écraser par l'autre
            // requête.
            await Promise.resolve();
            collected.push([currentCorrelationId(), nextAuditStep()]);
          }
        },
      );
    }

    await Promise.all([simulateRequest("req-A", 3), simulateRequest("req-B", 2)]);

    expect(collected.filter(([id]) => id === "req-A").map(([, s]) => s)).toEqual([
      1, 2, 3,
    ]);
    expect(collected.filter(([id]) => id === "req-B").map(([, s]) => s)).toEqual([
      1, 2,
    ]);
  });
});

describe("setAuditActor", () => {
  it("renseigne l'acteur sur le contexte courant (appelé par authUser)", () => {
    runWithAuditContext(createAuditContext(), () => {
      setAuditActor({
        userId: "u1",
        roles: ["admin"],
        impersonatorId: "admin-9",
      });
      expect(getAuditContext()?.actorUserId).toBe("u1");
      expect(getAuditContext()?.actorRoles).toEqual(["admin"]);
      expect(getAuditContext()?.impersonatorId).toBe("admin-9");
    });
  });

  it("est un no-op hors contexte (routes montées avant le middleware)", () => {
    expect(() => setAuditActor({ userId: "u1" })).not.toThrow();
  });
});

describe("dégradation hors contexte", () => {
  it("`nextAuditStep` rend 1 et `currentCorrelationId` un id neuf", () => {
    expect(nextAuditStep()).toBe(1);
    const a = currentCorrelationId();
    const b = currentCorrelationId();
    expect(a).not.toBe(b);
  });
});

describe("runAsAuditJob", () => {
  it("ouvre un contexte `job` nommé pour un cron ou un hook", () => {
    runAsAuditJob("league.postmatch.sequence", () => {
      expect(getAuditContext()?.source).toBe("job");
      expect(getAuditContext()?.route).toBe("league.postmatch.sequence");
    });
  });
});
