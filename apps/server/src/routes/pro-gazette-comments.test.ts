/**
 * Tests integration des endpoints gazette comments (Q.B.2).
 *
 * Couvre les 2 routers (user-facing + admin) avec mocks du service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = req.user ?? { id: "user-1", role: "user" };
    next();
  },
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (req: any, res: any, next: any) => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  },
}));

vi.mock("../services/pro-gazette-comments", () => {
  class CommentsError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "CommentsError";
    }
  }
  return {
    CommentsError,
    createComment: vi.fn(),
    listComments: vi.fn(),
    softDeleteComment: vi.fn(),
    flagComment: vi.fn(),
    unflagComment: vi.fn(),
    restoreComment: vi.fn(),
    adminListComments: vi.fn(),
  };
});

import express from "express";
import http from "http";
import { userRouter, adminRouter } from "./pro-gazette-comments";
import {
  CommentsError,
  createComment,
  listComments,
  softDeleteComment,
  flagComment,
  unflagComment,
  restoreComment,
  adminListComments,
} from "../services/pro-gazette-comments";

const mockedCreate = vi.mocked(createComment);
const mockedList = vi.mocked(listComments);
const mockedDelete = vi.mocked(softDeleteComment);
const mockedFlag = vi.mocked(flagComment);
const mockedUnflag = vi.mocked(unflagComment);
const mockedRestore = vi.mocked(restoreComment);
const mockedAdminList = vi.mocked(adminListComments);

async function request(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body: Record<string, unknown> | null = null,
  asAdmin = false,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  // Inject user role per request
  app.use((req, _res, next) => {
    (req as any).user = asAdmin
      ? { id: "admin-1", role: "admin", roles: ["admin"] }
      : { id: "user-1", role: "user" };
    next();
  });
  app.use("/pro-league/gazette", userRouter);
  app.use("/admin/gazette", adminRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const data = body !== null ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: buf ? JSON.parse(buf) : {},
              });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      if (data) req.write(data);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

const viewFixture = {
  id: "c1",
  articleId: "a1",
  userId: "user-1",
  userName: "Alice",
  userEmail: "a@x.com",
  body: "Hello",
  createdAt: "2026-05-20T10:00:00.000Z",
  flagged: false,
  deleted: false,
  flagReason: null,
};

describe("GET /pro-league/gazette/articles/:id/comments", () => {
  it("liste les commentaires (public)", async () => {
    mockedList.mockResolvedValueOnce([viewFixture]);
    const res = await request(
      "GET",
      "/pro-league/gazette/articles/a1/comments",
    );
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(mockedList).toHaveBeenCalledWith("a1", expect.any(Object));
  });
});

describe("POST /pro-league/gazette/articles/:id/comments", () => {
  it("201 + comment cree", async () => {
    mockedCreate.mockResolvedValueOnce(viewFixture);
    const res = await request(
      "POST",
      "/pro-league/gazette/articles/a1/comments",
      { body: "Awesome" },
    );
    expect(res.status).toBe(201);
    expect(res.body.comment.id).toBe("c1");
    expect(mockedCreate).toHaveBeenCalledWith({
      articleId: "a1",
      userId: "user-1",
      body: "Awesome",
    });
  });

  it("400 si body manquant", async () => {
    const res = await request(
      "POST",
      "/pro-league/gazette/articles/a1/comments",
      {},
    );
    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("400 BODY_TOO_LONG mappe", async () => {
    mockedCreate.mockRejectedValueOnce(
      new CommentsError("BODY_TOO_LONG", "trop long") as any,
    );
    const res = await request(
      "POST",
      "/pro-league/gazette/articles/a1/comments",
      { body: "x" },
    );
    expect(res.status).toBe(400);
  });

  it("404 ARTICLE_NOT_FOUND", async () => {
    mockedCreate.mockRejectedValueOnce(
      new CommentsError("ARTICLE_NOT_FOUND", "introuvable") as any,
    );
    const res = await request(
      "POST",
      "/pro-league/gazette/articles/x/comments",
      { body: "ok" },
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /pro-league/gazette/comments/:id", () => {
  it("supprime le comment", async () => {
    mockedDelete.mockResolvedValueOnce({ ...viewFixture, deleted: true });
    const res = await request("DELETE", "/pro-league/gazette/comments/c1");
    expect(res.status).toBe(200);
    expect(res.body.comment.deleted).toBe(true);
  });

  it("403 NOT_OWNER", async () => {
    mockedDelete.mockRejectedValueOnce(
      new CommentsError("NOT_OWNER", "pas le tien") as any,
    );
    const res = await request("DELETE", "/pro-league/gazette/comments/c1");
    expect(res.status).toBe(403);
  });

  it("409 ALREADY_DELETED", async () => {
    mockedDelete.mockRejectedValueOnce(
      new CommentsError("ALREADY_DELETED", "deja") as any,
    );
    const res = await request("DELETE", "/pro-league/gazette/comments/c1");
    expect(res.status).toBe(409);
  });
});

describe("POST /pro-league/gazette/comments/:id/flag", () => {
  it("flag un comment", async () => {
    mockedFlag.mockResolvedValueOnce({
      ...viewFixture,
      flagged: true,
      flagReason: "user:report",
    });
    const res = await request(
      "POST",
      "/pro-league/gazette/comments/c1/flag",
      { reason: "abusive" },
    );
    expect(res.status).toBe(200);
    expect(res.body.comment.flagged).toBe(true);
    expect(mockedFlag).toHaveBeenCalledWith({
      commentId: "c1",
      reason: "user:abusive",
    });
  });
});

describe("GET /admin/gazette/comments", () => {
  it("403 si non admin", async () => {
    const res = await request("GET", "/admin/gazette/comments", null, false);
    expect(res.status).toBe(403);
  });

  it("admin liste les flagged par defaut", async () => {
    mockedAdminList.mockResolvedValueOnce([viewFixture]);
    const res = await request("GET", "/admin/gazette/comments", null, true);
    expect(res.status).toBe(200);
    expect(mockedAdminList).toHaveBeenCalledWith("flagged", 100);
  });

  it("respecte filter=deleted + limit", async () => {
    mockedAdminList.mockResolvedValueOnce([]);
    await request(
      "GET",
      "/admin/gazette/comments?filter=deleted&limit=50",
      null,
      true,
    );
    expect(mockedAdminList).toHaveBeenCalledWith("deleted", 50);
  });

  it("cap limit a 500", async () => {
    mockedAdminList.mockResolvedValueOnce([]);
    await request(
      "GET",
      "/admin/gazette/comments?limit=99999",
      null,
      true,
    );
    expect(mockedAdminList).toHaveBeenCalledWith("flagged", 500);
  });
});

describe("POST /admin/gazette/comments/:id/delete", () => {
  it("admin delete un comment", async () => {
    mockedDelete.mockResolvedValueOnce({ ...viewFixture, deleted: true });
    const res = await request(
      "POST",
      "/admin/gazette/comments/c1/delete",
      null,
      true,
    );
    expect(res.status).toBe(200);
    expect(mockedDelete).toHaveBeenCalledWith({
      commentId: "c1",
      byUserId: "admin-1",
      isAdmin: true,
    });
  });

  it("404 si introuvable", async () => {
    mockedDelete.mockRejectedValueOnce(
      new CommentsError("COMMENT_NOT_FOUND", "x") as any,
    );
    const res = await request(
      "POST",
      "/admin/gazette/comments/x/delete",
      null,
      true,
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /admin/gazette/comments/:id/unflag", () => {
  it("unflag (admin)", async () => {
    mockedUnflag.mockResolvedValueOnce(viewFixture);
    const res = await request(
      "POST",
      "/admin/gazette/comments/c1/unflag",
      null,
      true,
    );
    expect(res.status).toBe(200);
    expect(mockedUnflag).toHaveBeenCalledWith("c1");
  });
});

describe("POST /admin/gazette/comments/:id/restore", () => {
  it("restore (admin)", async () => {
    mockedRestore.mockResolvedValueOnce(viewFixture);
    const res = await request(
      "POST",
      "/admin/gazette/comments/c1/restore",
      null,
      true,
    );
    expect(res.status).toBe(200);
    expect(mockedRestore).toHaveBeenCalledWith("c1");
  });
});
