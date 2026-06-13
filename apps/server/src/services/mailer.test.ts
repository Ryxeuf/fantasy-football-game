import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendEmail,
  setMailTransport,
  hasMailTransport,
  type EmailMessage,
} from "./mailer";

const msg: EmailMessage = {
  to: "coach@test",
  subject: "Hi",
  text: "body",
};

describe("mailer", () => {
  beforeEach(() => setMailTransport(null));
  afterEach(() => setMailTransport(null));

  it("degrades gracefully when no transport is configured", async () => {
    expect(hasMailTransport()).toBe(false);
    const result = await sendEmail(msg);
    expect(result).toEqual({ delivered: false, reason: "no-transport" });
  });

  it("delivers via a configured transport", async () => {
    const transport = vi.fn().mockResolvedValue(undefined);
    setMailTransport(transport);
    expect(hasMailTransport()).toBe(true);

    const result = await sendEmail(msg);
    expect(result).toEqual({ delivered: true });
    expect(transport).toHaveBeenCalledWith(msg);
  });

  it("never throws when the transport fails", async () => {
    setMailTransport(vi.fn().mockRejectedValue(new Error("smtp down")));
    const result = await sendEmail(msg);
    expect(result).toEqual({ delivered: false, reason: "error" });
  });
});
