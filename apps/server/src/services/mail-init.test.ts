import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock nodemailer : on capture les options passées à createTransport et on
// expose un sendMail espionnable, sans ouvrir de vraie connexion SMTP.
// `vi.hoisted` : les mocks doivent exister avant le hoisting de `vi.mock`.
const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue(undefined);
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

import {
  buildMailTransportFromEnv,
  initMailTransportFromEnv,
  DEFAULT_MAIL_FROM,
  type SmtpEnv,
} from "./mail-init";
import { hasMailTransport, setMailTransport } from "./mailer";

describe("mail-init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMailTransport(null);
  });
  afterEach(() => setMailTransport(null));

  describe("buildMailTransportFromEnv", () => {
    it("returns null when SMTP_HOST is absent (dégradation log only)", () => {
      expect(buildMailTransportFromEnv({})).toBeNull();
      expect(buildMailTransportFromEnv({ SMTP_HOST: "  " })).toBeNull();
      expect(createTransport).not.toHaveBeenCalled();
    });

    it("builds a Mailpit-style transport (no auth, no TLS) on port 1025", () => {
      const env: SmtpEnv = { SMTP_HOST: "mailpit", SMTP_PORT: "1025" };
      const transport = buildMailTransportFromEnv(env);

      expect(transport).toBeTypeOf("function");
      expect(createTransport).toHaveBeenCalledWith({
        host: "mailpit",
        port: 1025,
        secure: false,
        auth: undefined,
      });
    });

    it("enables TLS implicitly on port 465 and passes auth when provided", () => {
      buildMailTransportFromEnv({
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "465",
        SMTP_USER: "apikey",
        SMTP_PASSWORD: "secret",
      });

      expect(createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        auth: { user: "apikey", pass: "secret" },
      });
    });

    it("defaults to port 587 when SMTP_PORT is missing", () => {
      buildMailTransportFromEnv({ SMTP_HOST: "smtp.example.com" });
      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 587, secure: false }),
      );
    });

    it("injects the default sender and forwards the message fields", async () => {
      const transport = buildMailTransportFromEnv({ SMTP_HOST: "mailpit" });
      await transport?.({
        to: "coach@test",
        subject: "Hi",
        text: "body",
        html: "<p>body</p>",
      });

      expect(sendMail).toHaveBeenCalledWith({
        from: DEFAULT_MAIL_FROM,
        to: "coach@test",
        subject: "Hi",
        text: "body",
        html: "<p>body</p>",
      });
    });

    it("honours a custom MAIL_FROM", async () => {
      const transport = buildMailTransportFromEnv({
        SMTP_HOST: "mailpit",
        MAIL_FROM: "Ligue <ligue@nuffle.test>",
      });
      await transport?.({ to: "x@test", subject: "s", text: "t" });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: "Ligue <ligue@nuffle.test>" }),
      );
    });
  });

  describe("initMailTransportFromEnv", () => {
    it("does not wire a transport when SMTP_HOST is absent", () => {
      initMailTransportFromEnv({});
      expect(hasMailTransport()).toBe(false);
    });

    it("wires the transport onto the mailer when SMTP_HOST is present", () => {
      initMailTransportFromEnv({ SMTP_HOST: "mailpit", SMTP_PORT: "1025" });
      expect(hasMailTransport()).toBe(true);
    });
  });
});
