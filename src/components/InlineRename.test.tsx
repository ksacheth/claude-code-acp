import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { InlineRename } from "./InlineRename";

describe("InlineRename", () => {
  it("seeds the field with the current label and labels it for assistive tech", () => {
    const html = renderToStaticMarkup(
      <InlineRename
        initial="fix the parser"
        label="Rename fix the parser"
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('value="fix the parser"');
    expect(html).toContain('aria-label="Rename fix the parser"');
    expect(html).toContain("inline-rename");
  });
});
