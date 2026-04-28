/**
 * Tests pour le middleware de corrélation de requête (tâche S25.1).
 */

import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
  REQUEST_ID_HEADER,
  requestContext,
} from "./requestContext";

interface MockReq {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
  originalUrl?: string;
  path: string;
  requestId?: string;
  log?: unknown;
}

function buildReq(overrides: Partial<MockReq> = {}): Request {
  return {
    method: "GET",
    url: "/probe",
    originalUrl: "/probe",
    path: "/probe",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function buildRes() {
  const finishHandlers: Array<() => void> = [];
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    getHeader: (name: string) => headers[name.toLowerCase()],
    on: (event: string, fn: () => void) => {
      if (event === "finish") finishHandlers.push(fn);
    },
    finish: () => {
      finishHandlers.forEach((fn) => fn());
    },
  };
  return res as unknown as Response & {
    finish: () => void;
    getHeader: (n: string) => string | undefined;
  };
}

describe("requestContext middleware", () => {
  it("génère un requestId v4 quand le header est absent", () => {
    const mw = requestContext();
    const req = buildReq();
    const res = buildRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as { requestId: string }).requestId).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(res.getHeader(REQUEST_ID_HEADER)).toBe(
      (req as { requestId: string }).requestId,
    );
  });

  it("réutilise le header `x-request-id` quand le client en fournit un", () => {
    const provided = "11111111-2222-4333-8444-555555555555";
    const mw = requestContext();
    const req = buildReq({ headers: { [REQUEST_ID_HEADER]: provided } });
    const res = buildRes();

    mw(req, res, vi.fn());

    expect((req as { requestId: string }).requestId).toBe(provided);
    expect(res.getHeader(REQUEST_ID_HEADER)).toBe(provided);
  });

  it("ignore les valeurs malformées du header (anti-injection)", () => {
    const mw = requestContext();
    const req = buildReq({
      headers: { [REQUEST_ID_HEADER]: "<script>alert(1)</script>" },
    });
    const res = buildRes();

    mw(req, res, vi.fn());

    const id = (req as { requestId: string }).requestId;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(id).not.toContain("<");
  });

  it("expose un logger enfant qui logge avec requestId à chaque appel", () => {
    const recorded: Array<{ level: string; obj: unknown; msg: string }> = [];
    const childOf = (binding: Record<string, unknown>) => ({
      info: (obj: unknown, msg: string) =>
        recorded.push({
          level: "info",
          obj: { ...binding, ...((obj as Record<string, unknown>) || {}) },
          msg,
        }),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    });
    const fakeLogger = {
      child: childOf,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };

    const mw = requestContext({ baseLogger: fakeLogger as never });
    const req = buildReq({ headers: { [REQUEST_ID_HEADER]: "abc-12345678" } });
    const res = buildRes();
    mw(req, res, vi.fn());

    (req as { log: { info: (obj: unknown, m: string) => void } }).log.info(
      {},
      "hello",
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0].msg).toBe("hello");
    expect(
      (recorded[0].obj as { requestId: string }).requestId,
    ).toBe("abc-12345678");
  });

  it("attache durationMs et statusCode au log de fin quand logFinish=true", () => {
    const finalLogs: Array<{ obj: Record<string, unknown>; msg: string }> = [];
    const childOf = (_binding: Record<string, unknown>) => ({
      info: (obj: Record<string, unknown>, msg: string) =>
        finalLogs.push({ obj: { ...obj }, msg }),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    });
    const fakeLogger = {
      child: childOf,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };

    const mw = requestContext({
      baseLogger: fakeLogger as never,
      logFinish: true,
    });
    const req = buildReq({ headers: { [REQUEST_ID_HEADER]: "f-1" } });
    const res = buildRes();
    res.statusCode = 201;
    mw(req, res, vi.fn());

    res.finish();

    expect(finalLogs).toHaveLength(1);
    expect(finalLogs[0].obj.statusCode).toBe(201);
    expect(typeof finalLogs[0].obj.durationMs).toBe("number");
  });
});
