import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

import "highlight.js/styles/github.css";
import "./Markdown.css";

interface MarkdownProps {
  text: string;
}

/// Renders GitHub-flavored markdown with syntax-highlighted code. Memoized on
/// `text` so streaming (which appends to `text`) only re-parses when the
/// content actually changes, keeping re-renders cheap and layout stable.
///
/// Partial markdown mid-stream (e.g. an unclosed code fence) renders as the
/// best-effort tree react-markdown can build; it resolves once the fence closes.
export const Markdown = memo(function Markdown({ text }: MarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
