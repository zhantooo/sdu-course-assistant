/**
 * Parsers that turn SDU SIS HTML into structured data. Validated against the
 * live `?mod=transkript` and `?mod=course_struct` pages. Column layouts follow
 * what the SIS renders; if the SIS changes, only this file needs updating.
 */
import { type HTMLElement } from "node-html-parser";
import type { TranscriptEntry, TranscriptStatus } from "@/lib/domain/types";

const COURSE_CODE = /^[A-Z]{2,4}\s?\d{2,3}[A-Z]?$/;

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function cells(row: HTMLElement): string[] {
  return row.querySelectorAll("td, th").map((c) => norm(c.text));
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface SisProfile {
  studentId: string;
  fullName: string;
  faculty: string;
  program: string;
  specialty: string;
  level: string;
  language: string;
  advisorName: string | null;
}

/** Reads the labelled header block present on most SIS pages. */
export function parseProfile(pageText: string): Partial<SisProfile> {
  const text = norm(pageText);
  const grab = (label: RegExp) => label.exec(text)?.[1]?.trim() || undefined;
  return {
    studentId: grab(/Student\s*№\s*:\s*(\d{6,})/),
    fullName: grab(/(?:Student Name|Name Surname)\s*:\s*([^|:]+?)(?:\s{2,}|Advisor|Major|Level|$)/),
    advisorName: grab(/Advisor\s*:\s*([^|:]+?)(?:\s{2,}|Major|Last Login|$)/) ?? null,
    program: grab(/Major\s*[Pp]rogram\s*:?\s*([^|:]+?)(?:\s{2,}|Last Login|faculty|$)/),
    faculty: grab(/faculty\s*:\s*([^|:]+?)(?:\s{2,}|language|$)/),
    specialty: grab(/specialty\s*:\s*([^|:]+?)(?:\s{2,}|graduation|$)/),
    level: grab(/Level\s*:\s*([^|:]+?)(?:\s{2,}|Entry|$)/),
    language: grab(/language\s*:\s*([^|:]+?)(?:\s{2,}|specialty|$)/),
  };
}

// ─── Transcript ──────────────────────────────────────────────────────────────

function transcriptStatus(letter: string, pctRaw: string): TranscriptStatus {
  const l = letter.toUpperCase();
  if (l === "IP") return "IN_PROGRESS";
  if (l === "W" || l === "AW") return "WITHDRAWN";
  if (l === "F" || l === "FX" || l === "NP") return "FAILED";
  if (/\*\*/.test(pctRaw)) return "TRANSFERRED"; // "** 80" = transferred credit
  return "PASSED";
}

const GRADE_ORDER: Record<string, number> = {
  A: 4, "A-": 3.67, "B+": 3.33, B: 3, "B-": 2.67, "C+": 2.33, C: 2, "C-": 1.67, "D+": 1.33, D: 1, FX: 0, F: 0,
};

export interface ParsedTranscript {
  entries: TranscriptEntry[];
  cumulativeGpa: number;
  completedCredits: number;
}

export function parseTranscript(doc: HTMLElement): ParsedTranscript {
  const table = doc
    .querySelectorAll("table")
    .find((t) => /course code/i.test(t.text) && /letter grade/i.test(t.text));
  if (!table) throw new Error("Transcript table not found");

  const entries: TranscriptEntry[] = [];
  const seen = new Set<string>();
  let term = "";

  for (const row of table.querySelectorAll("tr")) {
    const c = cells(row);
    const joined = c.join(" ");

    const termMatch = joined.match(/(20\d\d)\s*-\s*(20\d\d)\.\s*(\d)/);
    if (termMatch && c.filter(Boolean).length <= 3) {
      term = `${termMatch[1]}-${termMatch[2]}.${termMatch[3]}`;
      continue;
    }

    const i = c.findIndex((x) => COURSE_CODE.test(x));
    if (i < 0) continue;
    const code = c[i].replace(/\s+/, " ");
    const key = `${term}:${code}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const title = c[i + 1] ?? code;
    const ects = Number(c[i + 3]) || 0;
    const pctRaw = c[i + 4] ?? "";
    const letter = c[i + 5] ?? "";
    const point = c[i + 6];
    const status = transcriptStatus(letter, pctRaw);

    entries.push({
      courseCode: code,
      courseTitle: title,
      credits: ects,
      termCode: normalizeTermCode(term),
      letterGrade: letter || null,
      gradePoints: point && !Number.isNaN(Number(point)) ? Number(point) : (GRADE_ORDER[letter] ?? null),
      status,
    });
  }

  const grand = table.text.match(/Grand GPA\s*:\s*([\d.]+)/);
  const cumulativeGpa = grand ? Number(grand[1]) : gpaFrom(entries);
  const completedCredits = entries
    .filter((e) => e.status === "PASSED" || e.status === "TRANSFERRED")
    .reduce((sum, e) => sum + e.credits, 0);

  return { entries, cumulativeGpa, completedCredits };
}

/** "2024-2025.1" (fall) → "2024-FALL" to match the app's term codes. */
function normalizeTermCode(sisTerm: string): string {
  const m = sisTerm.match(/(\d{4})-(\d{4})\.(\d)/);
  if (!m) return sisTerm;
  const [, y1, y2, part] = m;
  if (part === "1") return `${y1}-FALL`;
  if (part === "2") return `${y2}-SPRING`;
  return `${y2}-SUMMER`;
}

function gpaFrom(entries: TranscriptEntry[]): number {
  const graded = entries.filter((e) => e.gradePoints !== null && e.status !== "IN_PROGRESS" && e.letterGrade !== "P");
  const qp = graded.reduce((s, e) => s + (e.gradePoints ?? 0) * e.credits, 0);
  const cr = graded.reduce((s, e) => s + e.credits, 0);
  return cr ? Math.round((qp / cr) * 100) / 100 : 0;
}

// ─── Curriculum (completed vs open-to-take) ─────────────────────────────────

export interface CurriculumCourse {
  code: string;
  title: string;
  credits: number;
  ects: number;
  /** "done" = has a grade, "available" = can be taken now, "in_progress". */
  standing: "done" | "available" | "in_progress" | "planned";
  grade: string | null;
}

/**
 * Parses `?mod=course_struct`. The page shows the degree plan by semester plus
 * large elective catalogues. We keep only real (non-placeholder) course rows
 * and dedupe by code, preferring a "done" record over a "planned" one.
 */
export function parseCurriculum(doc: HTMLElement): CurriculumCourse[] {
  const byCode = new Map<string, CurriculumCourse>();

  for (const table of doc.querySelectorAll("table")) {
    const head = table.text;
    const isPlan = /teor/i.test(head) && /requisites/i.test(head) && /status/i.test(head);
    if (!isPlan) continue;

    for (const row of table.querySelectorAll("tr")) {
      const c = cells(row);
      const i = c.findIndex((x) => COURSE_CODE.test(x));
      if (i < 0) continue;
      const code = c[i];
      const rest = c.slice(i).join(" ");
      // Column layout relative to the course-code cell (SIS `course_struct`):
      // code(i) | name(i+1) | (blank) | teor(i+3) | pr(i+4) | cr(i+5) | ects(i+6) |
      // grade(i+7) | requisites(i+8) | status(i+9) | Syllabus.
      const grade = c[i + 7] ?? "";
      const statusCell = c[i + 9] ?? "";

      let standing: CurriculumCourse["standing"] = "planned";
      if (/available/i.test(statusCell) || /\bAvailable\b/.test(rest)) standing = "available";
      else if (grade === "IP") standing = "in_progress";
      else if (/^[A-DFPWX][+-]?$|^FX$|^NP$|^AW$/.test(grade)) standing = "done";

      const rec: CurriculumCourse = {
        code,
        title: c[i + 1] ?? code,
        credits: Number(c[i + 5]) || 0,
        ects: Number(c[i + 6]) || 0,
        standing,
        grade: standing === "done" ? grade : null,
      };
      const prev = byCode.get(code);
      // Prefer the most informative standing: done > in_progress > available > planned.
      const rank = { done: 3, in_progress: 2, available: 1, planned: 0 } as const;
      if (!prev || rank[rec.standing] > rank[prev.standing]) byCode.set(code, rec);
    }
  }

  return [...byCode.values()];
}
