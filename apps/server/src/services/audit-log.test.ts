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
import { recordAdminAction } from "./audit-log";

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
