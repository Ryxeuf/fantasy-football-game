/**
 * Tests des handlers `POST /feedback` (public) et des handlers admin
 * (list / update status). Pattern aligne sur match.test.ts : prisma et
 * services mockes, req/res construits a la main.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    feedback: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("../services/turnstile", () => ({
  verifyTurnstileToken: vi.fn(),
}));

import { prisma } from "../prisma";
import { verifyTurnstileToken } from "../services/turnstile";
import {
  handleCreateFeedback,
  handleListFeedback,
  handleUpdateFeedbackStatus,
  handleGetFeedback,
} from "./feedback";

const mockPrisma = prisma as any;
const mockVerify = verifyTurnstileToken as unknown as ReturnType<typeof vi.fn>;

function buildReqRes(body: any = {}, query: any = {}, params: any = {}, headers: any = {}, ip = "1.2.3.4") {
  const req: any = {
    body,
    query,
    params,
    ip,
    get: (h: string) => headers[h.toLowerCase()],
    headers,
  };
  const res: any = {
    statusCode: 200,
    payload: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.payload = body;
      return this;
    },
  };
  return { req, res };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /feedback", () => {
  it("rejects when captcha verification fails", async () => {
    mockVerify.mockResolvedValueOnce({ ok: false, errorCode: "invalid-input-response" });
    const { req, res } = buildReqRes({
      type: "bug",
      subject: "Crash",
      message: "Le bouton plante quand je clique dessus svp",
      captchaToken: "bad-token",
    });

    await handleCreateFeedback(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toMatch(/captcha/i);
    expect(mockPrisma.feedback.create).not.toHaveBeenCalled();
  });

  it("creates a feedback record with status=new on success", async () => {
    mockVerify.mockResolvedValueOnce({ ok: true });
    mockPrisma.feedback.create.mockResolvedValueOnce({
      id: "fb_1",
      status: "new",
    });
    // En production le body est deja passe par le middleware `validate`
    // qui trime les chaines via Zod. On simule donc l'output de Zod ici.
    const { req, res } = buildReqRes(
      {
        type: "bug",
        name: "Alice",
        email: "alice@example.com",
        subject: "Crash sur la page tutoriel",
        message: "Quand je clique sur 'Suivant' a la lecon 2 ca crashe.",
        pageUrl: "https://nufflearena.fr/tutoriel/lecon-2",
        captchaToken: "good-token",
      },
      {},
      {},
      { "user-agent": "Mozilla/5.0 ..." },
      "9.9.9.9",
    );

    await handleCreateFeedback(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.payload).toEqual({ ok: true, id: "fb_1" });
    expect(mockVerify).toHaveBeenCalledWith("good-token", "9.9.9.9");
    expect(mockPrisma.feedback.create).toHaveBeenCalledOnce();
    const arg = mockPrisma.feedback.create.mock.calls[0][0].data;
    expect(arg).toMatchObject({
      type: "bug",
      name: "Alice",
      email: "alice@example.com",
      subject: "Crash sur la page tutoriel",
      message: "Quand je clique sur 'Suivant' a la lecon 2 ca crashe.",
      pageUrl: "https://nufflearena.fr/tutoriel/lecon-2",
      userAgent: "Mozilla/5.0 ...",
    });
    // Le status par defaut vient de la DB, pas du payload
    expect(arg.status).toBeUndefined();
  });

  it("never persists the captchaToken or the IP address", async () => {
    mockVerify.mockResolvedValueOnce({ ok: true });
    mockPrisma.feedback.create.mockResolvedValueOnce({ id: "fb_2" });
    const { req, res } = buildReqRes({
      type: "remark",
      subject: "Super site",
      message: "Vraiment bien fait, bravo l'equipe !",
      captchaToken: "token-xyz",
    });

    await handleCreateFeedback(req, res);

    expect(res.statusCode).toBe(201);
    const data = mockPrisma.feedback.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("captchaToken");
    expect(data).not.toHaveProperty("ipAddress");
    expect(data).not.toHaveProperty("ip");
  });

  it("truncates user-agent if abnormally long", async () => {
    mockVerify.mockResolvedValueOnce({ ok: true });
    mockPrisma.feedback.create.mockResolvedValueOnce({ id: "fb_3" });
    const longUa = "X".repeat(2000);
    const { req, res } = buildReqRes(
      {
        type: "comment",
        subject: "ok",
        message: "Suffisamment long pour passer la validation min",
        captchaToken: "t",
      },
      {},
      {},
      { "user-agent": longUa },
    );

    await handleCreateFeedback(req, res);

    expect(res.statusCode).toBe(201);
    const data = mockPrisma.feedback.create.mock.calls[0][0].data;
    expect(typeof data.userAgent).toBe("string");
    expect(data.userAgent.length).toBeLessThanOrEqual(500);
  });

  it("returns 500 when the DB insert fails (no captcha leak)", async () => {
    mockVerify.mockResolvedValueOnce({ ok: true });
    mockPrisma.feedback.create.mockRejectedValueOnce(new Error("db down"));
    const { req, res } = buildReqRes({
      type: "bug",
      subject: "x",
      message: "Suffisamment long pour passer la validation min",
      captchaToken: "t",
    });

    await handleCreateFeedback(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload?.error).toBeTruthy();
    // Surface utilisateur reste generique : pas de fuite d'erreur DB.
    expect(res.payload?.error).not.toMatch(/db down/);
  });
});

describe("GET /admin/feedback", () => {
  it("lists feedbacks with default pagination", async () => {
    mockPrisma.feedback.findMany.mockResolvedValueOnce([
      { id: "fb_1", status: "new", type: "bug", subject: "s1", createdAt: new Date() },
    ]);
    mockPrisma.feedback.count.mockResolvedValueOnce(1);
    const { req, res } = buildReqRes({}, { page: 1, limit: 20 });

    await handleListFeedback(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.feedbacks).toHaveLength(1);
    expect(res.payload.total).toBe(1);
    expect(res.payload.page).toBe(1);
    expect(res.payload.limit).toBe(20);
    const where = mockPrisma.feedback.findMany.mock.calls[0][0].where;
    expect(where).toEqual({});
  });

  it("filters by status and type", async () => {
    mockPrisma.feedback.findMany.mockResolvedValueOnce([]);
    mockPrisma.feedback.count.mockResolvedValueOnce(0);
    const { req, res } = buildReqRes({}, { status: "new", type: "bug", page: 1, limit: 20 });

    await handleListFeedback(req, res);

    const where = mockPrisma.feedback.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("new");
    expect(where.type).toBe("bug");
  });

  it("supports a search filter on subject and message", async () => {
    mockPrisma.feedback.findMany.mockResolvedValueOnce([]);
    mockPrisma.feedback.count.mockResolvedValueOnce(0);
    const { req, res } = buildReqRes({}, { search: "crash", page: 1, limit: 20 });

    await handleListFeedback(req, res);

    const where = mockPrisma.feedback.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(Array.isArray(where.OR)).toBe(true);
  });
});

describe("PATCH /admin/feedback/:id", () => {
  it("updates the status of a feedback", async () => {
    mockPrisma.feedback.update.mockResolvedValueOnce({
      id: "fb_1",
      status: "read",
    });
    const { req, res } = buildReqRes(
      { status: "read" },
      {},
      { id: "fb_1" },
    );

    await handleUpdateFeedbackStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.feedback.status).toBe("read");
    expect(mockPrisma.feedback.update).toHaveBeenCalledWith({
      where: { id: "fb_1" },
      data: { status: "read" },
    });
  });

  it("returns 404 if the feedback does not exist", async () => {
    const err: any = new Error("not found");
    err.code = "P2025";
    mockPrisma.feedback.update.mockRejectedValueOnce(err);
    const { req, res } = buildReqRes(
      { status: "resolved" },
      {},
      { id: "missing" },
    );

    await handleUpdateFeedbackStatus(req, res);

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /admin/feedback/:id", () => {
  it("returns the feedback when found", async () => {
    mockPrisma.feedback.findUnique.mockResolvedValueOnce({
      id: "fb_1",
      type: "bug",
      subject: "x",
      message: "m",
      status: "new",
    });
    const { req, res } = buildReqRes({}, {}, { id: "fb_1" });

    await handleGetFeedback(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.feedback.id).toBe("fb_1");
  });

  it("returns 404 when not found", async () => {
    mockPrisma.feedback.findUnique.mockResolvedValueOnce(null);
    const { req, res } = buildReqRes({}, {}, { id: "missing" });

    await handleGetFeedback(req, res);

    expect(res.statusCode).toBe(404);
  });
});
