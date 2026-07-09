import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PermissionModal } from "./PermissionModal";
import { selectedOutcome } from "../session/permission";
import type { RequestPermissionRequest } from "@agentclientprotocol/sdk";

const request: RequestPermissionRequest = {
  sessionId: "s1",
  toolCall: { toolCallId: "t1", title: "Write to config.json" },
  options: [
    { optionId: "a1", name: "Allow once", kind: "allow_once" },
    { optionId: "a2", name: "Always allow", kind: "allow_always" },
    { optionId: "r1", name: "Reject", kind: "reject_once" },
  ],
};

describe("PermissionModal", () => {
  it("renders the tool title and every offered option", () => {
    const html = renderToStaticMarkup(<PermissionModal request={request} onResolve={() => {}} />);
    expect(html).toContain("Write to config.json");
    expect(html).toContain("Allow once");
    expect(html).toContain("Always allow");
    expect(html).toContain("Reject");
  });

  it("styles allow vs reject options distinctly", () => {
    const html = renderToStaticMarkup(<PermissionModal request={request} onResolve={() => {}} />);
    expect(html).toContain('class="allow"');
    expect(html).toContain('class="reject"');
  });

  it("maps an option id to a selected outcome", () => {
    // The click handler passes selectedOutcome(optionId); assert that mapping.
    const onResolve = vi.fn();
    expect(selectedOutcome("a2")).toEqual({
      outcome: { outcome: "selected", optionId: "a2" },
    });
    expect(onResolve).not.toHaveBeenCalled();
  });
});
