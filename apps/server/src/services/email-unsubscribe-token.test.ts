import { describe, it, expect } from "vitest";
import {
  buildUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./email-unsubscribe-token";

const SECRET = "test-secret-abc";

describe("email-unsubscribe-token", () => {
  it("round-trips a userId through sign/verify", () => {
    const token = buildUnsubscribeToken("user-123", SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe("user-123");
  });

  it("handles userIds with special chars (base64url payload)", () => {
    const id = "cuid_AbC-123/xyz+==";
    const token = buildUnsubscribeToken(id, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(id);
  });

  it("rejects a token signed with a different secret", () => {
    const token = buildUnsubscribeToken("user-123", SECRET);
    expect(verifyUnsubscribeToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = buildUnsubscribeToken("user-123", SECRET);
    const [, sig] = token.split(".");
    const forged = `${Buffer.from("user-evil").toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(forged, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = buildUnsubscribeToken("user-123", SECRET);
    const [payload] = token.split(".");
    expect(verifyUnsubscribeToken(`${payload}.deadbeef`, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("no-dot", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(".", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("a.", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(".b", SECRET)).toBeNull();
    // @ts-expect-error — defensive non-string input
    expect(verifyUnsubscribeToken(null, SECRET)).toBeNull();
  });

  it("produces different tokens for different users", () => {
    const a = buildUnsubscribeToken("user-a", SECRET);
    const b = buildUnsubscribeToken("user-b", SECRET);
    expect(a).not.toBe(b);
  });
});
