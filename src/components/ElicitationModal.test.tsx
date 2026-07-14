import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ElicitationModal, type FormElicitationRequest } from "./ElicitationModal";

const request: FormElicitationRequest = {
  mode: "form",
  sessionId: "session-1",
  message: "Which option should Claude use?",
  requestedSchema: {
    type: "object",
    properties: {
      question_0: {
        type: "string",
        title: "Approach",
        oneOf: [{ const: "Fast", title: "Fast" }, { const: "Safe", title: "Safe" }],
      },
      question_0_custom: { type: "string", title: "Other" },
    },
  },
};

describe("ElicitationModal", () => {
  it("renders Claude questions as selectable answers with an Other field", () => {
    const html = renderToStaticMarkup(<ElicitationModal request={request} onResolve={() => {}} />);
    expect(html).toContain("Claude needs your input");
    expect(html).toContain("Which option should Claude use?");
    expect(html).toContain("Fast");
    expect(html).toContain("Safe");
    expect(html).toContain("Submit answers");
  });
});
