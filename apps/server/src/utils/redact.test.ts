import { describe, it, expect } from "vitest";

import { redactEmail, userTag } from "./redact";

describe("redactEmail — audit round 5 PII", () => {
  it("masque le local-part en gardant le domaine pour debug operationnel", () => {
    expect(redactEmail("alice@example.com")).toBe("a***@example.com");
    expect(redactEmail("bob@nuffle.io")).toBe("b***@nuffle.io");
  });

  it("gere les local-parts de 1 char", () => {
    expect(redactEmail("a@x.com")).toBe("*@x.com");
  });

  it("gere les emails sans @ (fallback)", () => {
    expect(redactEmail("notAnEmail")).toBe("***");
  });

  it("string vide → vide", () => {
    expect(redactEmail("")).toBe("");
    expect(redactEmail(null)).toBe("");
    expect(redactEmail(undefined)).toBe("");
  });
});

describe("userTag — audit round 5 PII", () => {
  it("retourne user_ + 8 premiers chars de l'id", () => {
    expect(userTag("clxyz123abcdef")).toBe("user_clxyz123");
  });

  it("user_unknown si id absent", () => {
    expect(userTag(null)).toBe("user_unknown");
    expect(userTag(undefined)).toBe("user_unknown");
    expect(userTag("")).toBe("user_unknown");
  });

  it("ne leak pas l'email dans le tag", () => {
    expect(userTag("clxyz123")).not.toContain("@");
  });
});
