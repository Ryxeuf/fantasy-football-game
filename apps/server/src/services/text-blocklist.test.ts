import { describe, expect, it } from "vitest";
import { detectBlocklist } from "./text-blocklist";
import { detectBlocklist as gazetteDetect } from "./pro-gazette-comments";

describe("detectBlocklist (partagée)", () => {
  it("laisse passer un texte ordinaire", () => {
    expect(detectBlocklist("Quel blitz au tour 7 !")).toBeNull();
  });

  it("reconnaît un motif malgré les séparateurs et la casse", () => {
    expect(detectBlocklist("you F-A-G-G-O-T")).toBe("slur-2");
  });

  it("respecte la frontière de mot", () => {
    expect(detectBlocklist("retardation event")).toBeNull();
  });

  it("la Gazette ré-exporte la même fonction", () => {
    expect(gazetteDetect).toBe(detectBlocklist);
  });
});
