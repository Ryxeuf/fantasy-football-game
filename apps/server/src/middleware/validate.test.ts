import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate, validateQuery } from "./validate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createMockReq(body: unknown) {
  return { body } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validate middleware", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  describe("when the body matches the schema", () => {
    it("calls next()", () => {
      const req = createMockReq({ name: "Alice", age: 30 });
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("replaces req.body with the parsed (coerced) data", () => {
      const req = createMockReq({ name: "Bob", age: 25 });
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      // Zod parse strips unknown fields and applies defaults
      expect(req.body).toEqual({ name: "Bob", age: 25 });
    });

    it("strips unknown fields from req.body after parsing", () => {
      const req = createMockReq({ name: "Carol", age: 20, extra: "unwanted" });
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      // Zod strips unknown keys by default
      expect(req.body).not.toHaveProperty("extra");
      expect(req.body).toEqual({ name: "Carol", age: 20 });
    });
  });

  describe("when the body fails validation", () => {
    it("returns 400 status", () => {
      const req = createMockReq({ name: "", age: 30 });
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns a JSON error with field path and message", () => {
      const req = createMockReq({ name: "", age: 30 });
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg).toHaveProperty("error");
      expect(typeof jsonArg.error).toBe("string");
      // The error should reference the failing field
      expect(jsonArg.error).toContain("name");
    });

    it("includes the field path in the error message for nested failures", () => {
      const nestedSchema = z.object({
        user: z.object({
          email: z.string().email(),
        }),
      });

      const req = createMockReq({ user: { email: "not-an-email" } });
      const res = createMockRes();
      const next = vi.fn();

      validate(nestedSchema)(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Path: "user.email"
      expect(jsonArg.error).toContain("user.email");
    });

    it("concatenates multiple validation errors with a comma separator", () => {
      // Both fields invalid
      const req = createMockReq({ name: "", age: -5 });
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Two issues → the error string should contain a comma joining them
      expect(jsonArg.error).toContain(",");
    });

    it("returns 400 when body is null", () => {
      const req = createMockReq(null);
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 when body is undefined", () => {
      const req = createMockReq(undefined);
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 when body is an empty object and fields are required", () => {
      const req = createMockReq({});
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 when a field has the wrong type", () => {
      const req = createMockReq({ name: "Dave", age: "thirty" });
      const res = createMockRes();
      const next = vi.fn();

      validate(schema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.error).toContain("age");
    });
  });

  describe("edge cases", () => {
    it("works with a schema that accepts any object (passthrough)", () => {
      const permissiveSchema = z.object({}).passthrough();
      const req = createMockReq({ anything: true });
      const res = createMockRes();
      const next = vi.fn();

      validate(permissiveSchema)(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.body).toEqual({ anything: true });
    });

    it("works with optional fields present", () => {
      const schemaWithOptional = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      });
      const req = createMockReq({ name: "Eve", nickname: "Evy" });
      const res = createMockRes();
      const next = vi.fn();

      validate(schemaWithOptional)(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.body).toEqual({ name: "Eve", nickname: "Evy" });
    });

    it("works with optional fields absent", () => {
      const schemaWithOptional = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      });
      const req = createMockReq({ name: "Frank" });
      const res = createMockRes();
      const next = vi.fn();

      validate(schemaWithOptional)(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// validateQuery middleware
// ---------------------------------------------------------------------------

function createMockReqWithQuery(query: unknown) {
  return { query } as any;
}

describe("validateQuery middleware", () => {
  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().max(200).default(""),
  });

  describe("when query params match the schema", () => {
    it("calls next()", () => {
      const req = createMockReqWithQuery({ page: "2", limit: "25", search: "test" });
      const res = createMockRes();
      const next = vi.fn();

      validateQuery(querySchema)(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("replaces req.query with parsed and coerced data", () => {
      const req = createMockReqWithQuery({ page: "3", limit: "10" });
      const res = createMockRes();
      const next = vi.fn();

      validateQuery(querySchema)(req, res, next);

      expect(req.query).toEqual({ page: 3, limit: 10, search: "" });
    });

    it("applies defaults for missing optional fields", () => {
      const req = createMockReqWithQuery({});
      const res = createMockRes();
      const next = vi.fn();

      validateQuery(querySchema)(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.query).toEqual({ page: 1, limit: 50, search: "" });
    });
  });

  describe("when query params fail validation", () => {
    it("returns 400 for invalid values", () => {
      const req = createMockReqWithQuery({ page: "0" }); // min is 1
      const res = createMockRes();
      const next = vi.fn();

      validateQuery(querySchema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 when limit exceeds max", () => {
      const req = createMockReqWithQuery({ limit: "999" });
      const res = createMockRes();
      const next = vi.fn();

      validateQuery(querySchema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns an error message in the response", () => {
      const req = createMockReqWithQuery({ page: "abc" }); // NaN after coerce
      const res = createMockRes();
      const next = vi.fn();

      validateQuery(querySchema)(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg).toHaveProperty("error");
      expect(typeof jsonArg.error).toBe("string");
    });
  });
});
