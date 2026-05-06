import { describe, it, expect } from "vitest";
import {
  createFeedbackSchema,
  updateFeedbackStatusSchema,
  listFeedbackQuerySchema,
} from "./feedback.schemas";

describe("createFeedbackSchema", () => {
  const valid = {
    type: "bug" as const,
    subject: "Bouton planquant",
    message: "Le bouton de fin de tour ne reagit plus apres le 3e click.",
    captchaToken: "tk_xxx",
  };

  it("accepts a minimal valid payload", () => {
    const r = createFeedbackSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("trims subject, message, name", () => {
    const r = createFeedbackSchema.safeParse({
      ...valid,
      name: "   Bob   ",
      subject: "   Hello   ",
      message: "   Suffisamment long pour le min de 10   ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Bob");
      expect(r.data.subject).toBe("Hello");
      expect(r.data.message).toBe("Suffisamment long pour le min de 10");
    }
  });

  it("rejects unknown type", () => {
    const r = createFeedbackSchema.safeParse({ ...valid, type: "spam" });
    expect(r.success).toBe(false);
  });

  it("rejects messages shorter than 10 chars after trim", () => {
    const r = createFeedbackSchema.safeParse({ ...valid, message: "  short  " });
    expect(r.success).toBe(false);
  });

  it("rejects subjects over 200 chars", () => {
    const r = createFeedbackSchema.safeParse({
      ...valid,
      subject: "x".repeat(201),
    });
    expect(r.success).toBe(false);
  });

  it("rejects messages over 5000 chars", () => {
    const r = createFeedbackSchema.safeParse({
      ...valid,
      message: "x".repeat(5001),
    });
    expect(r.success).toBe(false);
  });

  it("treats empty optional strings as undefined", () => {
    const r = createFeedbackSchema.safeParse({
      ...valid,
      name: "",
      email: "",
      pageUrl: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBeUndefined();
      expect(r.data.email).toBeUndefined();
      expect(r.data.pageUrl).toBeUndefined();
    }
  });

  it("rejects invalid email when provided", () => {
    const r = createFeedbackSchema.safeParse({
      ...valid,
      email: "not-an-email",
    });
    expect(r.success).toBe(false);
  });

  it("rejects pageUrl with non-http scheme (XSS guard)", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "/relative/path",
      "ftp://example.com",
    ]) {
      const r = createFeedbackSchema.safeParse({ ...valid, pageUrl: bad });
      expect(r.success, `should reject ${bad}`).toBe(false);
    }
  });

  it("accepts http and https pageUrl", () => {
    for (const ok of [
      "http://example.com",
      "https://nufflearena.fr/tutoriel/lecon-2",
    ]) {
      const r = createFeedbackSchema.safeParse({ ...valid, pageUrl: ok });
      expect(r.success, `should accept ${ok}`).toBe(true);
    }
  });

  it("requires captchaToken", () => {
    const r = createFeedbackSchema.safeParse({
      type: "bug",
      subject: "x",
      message: "Suffisamment long pour passer la validation min",
    });
    expect(r.success).toBe(false);
  });
});

describe("updateFeedbackStatusSchema", () => {
  it("accepts the 3 valid statuses", () => {
    for (const status of ["new", "read", "resolved"] as const) {
      const r = updateFeedbackStatusSchema.safeParse({ status });
      expect(r.success).toBe(true);
    }
  });

  it("rejects unknown status", () => {
    const r = updateFeedbackStatusSchema.safeParse({ status: "spam" });
    expect(r.success).toBe(false);
  });
});

describe("listFeedbackQuerySchema", () => {
  it("applies defaults for page and limit", () => {
    const r = listFeedbackQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(20);
    }
  });

  it("coerces numeric query strings", () => {
    const r = listFeedbackQuerySchema.safeParse({ page: "3", limit: "50" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(3);
      expect(r.data.limit).toBe(50);
    }
  });

  it("rejects limit > 100", () => {
    const r = listFeedbackQuerySchema.safeParse({ limit: "500" });
    expect(r.success).toBe(false);
  });
});
