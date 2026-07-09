import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./relativeTime";

const now = Date.parse("2026-07-09T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it("shows 'just now' under a minute", () => {
    expect(formatRelativeTime(ago(30 * SEC), now)).toBe("just now");
  });
  it("shows minutes, hours, days, and weeks", () => {
    expect(formatRelativeTime(ago(5 * MIN), now)).toBe("5m ago");
    expect(formatRelativeTime(ago(3 * HOUR), now)).toBe("3h ago");
    expect(formatRelativeTime(ago(2 * DAY), now)).toBe("2d ago");
    expect(formatRelativeTime(ago(2 * 7 * DAY), now)).toBe("2w ago");
  });
  it("falls back to a date past ~5 weeks", () => {
    const old = formatRelativeTime(ago(60 * DAY), now);
    expect(old).not.toMatch(/ago|just now/);
  });
  it("returns empty string for an invalid timestamp", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
  it("never shows negative ages for a future timestamp", () => {
    expect(formatRelativeTime(new Date(now + 10 * MIN).toISOString(), now)).toBe("just now");
  });
});
