import { NextResponse } from "next/server";
import { withSession } from "@/lib/api/http";
import { getEnv } from "@/lib/env";
import { getSduApi } from "@/services/sduApi";

/**
 * GET /api/sections/availability?ids=F26-CSS225-01,F26-CSS311-02
 * Live seat counts, polled by the dashboard. Omit `ids` for the whole term.
 */
export const GET = withSession(async (request) => {
  const ids = request.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean);
  const sections = await getSduApi().getSeatAvailability(getEnv().SDU_CURRENT_TERM, ids?.slice(0, 200));
  return NextResponse.json(
    { asOf: new Date().toISOString(), sections },
    { headers: { "Cache-Control": "no-store" } },
  );
});
