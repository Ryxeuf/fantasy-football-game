import { describe, it, expect } from "vitest";

import { safeJsonLd } from "./safe-json-ld";

describe("safeJsonLd — audit round 9 XSS protection", () => {
  it("escape < et > pour bloquer </script> breakout", () => {
    const malicious = { title: "Hello </script><script>alert(1)</script>" };
    const out = safeJsonLd(malicious);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script");
    expect(out).toContain("\\u003c");
  });

  it("escape & pour eviter les attaques HTML entity", () => {
    const out = safeJsonLd({ x: "a&b" });
    expect(out).not.toContain("&");
    expect(out).toContain("\\u0026");
  });

  it("escape les line separators U+2028 / U+2029", () => {
    const malicious = { title: "Hello World " };
    const out = safeJsonLd(malicious);
    expect(out).not.toContain(" ");
    expect(out).not.toContain(" ");
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });

  it("preserve les caracteres normaux", () => {
    const out = safeJsonLd({ message: "Hello world" });
    expect(out).toBe('{"message":"Hello world"}');
  });

  it("parse via JSON.parse apres escape (idempotence du roundtrip)", () => {
    const original = {
      title: "Test </script>",
      score: 42,
      nested: { key: "<value & more>" },
    };
    const escaped = safeJsonLd(original);
    const decoded = JSON.parse(escaped);
    expect(decoded).toEqual(original);
  });
});
