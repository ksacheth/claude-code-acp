import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AuthBanner } from "./AuthBanner";

describe("AuthBanner", () => {
  it("offers the supported browser login when authentication is required", () => {
    const html = renderToStaticMarkup(
      <AuthBanner visible loggingIn={false} onLogin={() => {}} />,
    );

    expect(html).toContain("You are not logged in to Claude.");
    expect(html).toContain("Log in with Claude");
  });

  it("shows browser sign-in progress without allowing another login process", () => {
    const html = renderToStaticMarkup(
      <AuthBanner visible loggingIn onLogin={() => {}} />,
    );

    expect(html).toContain("Complete the Claude sign-in in your browser.");
    expect(html).toContain('disabled=""');
  });
});
