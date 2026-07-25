import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RowMenu } from "./RowMenu";

describe("RowMenu", () => {
  const html = renderToStaticMarkup(
    <RowMenu
      label="Options for alpha"
      items={[
        { label: "Rename", onSelect: () => {} },
        { label: "Delete", onSelect: () => {}, danger: true },
      ]}
    />,
  );

  it("labels the trigger with what the menu acts on", () => {
    expect(html).toContain('aria-label="Options for alpha"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it("starts closed", () => {
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/row-menu-popover[^>]*hidden/);
  });

  it("renders each item, marking destructive ones", () => {
    expect(html).toContain(">Rename<");
    expect(html).toContain(">Delete<");
    expect(html).toMatch(/row-menu-item danger[^>]*>Delete</);
  });
});
