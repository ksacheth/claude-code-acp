import { describe, it, expect } from "vitest";
import { computeLineDiff, diffStat } from "./diff";

describe("computeLineDiff", () => {
  it("treats a null oldText (new file) as all additions", () => {
    const lines = computeLineDiff(null, "a\nb");
    expect(lines).toEqual([
      { type: "add", text: "a" },
      { type: "add", text: "b" },
    ]);
  });

  it("keeps unchanged lines as context", () => {
    const lines = computeLineDiff("a\nb\nc", "a\nb\nc");
    expect(lines.every((l) => l.type === "context")).toBe(true);
    expect(lines).toHaveLength(3);
  });

  it("marks a changed middle line as remove then add, keeping context around it", () => {
    const lines = computeLineDiff("a\nb\nc", "a\nB\nc");
    expect(lines).toEqual([
      { type: "context", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "B" },
      { type: "context", text: "c" },
    ]);
  });

  it("handles a pure insertion", () => {
    const lines = computeLineDiff("a\nc", "a\nb\nc");
    expect(lines).toEqual([
      { type: "context", text: "a" },
      { type: "add", text: "b" },
      { type: "context", text: "c" },
    ]);
  });

  it("handles a pure deletion", () => {
    const lines = computeLineDiff("a\nb\nc", "a\nc");
    expect(lines).toEqual([
      { type: "context", text: "a" },
      { type: "remove", text: "b" },
      { type: "context", text: "c" },
    ]);
  });
});

describe("diffStat", () => {
  it("counts added and removed lines", () => {
    const stat = diffStat(computeLineDiff("a\nb\nc", "a\nB\nc\nd"));
    expect(stat).toEqual({ added: 2, removed: 1 });
  });
});
