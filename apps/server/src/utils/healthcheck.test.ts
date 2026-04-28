/**
 * Tests pour les handlers healthcheck profond (tâche S25.1).
 */

import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { liveness, readiness } from "./healthcheck";

function buildRes() {
  let statusCode = 200;
  let body: unknown = null;
  const res = {
    status: vi.fn(function (this: typeof res, code: number) {
      statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: typeof res, payload: unknown) {
      body = payload;
      return this;
    }),
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

describe("liveness handler", () => {
  it("retourne toujours 200 + ok=true sans toucher à la DB", async () => {
    const res = buildRes();
    await liveness({} as Request, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      status: "live",
    });
  });
});

describe("readiness handler", () => {
  it("retourne 200 + ready=true quand le ping DB réussit", async () => {
    const dbPing = vi.fn().mockResolvedValue(undefined);
    const res = buildRes();

    await readiness({ dbPing })({} as Request, res);

    expect(dbPing).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      status: "ready",
      checks: { db: "up" },
    });
  });

  it("retourne 503 + ready=false quand le ping DB échoue", async () => {
    const dbPing = vi
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED 5432"));
    const res = buildRes();

    await readiness({ dbPing })({} as Request, res);

    expect(res.statusCode).toBe(503);
    expect((res.body as { ok: boolean }).ok).toBe(false);
    expect((res.body as { checks: { db: string } }).checks.db).toBe("down");
    // Le détail d'erreur n'est pas exposé pour ne pas leak l'infra
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });

  it("plafonne le temps d'attente du ping DB (timeout)", async () => {
    const slowPing = () =>
      new Promise<void>((resolve) =>
        setTimeout(resolve, 200),
      );
    const res = buildRes();

    await readiness({ dbPing: slowPing, timeoutMs: 30 })({} as Request, res);

    expect(res.statusCode).toBe(503);
    expect((res.body as { checks: { db: string } }).checks.db).toBe("timeout");
  });
});
