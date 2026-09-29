import { describe, expect, it } from "vitest";
import { formatClock, formatMeeting, parseClock } from "./time";

describe("parseClock / formatClock", () => {
  it("parses HH:MM into minutes since midnight", () => {
    expect(parseClock("00:00")).toBe(0);
    expect(parseClock("10:30")).toBe(630);
    expect(parseClock("23:59")).toBe(1439);
  });

  it("formats minutes back into zero-padded HH:MM", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(630)).toBe("10:30");
    expect(formatClock(9 * 60)).toBe("09:00");
  });

  it("round-trips every half hour", () => {
    for (let m = 0; m < 1440; m += 30) expect(parseClock(formatClock(m))).toBe(m);
  });

  it("rejects malformed or out-of-range times", () => {
    expect(() => parseClock("25:00")).toThrow();
    expect(() => parseClock("10:75")).toThrow();
    expect(() => parseClock("abc")).toThrow();
    expect(() => parseClock("1030")).toThrow();
  });
});

describe("formatMeeting", () => {
  it("renders a day + time-range label", () => {
    expect(formatMeeting({ day: "MON", start: 600, end: 710 })).toBe("Mon 10:00–11:50");
    expect(formatMeeting({ day: "FRI", start: 13 * 60, end: 14 * 60 + 50 })).toBe("Fri 13:00–14:50");
  });
});
