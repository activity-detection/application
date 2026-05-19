import { describe, expect, it } from "vitest";

import { formatSecondsAsClock, parseIsoDurationToSeconds } from "@/utils/duration";

describe("parseIsoDurationToSeconds", () => {
  it("parses the duration formats produced by the backend", () => {
    expect(parseIsoDurationToSeconds("PT0S")).toBe(0);
    expect(parseIsoDurationToSeconds("PT1M5.5S")).toBe(65.5);
    expect(parseIsoDurationToSeconds("PT1H2M3S")).toBe(3723);
    expect(parseIsoDurationToSeconds("P1DT1H")).toBe(90000);
    expect(parseIsoDurationToSeconds("-PT30S")).toBe(-30);
  });

  it("returns null for unsupported or empty input", () => {
    expect(parseIsoDurationToSeconds(undefined)).toBeNull();
    expect(parseIsoDurationToSeconds(null)).toBeNull();
    expect(parseIsoDurationToSeconds("")).toBeNull();
    expect(parseIsoDurationToSeconds("PT1W")).toBeNull();
  });
});

describe("formatSecondsAsClock", () => {
  it("formats sub-hour durations as M:SS", () => {
    expect(formatSecondsAsClock(0)).toBe("0:00");
    expect(formatSecondsAsClock(65.9)).toBe("1:05");
  });

  it("formats hour-long durations as H:MM:SS", () => {
    expect(formatSecondsAsClock(3723)).toBe("1:02:03");
  });

  it("clamps invalid values to 0:00", () => {
    expect(formatSecondsAsClock(-1)).toBe("0:00");
    expect(formatSecondsAsClock(Number.NaN)).toBe("0:00");
  });
});
