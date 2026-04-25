/**
 * Tests pour l'enveloppe ApiResponse<T> standardisée (tâche O.6).
 */

import { describe, it, expect, vi } from "vitest";
import {
  apiSuccess,
  apiError,
  sendSuccess,
  sendError,
  isApiSuccess,
  isApiError,
  apiErrorHandler,
  type ApiResponse,
} from "./api-response";

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe("api-response helpers", () => {
  describe("apiSuccess", () => {
    it("retourne une enveloppe success avec data", () => {
      const r = apiSuccess({ id: "abc" });
      expect(r).toEqual({ success: true, data: { id: "abc" } });
    });

    it("supporte les types primitifs", () => {
      expect(apiSuccess(42)).toEqual({ success: true, data: 42 });
      expect(apiSuccess("ok")).toEqual({ success: true, data: "ok" });
      expect(apiSuccess(null)).toEqual({ success: true, data: null });
    });

    it("inclut meta optionnel pour pagination", () => {
      const r = apiSuccess([1, 2, 3], { total: 3, page: 1, limit: 10 });
      expect(r).toEqual({
        success: true,
        data: [1, 2, 3],
        meta: { total: 3, page: 1, limit: 10 },
      });
    });
  });

  describe("apiError", () => {
    it("retourne une enveloppe error avec message", () => {
      const r = apiError("Boom");
      expect(r).toEqual({ success: false, error: "Boom" });
    });
  });

  describe("type guards", () => {
    it("isApiSuccess discrimine correctement", () => {
      const ok: ApiResponse<number> = apiSuccess(1);
      const ko: ApiResponse<number> = apiError("nope");
      expect(isApiSuccess(ok)).toBe(true);
      expect(isApiSuccess(ko)).toBe(false);
    });

    it("isApiError discrimine correctement", () => {
      const ok: ApiResponse<number> = apiSuccess(1);
      const ko: ApiResponse<number> = apiError("nope");
      expect(isApiError(ko)).toBe(true);
      expect(isApiError(ok)).toBe(false);
    });
  });

  describe("sendSuccess", () => {
    it("envoie status 200 par défaut avec l'enveloppe success", () => {
      const res = mockRes();
      sendSuccess(res as any, { x: 1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { x: 1 } });
    });

    it("accepte un status custom (ex: 201)", () => {
      const res = mockRes();
      sendSuccess(res as any, { id: "new" }, 201);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: "new" } });
    });

    it("transmet meta quand fourni", () => {
      const res = mockRes();
      sendSuccess(res as any, [1], 200, { total: 1, page: 1, limit: 10 });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [1],
        meta: { total: 1, page: 1, limit: 10 },
      });
    });
  });

  describe("sendError", () => {
    it("envoie status 500 par défaut", () => {
      const res = mockRes();
      sendError(res as any, "Erreur serveur");
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: "Erreur serveur" });
    });

    it("accepte un status custom (ex: 404)", () => {
      const res = mockRes();
      sendError(res as any, "Introuvable", 404);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: "Introuvable" });
    });
  });

  describe("apiErrorHandler middleware", () => {
    it("convertit une Error en réponse standardisée 500", () => {
      const res = mockRes();
      const next = vi.fn();
      apiErrorHandler(new Error("Boom"), {} as any, res as any, next as any);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: "Boom" });
    });

    it("respecte un status attaché à l'erreur (ex: 404)", () => {
      const res = mockRes();
      const next = vi.fn();
      const err = Object.assign(new Error("Not found"), { status: 404 });
      apiErrorHandler(err, {} as any, res as any, next as any);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: "Not found" });
    });

    it("renvoie 'Erreur serveur' pour une exception non-Error", () => {
      const res = mockRes();
      const next = vi.fn();
      apiErrorHandler("string error", {} as any, res as any, next as any);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Erreur serveur",
      });
    });

    it("délègue à next() si headers déjà envoyés", () => {
      const res = mockRes();
      (res as any).headersSent = true;
      const next = vi.fn();
      const err = new Error("Boom");
      apiErrorHandler(err, {} as any, res as any, next as any);
      expect(next).toHaveBeenCalledWith(err);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
