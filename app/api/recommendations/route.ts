import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withSession } from "@/lib/api/http";
import { generateReply, isGeminiConfigured } from "@/lib/ai/gemini";

const schema = z.object({
  profile: z.object({
    fullName: z.string(),
    program: z.string(),
    gpa: z.number(),
    completedCredits: z.number(),
    requiredCredits: z.number(),
    creditLimit: z.number(),
  }),
  candidates: z
    .array(z.object({ code: z.string(), title: z.string(), credits: z.number(), level: z.number(), reasons: z.array(z.string()) }))
    .max(60),
  recentlyPassed: z.array(z.string()).max(80),
});

/**
 * POST /api/recommendations — an AI rationale over the deterministic eligible
 * list (computed on the client with the rules engine). The model prioritises
 * and explains but only ever picks from `candidates`, never invents courses.
 */
export const POST = withSession(async (request) => {
  if (!isGeminiConfigured()) {
    return jsonError(503, "AI_UNAVAILABLE", "The recommender isn't configured. Add a GEMINI_API_KEY to .env.local.");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "INVALID_REQUEST", "Bad recommendation request.");

  const { profile, candidates, recentlyPassed } = parsed.data;
  if (candidates.length === 0) {
    return NextResponse.json({ summary: "You've completed everything you're currently eligible for — nice work!" });
  }

  const system = `You are an academic advisor at Suleyman Demirel University. Recommend which of the
ELIGIBLE courses the student should take THIS semester, up to their credit limit. Prioritise retakes,
foundational and prerequisite-unlocking courses, and a balanced load. When the student is far through
the degree and the eligible list is mostly 300/400-level, treat those as electives: suggest a coherent
set that fits one specialisation track rather than a scattered mix, and say which track it leans to.
You may ONLY choose from the eligible list — never invent a course. Be concise: 2-3 sentences of overall
advice, then a short prioritised list "CODE — one-line reason". Answer in the student's likely language
(English by default).`;

  const context = [
    `Student: ${profile.fullName}, program ${profile.program}, GPA ${profile.gpa.toFixed(2)}.`,
    `Completed ${profile.completedCredits}/${profile.requiredCredits} ECTS. Credit limit this term: ${profile.creditLimit} ECTS.`,
    recentlyPassed.length ? `Recently passed: ${recentlyPassed.slice(0, 30).join(", ")}.` : "",
    "",
    "ELIGIBLE COURSES (choose only from these):",
    ...candidates.map(
      (c) => `- ${c.code} — ${c.title} (${c.credits} ECTS, level ${c.level})${c.reasons.length ? ` [${c.reasons.join("; ")}]` : ""}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const summary = await generateReply(system, [{ role: "user", text: context }]);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[recommendations] gemini error:", (error as Error).message);
    return jsonError(502, "AI_ERROR", "Couldn't generate recommendations right now.");
  }
});
