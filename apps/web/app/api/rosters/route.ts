import { NextRequest, NextResponse } from "next/server";
import {
  ServerApiError,
  fetchServerJson,
  getServerApiBase,
} from "../../lib/serverApi";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const url = `${getServerApiBase()}/api/rosters${
    queryString ? `?${queryString}` : ""
  }`;

  try {
    const data = await fetchServerJson<unknown>(url);
    if (data === null) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[api/rosters proxy]", err);
    const status = err instanceof ServerApiError && err.status ? err.status : 503;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upstream error" },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
