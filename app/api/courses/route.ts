import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withSession } from "@/lib/api/http";
import { searchCatalog } from "@/lib/catalog/search";
import { WEEKDAYS } from "@/lib/domain/types";
import { getEnv } from "@/lib/env";
import { getSduApi } from "@/services/sduApi";

const querySchema = z.object({
  q: z.string().max(100).default(""),
  department: z.string().max(10).optional(),
  instructor: z.string().max(120).optional(),
  days: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : []))
    .pipe(z.array(z.enum(WEEKDAYS))),
  time: z.enum(["ANY", "MORNING", "AFTERNOON", "EVENING"]).default("ANY"),
  open: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/**
 * GET /api/courses?q=css&department=CSS&instructor=…&days=MON,WED&time=MORNING&open=true
 * Multi-filter catalog search for the current term.
 */
export const GET = withSession(async (request) => {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError(400, "INVALID_QUERY", z.prettifyError(parsed.error));

  const { q, department, instructor, days, time, open } = parsed.data;
  const termCode = getEnv().SDU_CURRENT_TERM;
  const courses = await getSduApi().getCatalog(termCode);
  const results = searchCatalog(courses, {
    query: q,
    department: department ?? null,
    instructor: instructor ?? null,
    days,
    timeOfDay: time,
    openOnly: open,
  });

  return NextResponse.json({ termCode, total: results.length, results });
});
