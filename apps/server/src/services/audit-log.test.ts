/**
 * S27.6.1 — Tests pour le service d'audit log admin.
 *
 * Le service prend un PrismaClient (mockable) et une description
 * d'action ; il insere une ligne dans `AuditLog` avec les snapshots
 * serialises en JSON. Le but de cette slice est de figer le contrat
 * (input shape, defaut des champs optionnels, serialisation des
 * valeurs Json) avant de cabler les routes admin (slice 2).
 */
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  extractRequestContext,
  recordAdminAction,
  recordAdminActionFromRequest,
  safeRecordAdminActionFromRequest,
} from "./audit-log";

interface CallArgs {
  data: {
    userId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    oldValue: string | typeof Prisma.JsonNull;
    newValue: string | typeof Prisma.JsonNull;
    ipAddress: string | null;
    userAgent: string | null;
  };
}

/**
 * Helper d'assertion : verifie qu'une valeur Json non fournie a bien
 * ete remplacee par `Prisma.JsonNull` (semantique : "valeur SQL NULL"
 * cote Prisma quand la colonne est `Json?`).
 */
function expectJsonNull(value: unknown): void {
  expect(value).toEqual(Prisma.JsonNull);
}

function makeMockPrisma() {
  const create = vi.fn(async (_args: CallArgs) => undefined);
  return {
    create,
    prisma: { auditLog: { create } } as never,
  };
}

