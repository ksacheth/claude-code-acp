import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PlanChecklist } from "./PlanChecklist";
import type { PlanEntry } from "@agentclientprotocol/sdk";

const entries: PlanEntry[] = [
  { content: "Read the config", priority: "high", status: "completed" },
  { content: "Apply the change", priority: "high", status: "in_progress" },
  { content: "Run the tests", priority: "medium", status: "pending" },
];

describe("PlanChecklist", () => {
  it("lists every entry with a completed count", () => {
    const html = renderToStaticMarkup(<PlanChecklist entries={entries} />);
    expect(html).toContain("Read the config");
    expect(html).toContain("Apply the change");
    expect(html).toContain("Run the tests");
    expect(html).toContain("1/3");
  });

  it("marks entries by status", () => {
    const html = renderToStaticMarkup(<PlanChecklist entries={entries} />);
    expect(html).toContain("plan-completed");
    expect(html).toContain("plan-in_progress");
    expect(html).toContain("plan-pending");
  });

  it("renders nothing for an empty plan", () => {
    expect(renderToStaticMarkup(<PlanChecklist entries={[]} />)).toBe("");
  });
});
