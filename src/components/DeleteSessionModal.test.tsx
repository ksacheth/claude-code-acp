import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { emptyTranscript } from "../session/transcript";
import { DeleteSessionModal } from "./DeleteSessionModal";

describe("DeleteSessionModal", () => {
  it("identifies the session and requires explicit confirmation", () => {
    const html = renderToStaticMarkup(
      <DeleteSessionModal
        session={{ id: "A", title: "alpha", cwd: "/repo/alpha", transcript: emptyTranscript }}
        deleting={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain("Delete session?");
    expect(html).toContain("alpha");
    expect(html).toContain("/repo/alpha");
    expect(html).toContain("Delete");
    expect(html).toContain("Cancel");
  });
});
