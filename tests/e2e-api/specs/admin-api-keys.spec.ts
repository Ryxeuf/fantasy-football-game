import { beforeEach, describe, expect, it } from "vitest";
import { get, resetDb } from "../helpers/api";
import { API_BASE } from "../helpers/env";
import { seedAndLogin } from "../helpers/factories";

/**
 * Clés API d'administration, sur une vraie base (change OpenSpec
 * `admin-api-keys`) : un admin crée une clé en session, un client
 * automatisé la PRÉSENTE au serveur (Bearer ou X-API-Key), la portée et les
 * actions réservées à une session sont appliquées, la révocation prend effet
 * à la requête suivante, et les actions faites par clé sont tracées.
 */

interface CreatedKey {
  key: { id: string; keyPrefix: string; scope: string; status: string };
  secret: string;
}

async function send(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown,
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("E2E API — clés API d'administration", () => {
  let admin: { token: string; userId: string };
  let coach: { token: string; userId: string };

  beforeEach(async () => {
    await resetDb();
    admin = await seedAndLogin("admin-keys@ffa.test", "password-a", "Admin Clés", { role: "admin" });
    coach = await seedAndLogin("coach-keys@ffa.test", "password-c", "Coach Clés");
  });

  async function createKey(body: Record<string, unknown>): Promise<CreatedKey> {
    const res = await send("POST", "/admin/api-keys", bearer(admin.token), body);
    expect(res.status).toBe(201);
    return res.body as CreatedKey;
  }

  it("une clé en lecture seule lit l'admin au nom de son propriétaire, et n'écrit rien", async () => {
    const { key, secret } = await createKey({ name: "Claude Code — recette" });
    expect(key).toMatchObject({ scope: "read", status: "active" });
    expect(secret.startsWith(key.keyPrefix)).toBe(true);

    // Identité : le propriétaire, et la clé annoncée.
    const me = await send("GET", "/auth/me", bearer(secret));
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(admin.userId);
    expect(me.body.user.apiKey).toEqual({
      name: "Claude Code — recette",
      keyPrefix: key.keyPrefix,
      scope: "read",
    });

    // Lectures admin, par les deux en-têtes.
    expect((await send("GET", "/admin/stats", bearer(secret))).status).toBe(200);
    expect((await send("GET", "/admin/feature-flags", { "X-API-Key": secret })).status).toBe(200);

    // Écriture refusée avant tout traitement.
    const write = await send("POST", "/admin/feature-flags", bearer(secret), { key: "from_key" });
    expect(write.status).toBe(403);
    expect(write.body.code).toBe("api_key_read_only");
    const flags = await get<any>("/admin/feature-flags", admin.token);
    expect(JSON.stringify(flags)).not.toContain("from_key");
  });

  it("une clé en écriture agit, est tracée, mais ne gère pas les clés ni le compte", async () => {
    const { key, secret } = await createKey({ name: "CI", scope: "write", expiresInDays: null });

    const updated = await send("PATCH", `/admin/users/${coach.userId}/patreon`, bearer(secret), {
      patreon: true,
    });
    expect(updated.status).toBe(200);

    // Tracée au nom du propriétaire ET de la clé ; une action faite en
    // session ne porte aucune clé.
    await send("PATCH", `/admin/users/${coach.userId}/patreon`, bearer(admin.token), {
      patreon: false,
    });
    const audit = await get<any>("/admin/audit-log?action=user.patreon.update", admin.token);
    // Le journal d'audit survit au reset : on ne garde que ce coach.
    const entries = (audit.entries as any[]).filter((e) => e.entityId === coach.userId);
    expect(entries).toHaveLength(2);
    const byKey = entries.find((e) => e.apiKeyId === key.id);
    expect(byKey?.userId).toBe(admin.userId);
    expect(entries.filter((e) => e.apiKeyId === null)).toHaveLength(1);

    for (const [method, path, body] of [
      ["GET", "/admin/api-keys", undefined],
      ["POST", "/admin/api-keys", { name: "rebond" }],
      ["POST", `/admin/users/${coach.userId}/impersonate`, {}],
      ["PUT", "/auth/me/password", { currentPassword: "password-a", newPassword: "nouveau-mdp-1" }],
    ] as const) {
      const res = await send(method, path, bearer(secret), body);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body.code).toBe("interactive_session_required");
    }
  });

  it("la révocation prend effet à la requête suivante", async () => {
    const { key, secret } = await createKey({ name: "Éphémère" });
    expect((await send("GET", "/auth/me", bearer(secret))).status).toBe(200);

    const revoked = await send("POST", `/admin/api-keys/${key.id}/revoke`, bearer(admin.token));
    expect(revoked.status).toBe(200);
    expect(revoked.body.key.status).toBe("revoked");

    const after = await send("GET", "/auth/me", bearer(secret));
    expect(after.status).toBe(401);
    expect(after.body.code).toBe("api_key_invalid");

    // La liste ne sert jamais le secret, et garde la trace de l'usage.
    const list = await send("GET", "/admin/api-keys", bearer(admin.token));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(secret);
    const row = (list.body.keys as any[]).find((k) => k.id === key.id);
    expect(row.status).toBe("revoked");
  });

  it("une clé inconnue est refusée, et un coach ne crée pas de clé", async () => {
    const unknown = await send("GET", "/auth/me", bearer(`nak_${"Z".repeat(43)}`));
    expect(unknown.status).toBe(401);
    expect(unknown.body.code).toBe("api_key_invalid");

    const res = await send("POST", "/admin/api-keys", bearer(coach.token), { name: "x" });
    expect(res.status).toBe(403);
  });
});
