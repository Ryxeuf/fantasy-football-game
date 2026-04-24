import { describe, it, expect } from "vitest";
import { updateProfileSchema } from "./auth.schemas";

describe("Rule: updateProfileSchema discordUserId", () => {
  it("accepts a valid 18-digit Discord snowflake", () => {
    const result = updateProfileSchema.safeParse({
      discordUserId: "012345678901234567",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid 17-digit Discord snowflake (legacy minimum)", () => {
    const result = updateProfileSchema.safeParse({
      discordUserId: "12345678901234567",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid 20-digit Discord snowflake (current maximum)", () => {
    const result = updateProfileSchema.safeParse({
      discordUserId: "12345678901234567890",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string (treated as erasure by the route)", () => {
    const result = updateProfileSchema.safeParse({ discordUserId: "" });
    expect(result.success).toBe(true);
  });

  it("accepts null and undefined", () => {
    expect(
      updateProfileSchema.safeParse({ discordUserId: null }).success,
    ).toBe(true);
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it("rejects non-numeric input", () => {
    expect(
      updateProfileSchema.safeParse({ discordUserId: "abcdef0123456789" })
        .success,
    ).toBe(false);
  });

  it("rejects too-short input (< 17 digits)", () => {
    expect(
      updateProfileSchema.safeParse({ discordUserId: "1234567890123456" })
        .success,
    ).toBe(false);
  });

  it("rejects too-long input (> 20 digits)", () => {
    expect(
      updateProfileSchema.safeParse({ discordUserId: "123456789012345678901" })
        .success,
    ).toBe(false);
  });

  it("does not affect other fields when discordUserId is omitted", () => {
    const result = updateProfileSchema.safeParse({
      email: "user@example.com",
      coachName: "Coach",
    });
    expect(result.success).toBe(true);
  });
});
