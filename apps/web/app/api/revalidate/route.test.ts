import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { POST } from "./route";
import { revalidatePath, revalidateTag } from "next/cache";

function post(
  url: string,
  init?: { headers?: Record<string, string>; body?: string },
): Request {
  return new Request(url, {
    method: "POST",
    headers: init?.headers,
    body: init?.body,
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVALIDATE_SECRET = "s3cr3t";
  });

  it("401 sans secret", async () => {
    const res = await POST(post("http://x/api/revalidate?tag=rosters"));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("401 avec mauvais secret", async () => {
    const res = await POST(
      post("http://x/api/revalidate?tag=rosters", {
        headers: { "x-revalidate-secret": "nope" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("401 si aucun secret n'est configuré côté serveur", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(
      post("http://x/api/revalidate?tag=rosters", {
        headers: { "x-revalidate-secret": "anything" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("400 si ni path ni tag", async () => {
    const res = await POST(
      post("http://x/api/revalidate", {
        headers: { "x-revalidate-secret": "s3cr3t" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("revalide tags et paths depuis le corps JSON", async () => {
    const res = await POST(
      post("http://x/api/revalidate", {
        headers: {
          "x-revalidate-secret": "s3cr3t",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tags: ["rosters", "roster:underworld"],
          paths: ["/teams"],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("rosters");
    expect(revalidateTag).toHaveBeenCalledWith("roster:underworld");
    expect(revalidatePath).toHaveBeenCalledWith("/teams");
  });

  it("accepte secret + path via query params", async () => {
    const res = await POST(
      post("http://x/api/revalidate?secret=s3cr3t&path=/teams/underworld"),
    );
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/teams/underworld");
  });
});
