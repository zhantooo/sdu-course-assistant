/**
 * SisClient — logs into the SDU SIS and reads the signed-in student's data.
 *
 * Login is a 3-step PHP flow, discovered live from my.sdu.edu.kz:
 *   1. GET /                  → PHPSESSID cookie + login form (hidden `modstring`)
 *   2. POST loginAuth.php     → correct creds redirect to verification.php (emails a code)
 *   3. POST verification form → the code; success lands on index.php?verified=1
 * The verification form's field names are read at runtime, so nothing is hard-coded.
 *
 * SAFETY: reads only. Never posts to the registration write endpoints.
 */
import type { HTMLElement } from "node-html-parser";
import type { StudentProfile, Transcript } from "@/lib/domain/types";
import { readForm, SisHttp } from "./http";
import { parseCurriculum, parseProfile, parseTranscript, type CurriculumCourse } from "./parse";

export type LoginResult =
  | { step: "authenticated" }
  | { step: "verify"; message: string }
  | { step: "failed"; message: string };

/** The SIS embeds this marker in AJAX responses when the PHP session has expired. */
const SESSION_EXPIRED_MARKER = "#!3%6$#@458#!2*/-&2@";

/** Thrown by data reads when the live SIS session has ended (timeout or sign-out elsewhere). */
export class SisSessionExpiredError extends Error {
  readonly isSisSessionExpired = true;
  constructor() {
    super("SDU session expired");
    this.name = "SisSessionExpiredError";
  }
}

export function isSisSessionExpired(error: unknown): boolean {
  return (
    error instanceof SisSessionExpiredError ||
    (typeof error === "object" && error !== null && (error as { isSisSessionExpired?: boolean }).isSisSessionExpired === true)
  );
}

export class SisClient {
  readonly http: SisHttp;
  /** The student number used to sign in — the SIS pages don't always echo it. */
  private studentNumber = "";

  constructor(options: { baseUrl?: string; cookies?: Record<string, string> } = {}) {
    this.http = new SisHttp(options);
  }

  get cookies(): Record<string, string> {
    return this.http.jar.toJSON();
  }

  get studentId(): string {
    return this.studentNumber;
  }

  /** Best-effort display name; never throws, so login is not blocked by a parse hiccup. */
  async getDisplayName(): Promise<string> {
    try {
      const page = await this.http.get("/index.php?mod=course_reg");
      return parseProfile(page.doc.text).fullName ?? "SDU Student";
    } catch {
      return "SDU Student";
    }
  }

  /** Steps 1–2. Returns "verify" when the SIS asks for the emailed 2-factor code. */
  async login(username: string, password: string): Promise<LoginResult> {
    this.studentNumber = username.trim();
    const loginPage = await this.http.get("/");
    const form = readForm(loginPage.doc, (f) => /loginAuth\.php/i.test(f.getAttribute("action") ?? ""));
    const modstring = form?.fields.modstring ?? "";

    const posted = await this.http.postForm(
      "/loginAuth.php",
      { username, password, modstring, LogIn: " Log in " },
      `${this.http.baseUrl}/`,
    );

    // Follow the outcome (302 → Location, or an inline page).
    const landing = posted.location ? await this.http.get(posted.location) : posted;
    const url = (landing.location ?? landing.url ?? "").toLowerCase();
    const html = landing.html.toLowerCase();

    if (this.looksAuthenticated(landing.html)) return { step: "authenticated" };
    if (url.includes("verification") || html.includes("verification") || this.looksLikeOtp(landing.doc)) {
      return { step: "verify", message: "A verification code was sent to your SDU email." };
    }
    return { step: "failed", message: "SDU didn't accept that student number or password." };
  }

  /** Step 3. Submits the emailed code to the verification form. */
  async verify(code: string): Promise<LoginResult> {
    const page = await this.http.get("/verification.php");
    const form = readForm(page.doc);
    if (!form || !form.textField) {
      // Some accounts skip 2FA; if we are already in, accept it.
      if (this.looksAuthenticated(page.html)) return { step: "authenticated" };
      return { step: "failed", message: "Verification form not found. Please restart sign-in." };
    }

    const fields = { ...form.fields, [form.textField]: code.trim() };
    const action = form.action || "/verification.php";
    const posted = await this.http.postForm(action, fields, `${this.http.baseUrl}/verification.php`);
    const landing = posted.location ? await this.http.get(posted.location) : posted;

    if (this.looksAuthenticated(landing.html) || this.looksAuthenticated((await this.home()).html)) {
      return { step: "authenticated" };
    }
    return { step: "failed", message: "That verification code was not accepted." };
  }

  private async home() {
    return this.http.get("/index.php");
  }

  private looksAuthenticated(html: string): boolean {
    const h = html.toLowerCase();
    return (h.includes("logout.php") || h.includes("sign out")) && !h.includes('id="password"');
  }

  private looksLikeOtp(doc: HTMLElement): boolean {
    const form = readForm(doc);
    // An OTP form has a text field but no password field.
    return !!form && !!form.textField && !form.passwordField;
  }

  // ── Data (reads) ──

  /** Throws SisSessionExpiredError when a fetched page is the expiry marker or the login form. */
  private ensureAlive(html: string): void {
    if (html.includes(SESSION_EXPIRED_MARKER) || /id=["']password["']/i.test(html)) {
      throw new SisSessionExpiredError();
    }
  }

  async getProfile(): Promise<StudentProfile> {
    const page = await this.http.get("/index.php?mod=course_reg");
    this.ensureAlive(page.html);
    const p = parseProfile(page.doc.text);
    const transcript = await this.getTranscript();
    // The signed-in student number is the most reliable id; SIS pages vary.
    const studentId = this.studentNumber || p.studentId || "";
    return {
      studentId,
      fullName: p.fullName ?? "SDU Student",
      email: studentId ? `${studentId}@stu.sdu.edu.kz` : "",
      faculty: p.faculty ?? "",
      departmentCode: (transcript.entries[0]?.courseCode ?? "INF").split(" ")[0],
      program: { code: p.program ?? "", name: p.program ?? p.specialty ?? "Program" },
      studyYear: estimateYear(transcript),
      gpa: transcript.cumulativeGpa,
      completedCredits: transcript.completedCredits,
      requiredCredits: 240,
      academicStatus: "ACTIVE",
      advisor: p.advisorName ? { staffId: "", fullName: p.advisorName, email: "" } : null,
    };
  }

  async getTranscript(): Promise<Transcript> {
    const page = await this.http.get("/index.php?mod=transkript");
    this.ensureAlive(page.html);
    const parsed = parseTranscript(page.doc);
    return {
      studentId: "",
      completedCredits: parsed.completedCredits,
      cumulativeGpa: parsed.cumulativeGpa,
      entries: parsed.entries,
    };
  }

  async getCurriculum(): Promise<CurriculumCourse[]> {
    const page = await this.http.get("/index.php?mod=course_struct");
    this.ensureAlive(page.html);
    return parseCurriculum(page.doc);
  }
}

/** Rough study year from how many distinct academic years appear in the transcript. */
function estimateYear(transcript: Transcript): number {
  const years = new Set(transcript.entries.map((e) => e.termCode.split("-")[0]));
  return Math.min(Math.max(years.size, 1), 6);
}
