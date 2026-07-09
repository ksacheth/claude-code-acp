import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Markdown } from "./Markdown";

const FIXTURE = [
  "# Heading",
  "",
  "A paragraph with `inline code` and **bold**.",
  "",
  "- first",
  "- second",
  "",
  "```ts",
  "const x: number = 1;",
  "```",
  "",
  "| a | b |",
  "| - | - |",
  "| 1 | 2 |",
].join("\n");

describe("Markdown", () => {
  const html = renderToStaticMarkup(<Markdown text={FIXTURE} />);

  it("renders headings, lists, and inline code", () => {
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<code>inline code</code>");
  });

  it("renders fenced code blocks with syntax highlighting", () => {
    expect(html).toContain("<pre>");
    // rehype-highlight tags tokens with hljs classes.
    expect(html).toContain("hljs");
  });

  it("renders GFM tables", () => {
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders partial markdown mid-stream without throwing", () => {
    // An unclosed code fence, as would appear while streaming.
    const partial = renderToStaticMarkup(<Markdown text={"```ts\nconst x ="} />);
    expect(partial).toContain("<pre>");
  });
});
