import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { parseCurriculum, parseProfile, parseTranscript } from "./parse";

/**
 * Fixtures mirror the real my.sdu.edu.kz table layouts (column order and the
 * blank spacer column in the curriculum), so these tests guard the scraping
 * logic against SIS markup drift.
 */

// ─── Transcript ──────────────────────────────────────────────────────────────

const TRANSCRIPT_HTML = `
<table>
  <tr><th>course code</th><th>course title</th><th>credit</th><th>ects</th><th>grade</th><th>letter grade</th><th>point</th><th>traditional</th></tr>
  <tr><td>2024 - 2025. 1</td></tr>
  <tr><td>CSS 105</td><td>Fundamentals of Programming</td><td>3</td><td>5</td><td>59</td><td>D+</td><td>1.33</td><td>Satisfactory</td></tr>
  <tr><td>INF 106</td><td>Information and Communication</td><td>3</td><td>5</td><td>62</td><td>C-</td><td>1.67</td><td>Satisfactory</td></tr>
  <tr><td>MDE 002</td><td>General English</td><td>5</td><td>6</td><td>70</td><td>P</td><td></td><td>Pass</td></tr>
  <tr><td>MAT 137</td><td>Mathematics</td><td>3</td><td>5</td><td>* 0</td><td>NP</td><td></td><td>Not pass</td></tr>
  <tr><td></td><td></td><td>14</td><td>21</td><td></td><td>SA : 63</td><td>SPA : 1.9</td><td>GPA : 1.90</td></tr>
  <tr><td>2025 - 2026. 1</td></tr>
  <tr><td>MDE 003</td><td>Transferred English</td><td>5</td><td>6</td><td>** 80</td><td>P</td><td></td><td>Pass</td></tr>
  <tr><td>INF 313</td><td>Computer networks 1</td><td>3</td><td>5</td><td></td><td>IP</td><td></td><td>In progress</td></tr>
  <tr><td></td><td></td><td>8</td><td>11</td><td></td><td>SA : 80</td><td>SPA : 3</td><td>GPA : 2.30</td></tr>
  <tr><td>Grand GPA : 2.30</td></tr>
</table>`;

describe("parseTranscript", () => {
  const t = parseTranscript(parse(TRANSCRIPT_HTML));

  it("extracts every course row across terms", () => {
    expect(t.entries.map((e) => e.courseCode)).toEqual([
      "CSS 105",
      "INF 106",
      "MDE 002",
      "MAT 137",
      "MDE 003",
      "INF 313",
    ]);
  });

  it("maps letter grades to statuses (P=passed, NP=failed, IP=in progress, ** = transferred)", () => {
    const by = Object.fromEntries(t.entries.map((e) => [e.courseCode, e.status]));
    expect(by["CSS 105"]).toBe("PASSED");
    expect(by["MDE 002"]).toBe("PASSED");
    expect(by["MAT 137"]).toBe("FAILED");
    expect(by["INF 313"]).toBe("IN_PROGRESS");
    expect(by["MDE 003"]).toBe("TRANSFERRED");
  });

  it("reads the grand GPA and counts only earned (passed/transferred) credits", () => {
    expect(t.cumulativeGpa).toBe(2.3);
    // ECTS: CSS105 5 + INF106 5 + MDE002 6 + MDE003 6 (transferred) = 22; NP and IP excluded.
    expect(t.completedCredits).toBe(22);
  });

  it("normalises SIS term codes to the app's season codes", () => {
    const css105 = t.entries.find((e) => e.courseCode === "CSS 105");
    expect(css105?.termCode).toBe("2024-FALL");
  });
});

// ─── Curriculum ──────────────────────────────────────────────────────────────

const row = (n: string, code: string, name: string, cr: string, ects: string, grade: string, status: string) =>
  `<tr><td>${n}</td><td>${code}</td><td>${name}</td><td></td><td>2</td><td>1+0</td><td>${cr}</td><td>${ects}</td><td>${grade}</td><td></td><td>${status}</td><td>EN</td></tr>`;

const CURRICULUM_HTML = `
<table>
  <tr><th>№</th><th>course code</th><th>name</th><th></th><th>teor</th><th>pr</th><th>cr</th><th>ects</th><th>grade</th><th>requisites</th><th>status</th><th>Syllabus</th></tr>
  ${row("1", "CSS 105", "Fundamentals", "3", "5", "D+", "")}
  ${row("2", "INF 313", "Computer networks", "3", "5", "IP", "")}
  ${row("3", "MDE 172", "Philosophy", "3", "5", "", "Available")}
  ${row("4", "CSS 410", "Research tools", "3", "5", "", "Available")}
  ${row("5", "INF 420", "Senior Project", "5", "10", "", "")}
</table>
<table>
  <tr><th>№</th><th>course code</th><th>name</th><th>teor</th><th>pr</th><th>cr</th><th>ects</th><th>term</th><th>Syllabus</th></tr>
  <tr><td>1</td><td>INF 999</td><td>Elective Catalogue Course</td><td>2</td><td>1+0</td><td>3</td><td>5</td><td>6</td><td>EN</td></tr>
</table>`;

describe("parseCurriculum", () => {
  const items = parseCurriculum(parse(CURRICULUM_HTML));
  const byCode = Object.fromEntries(items.map((c) => [c.code, c]));

  it("reads the grade/status columns at the correct offsets (regression guard)", () => {
    expect(byCode["CSS 105"].standing).toBe("done");
    expect(byCode["CSS 105"].grade).toBe("D+");
    expect(byCode["CSS 105"].credits).toBe(3);
    expect(byCode["CSS 105"].ects).toBe(5);
  });

  it("classifies in-progress, available and planned courses", () => {
    expect(byCode["INF 313"].standing).toBe("in_progress");
    expect(byCode["MDE 172"].standing).toBe("available");
    expect(byCode["CSS 410"].standing).toBe("available");
    expect(byCode["INF 420"].standing).toBe("planned");
  });

  it("ignores the elective catalogue table (no requisites/status columns)", () => {
    expect(byCode["INF 999"]).toBeUndefined();
  });
});

// ─── Profile ─────────────────────────────────────────────────────────────────

describe("parseProfile", () => {
  it("pulls labelled fields out of the SIS header block", () => {
    const text =
      "Name Surname : Zhantore Armanuly Advisor : Mahabaeva Aruna Major Program : Information Systems Last Login Date : 20-SEP-26";
    const p = parseProfile(text);
    expect(p.fullName).toBe("Zhantore Armanuly");
    expect(p.advisorName).toBe("Mahabaeva Aruna");
  });

  it("reads the student number from the transcript header", () => {
    const p = parseProfile("Student № : 240107018 Student Name : Zhantore Armanuly Level : Bachelor");
    expect(p.studentId).toBe("240107018");
    expect(p.level).toBe("Bachelor");
  });
});
