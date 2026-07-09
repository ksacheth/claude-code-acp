import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolCall } from "./ToolCall";
import { DiffView } from "./DiffView";
import type { ToolCallView } from "../session/transcript";

const baseCall: ToolCallView = {
  id: "t1",
  title: "Edit src/app.ts",
  kind: "edit",
  status: "completed",
  content: [],
};

describe("ToolCall", () => {
  it("renders title and status", () => {
    const html = renderToStaticMarkup(<ToolCall call={baseCall} />);
    expect(html).toContain("Edit src/app.ts");
    expect(html).toContain("completed");
    expect(html).toContain("tool-completed");
  });

  it("renders a diff content block", () => {
    const call: ToolCallView = {
      ...baseCall,
      content: [{ type: "diff", path: "a.ts", oldText: "x\ny", newText: "x\nz" }],
    };
    const html = renderToStaticMarkup(<ToolCall call={call} />);
    expect(html).toContain("a.ts");
    expect(html).toContain("diff-remove");
    expect(html).toContain("diff-add");
  });

  it("renders raw input/output blocks when present", () => {
    const call: ToolCallView = { ...baseCall, rawInput: { path: "a.ts" }, rawOutput: "ok" };
    const html = renderToStaticMarkup(<ToolCall call={call} />);
    expect(html).toContain("input");
    expect(html).toContain("output");
    expect(html).toContain("a.ts");
  });
});

describe("DiffView", () => {
  it("shows the path and a +added/−removed stat", () => {
    const html = renderToStaticMarkup(<DiffView path="f.ts" oldText={"a\nb"} newText={"a\nc\nd"} />);
    expect(html).toContain("f.ts");
    expect(html).toContain("+2");
    expect(html).toContain("−1");
  });
});