describe("recordAdminAction", () => {
  it("insere une ligne avec les champs requis", async () => {
    const { prisma, create } = makeMockPrisma();
    await recordAdminAction(prisma, {
      userId: "admin-1",
      action: "user.role.update",
      entity: "User",
      entityId: "user-42",
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.data.userId).toBe("admin-1");
    expect(args.data.action).toBe("user.role.update");
    expect(args.data.entity).toBe("User");
    expect(args.data.entityId).toBe("user-42");
  });

  it("met les champs optionnels a null par defaut", async () => {
    const { prisma, create } = makeMockPrisma();
    await recordAdminAction(prisma, {
      userId: null,
      action: "match.purge",
      entity: "Match",
    });
    const args = create.mock.calls[0][0];
    expect(args.data.userId).toBeNull();
    expect(args.data.entityId).toBeNull();
    expectJsonNull(args.data.oldValue);
    expectJsonNull(args.data.newValue);
    expect(args.data.ipAddress).toBeNull();
    expect(args.data.userAgent).toBeNull();
  });

  it("serialise oldValue/newValue en JSON string", async () => {
    const { prisma, create } = makeMockPrisma();
    await recordAdminAction(prisma, {
      userId: "admin-1",
      action: "user.role.update",
      entity: "User",
      entityId: "user-42",
      oldValue: { role: "USER" },
      newValue: { role: "ADMIN" },
    });
    const args = create.mock.calls[0][0];
    expect(args.data.oldValue).toBe('{"role":"USER"}');
    expect(args.data.newValue).toBe('{"role":"ADMIN"}');
  });

  it("traite undefined comme JsonNull pour les snapshots (creation)", async () => {
    const { prisma, create } = makeMockPrisma();
    await recordAdminAction(prisma, {
      userId: "admin-1",
      action: "user.create",
      entity: "User",
      entityId: "user-99",
      newValue: { email: "x@y" },
    });
    const args = create.mock.calls[0][0];
    expectJsonNull(args.data.oldValue);
    expect(args.data.newValue).toBe('{"email":"x@y"}');
  });

  it("traite undefined comme JsonNull pour newValue (suppression)", async () => {
    const { prisma, create } = makeMockPrisma();
    await recordAdminAction(prisma, {
      userId: "admin-1",
      action: "user.delete",
      entity: "User",
      entityId: "user-99",
      oldValue: { email: "x@y" },
    });
    const args = create.mock.calls[0][0];
    expect(args.data.oldValue).toBe('{"email":"x@y"}');
    expectJsonNull(args.data.newValue);
  });

  it("propage ipAddress et userAgent quand fournis", async () => {
    const { prisma, create } = makeMockPrisma();
    await recordAdminAction(prisma, {
      userId: "admin-1",
      action: "match.delete",
      entity: "Match",
      entityId: "m-1",
      ipAddress: "10.0.0.1",
      userAgent: "curl/8.0",
    });
    const args = create.mock.calls[0][0];
    expect(args.data.ipAddress).toBe("10.0.0.1");
    expect(args.data.userAgent).toBe("curl/8.0");
  });

  it("serialise des tableaux et types primitifs", async () => {
    const { prisma, create } = makeMockPrisma();
    await recordAdminAction(prisma, {
      userId: "admin-1",
      action: "skill.bulk.update",
      entity: "Skill",
      newValue: ["a", "b", 3],
    });
    const args = create.mock.calls[0][0];
    expect(args.data.newValue).toBe('["a","b",3]');
  });

  it("ne plante pas si l'insertion Prisma echoue : propage l'erreur", async () => {
    const create = vi.fn(async () => {
      throw new Error("DB down");
    });
    const prisma = { auditLog: { create } } as never;
    await expect(
      recordAdminAction(prisma, {
        userId: "admin-1",
        action: "user.delete",
        entity: "User",
        entityId: "u",
      }),
    ).rejects.toThrow("DB down");
  });
});

describe("extractRequestContext", () => {
  it("extrait IP et User-Agent quand fournis", () => {
    const ctx = extractRequestContext({
      ip: "10.0.0.1",
      headers: { "user-agent": "curl/8.0" },
    });
    expect(ctx.ipAddress).toBe("10.0.0.1");
    expect(ctx.userAgent).toBe("curl/8.0");
  });

  it("retourne null pour les valeurs manquantes ou vides", () => {
    expect(
      extractRequestContext({ ip: undefined as never, headers: {} }),
    ).toEqual({ ipAddress: null, userAgent: null });
    expect(
      extractRequestContext({
        ip: "",
        headers: { "user-agent": "" },
      }),
    ).toEqual({ ipAddress: null, userAgent: null });
  });

  it("tronque les User-Agent excessivement longs a 512 chars", () => {
    const longUa = "x".repeat(2048);
    const ctx = extractRequestContext({
      ip: "1.2.3.4",
      headers: { "user-agent": longUa },
    });
    expect(ctx.userAgent).not.toBeNull();
    expect((ctx.userAgent ?? "").length).toBe(512);
  });

  it("ignore un User-Agent non-string", () => {
    const ctx = extractRequestContext({
      ip: "1.2.3.4",
      headers: { "user-agent": ["a", "b"] as unknown as string },
    });
    expect(ctx.userAgent).toBeNull();
  });
});

describe("recordAdminActionFromRequest", () => {
  it("remplit userId/ip/userAgent depuis la requete", async () => {
    const create = vi.fn(async () => undefined);
    const prisma = { auditLog: { create } } as never;
    const req = {
      ip: "192.168.1.10",
      headers: { "user-agent": "Mozilla/5.0" },
      user: { id: "admin-42", roles: ["admin"] },
    } as never;
    await recordAdminActionFromRequest(prisma, req, {
      action: "user.role.update",
      entity: "User",
      entityId: "user-99",
      newValue: { role: "ADMIN" },
    });
    const args = create.mock.calls[0][0];
    expect(args.data.userId).toBe("admin-42");
    expect(args.data.ipAddress).toBe("192.168.1.10");
    expect(args.data.userAgent).toBe("Mozilla/5.0");
    expect(args.data.newValue).toBe('{"role":"ADMIN"}');
  });

  it("fallback userId=null si la requete n'a pas user", async () => {
    const create = vi.fn(async () => undefined);
    const prisma = { auditLog: { create } } as never;
    const req = { ip: "1.2.3.4", headers: {} } as never;
    await recordAdminActionFromRequest(prisma, req, {
      action: "match.purge",
      entity: "Match",
    });
    const args = create.mock.calls[0][0];
    expect(args.data.userId).toBeNull();
  });
});

/**
 * S27.6.4 — `safeRecordAdminActionFromRequest` : variante "log + swallow"
 * partagee par les routes admin pour qu'une defaillance de l'audit log
 * NE FASSE PAS echouer la mutation deja committee. Le wrapper etait
 * jusque-la duplique dans `routes/admin.ts` ; on le centralise ici pour
 * pouvoir le reutiliser depuis `routes/admin-data.ts` (skills, rosters,
 * positions, star players).
 */
describe("safeRecordAdminActionFromRequest", () => {
  it("propage l'enregistrement vers Prisma quand tout va bien", async () => {
    const create = vi.fn(async () => undefined);
    const prisma = { auditLog: { create } } as never;
    const req = {
      ip: "10.0.0.5",
      headers: { "user-agent": "vitest" },
      user: { id: "admin-7" },
    } as never;
    await safeRecordAdminActionFromRequest(prisma, req, {
      action: "skill.create",
      entity: "Skill",
      entityId: "sk-1",
      newValue: { slug: "block" },
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.data.userId).toBe("admin-7");
    expect(args.data.action).toBe("skill.create");
    expect(args.data.newValue).toBe('{"slug":"block"}');
  });

  it("swallow les erreurs Prisma sans throw (mutation deja committee)", async () => {
    const create = vi.fn(async () => {
      throw new Error("DB down");
    });
    const prisma = { auditLog: { create } } as never;
    const req = { ip: "1.2.3.4", headers: {}, user: { id: "a" } } as never;
    await expect(
      safeRecordAdminActionFromRequest(prisma, req, {
        action: "skill.delete",
        entity: "Skill",
        entityId: "sk-2",
      }),
    ).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("log l'erreur via le logger fourni quand l'insert echoue", async () => {
    const create = vi.fn(async () => {
      throw new Error("boom");
    });
    const prisma = { auditLog: { create } } as never;
    const req = { ip: "1.2.3.4", headers: {} } as never;
    const logError = vi.fn();
    await safeRecordAdminActionFromRequest(
      prisma,
      req,
      { action: "x", entity: "Y" },
      { logError },
    );
    expect(logError).toHaveBeenCalledTimes(1);
    const [message, err] = logError.mock.calls[0];
    expect(message).toContain("Failed to record admin action");
    expect((err as Error).message).toBe("boom");
  });

  it("n'invoque pas le logger quand l'insert reussit", async () => {
    const create = vi.fn(async () => undefined);
    const prisma = { auditLog: { create } } as never;
    const req = { ip: "1.2.3.4", headers: {} } as never;
    const logError = vi.fn();
    await safeRecordAdminActionFromRequest(
      prisma,
      req,
      { action: "x", entity: "Y" },
      { logError },
    );
    expect(logError).not.toHaveBeenCalled();
  });
});
