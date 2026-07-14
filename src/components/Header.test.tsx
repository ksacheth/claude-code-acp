import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionConfigOption } from "@agentclientprotocol/sdk";

import { Header } from "./Header";

const configOptions: SessionConfigOption[] = [
  {
    id: "model",
    name: "Model",
    type: "select",
    currentValue: "opus",
    options: [
      { value: "opus", name: "Opus" },
      { value: "sonnet", name: "Sonnet" },
    ],
  },
  {
    id: "effort",
    name: "Effort",
    type: "select",
    currentValue: "default",
    options: [
      { value: "default", name: "Default" },
      { value: "high", name: "High" },
    ],
  },
] as SessionConfigOption[];

describe("Header", () => {
  it("renders a labeled select for each multi-option config", () => {
    const html = renderToStaticMarkup(
      <Header status="connected" configOptions={configOptions} onSetConfig={() => {}} />,
    );
    expect(html).toContain("config-model");
    expect(html).toContain("config-effort");
    expect(html).toContain("Sonnet");
    expect(html).toContain("High");
  });

  it("preselects each option's current value", () => {
    const html = renderToStaticMarkup(
      <Header status="connected" configOptions={configOptions} onSetConfig={() => {}} />,
    );
    // React renders the selected value on the <select>, marking that <option>.
    expect(html).toMatch(/config-model[^>]*>.*?<option[^>]*value="opus"[^>]*selected/s);
  });

  it("renders no config selects when there are none", () => {
    const html = renderToStaticMarkup(<Header status="connected" onSetConfig={() => {}} />);
    expect(html).not.toContain("config-select");
  });

  it("shows Claude subscription usage limits separately from context usage", () => {
    const html = renderToStaticMarkup(
      <Header
        status="connected"
        usage={{
          used: 12000,
          size: 200000,
          rateLimits: [{ status: "allowed", type: "five_hour", utilization: 42 }],
        }}
        onSetConfig={() => {}}
      />,
    );
    expect(html).toContain("12.0k / 200k (6%)");
    expect(html).toContain("5h limit: 42% used");
  });
});
