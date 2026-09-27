import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withSession } from "@/lib/api/http";
import { ASSISTANT_SYSTEM, buildStudentContext } from "@/lib/ai/context";
import { generateReply, isGeminiConfigured, type ChatTurn } from "@/lib/ai/gemini";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(2000) }))
    .min(1)
    .max(30),
});

/** POST /api/chat — grounded AI answers about the signed-in student's courses. */
export const POST = withSession(async (request, session) => {
  if (!isGeminiConfigured()) {
    return jsonError(503, "AI_UNAVAILABLE", "The assistant isn't configured. Add a GEMINI_API_KEY to .env.local.");
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "INVALID_REQUEST", "Send a non-empty list of messages.");

  const context = await buildStudentContext(session.studentId);
  const system = `${ASSISTANT_SYSTEM}\n\n--- STUDENT CONTEXT ---\n${context}`;

  try {
    const reply = await generateReply(system, parsed.data.messages as ChatTurn[]);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[chat] gemini error:", (error as Error).message);
    return jsonError(502, "AI_ERROR", "The assistant is unavailable right now. Please try again.");
  }
});
