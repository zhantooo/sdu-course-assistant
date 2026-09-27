import { describe, expect, it } from "vitest";
import { buildMockSections } from "@/services/sdu/fixtures";
import { toCourses } from "@/services/sdu/mappers";
import { EMPTY_FILTERS, searchCatalog } from "./search";

const catalog = toCourses(buildMockSections());
const codes = (filters: Partial<typeof EMPTY_FILTERS>) =>
  searchCatalog(catalog, { ...EMPTY_FILTERS, ...filters }).map((c) => c.code);

describe("searchCatalog", () => {
  it("matches course codes regardless of spacing and case", () => {
    expect(codes({ query: "css311" })).toEqual(["CSS 311"]);
    expect(codes({ query: "CSS 311" })).toEqual(["CSS 311"]);
  });

  it("matches titles and instructors", () => {
    expect(codes({ query: "networks" })).toEqual(["CSS 342"]);
    const byInstructor = searchCatalog(catalog, { ...EMPTY_FILTERS, query: "omarov" });
    expect(byInstructor.map((c) => c.code)).toEqual(["CSS 311", "CSS 410"]);
    // Only Omarov's section of CSS 311 is kept.
    expect(byInstructor[0].sections.map((s) => s.sectionNumber)).toEqual(["02"]);
  });

  it("filters by department", () => {
    expect(codes({ department: "MAT" })).toEqual(["MAT 201", "MAT 250"]);
  });

  it("combines day and time-of-day on the same meeting", () => {
    // Friday evening: only sections with a Friday meeting starting ≥ 17:00.
    expect(codes({ days: ["FRI"], timeOfDay: "EVENING" })).toEqual(["CSS 410"]);
  });

  it("drops full sections when openOnly is set", () => {
    const result = searchCatalog(catalog, { ...EMPTY_FILTERS, query: "CSS 311", openOnly: true });
    expect(result[0].sections.map((s) => s.sectionNumber)).toEqual(["01"]);
  });
});
