import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";

/**
 * DEV ONLY. Receives raw HTML captured from the authenticated SDU SIS in the
 * browser and saves it as a parser fixture on the developer's own machine.
 * Never enabled in production; fixtures are gitignored (contain personal data).
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 403, headers: CORS });
  }
  const name = (request.nextUrl.searchParams.get("name") ?? "capture").replace(/[^a-z0-9_-]/gi, "");
  const body = await request.text();
  const dir = path.join(process.cwd(), "services/sdu/sis/__fixtures__");
  const file = path.join(dir, `${name}.html`);
  await writeFile(file, body, "utf8");
  return NextResponse.json({ ok: true, name, bytes: body.length }, { headers: CORS });
}
