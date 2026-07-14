import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionConfigOption } from "@agentclientprotocol/sdk";

import { Composer } from "./Composer";

const configOptions: SessionConfigOption[] = [
  {
    id: "mode",
    name: "Permission mode",
    type: "select",
    currentValue: "bypassPermissions",
    options: [
      { value: "default", name: "Manual" },
      { value: "bypassPermissions", name: "Bypass permissions" },
    ],
  },
  {
    id: "model",
    name: "Model",
    type: "select",
    currentValue: "opus",
    options: [
      { value: "opus", name: "Opus 4.8" },
      { value: "sonnet", name: "Sonnet" },
    ],
  },
  {
    id: "effort",
    name: "Effort",
    type: "select",
    currentValue: "high",
    options: [
      { value: "medium", name: "Medium" },
      { value: "high", name: "High" },
    ],
  },
  {
    id: "fast",
    name: "Fast mode",
    type: "select",
    currentValue: "off",
    options: [
      { value: "on", name: "On" },
      { value: "off", name: "Off" },
    ],
  },
];

describe("Composer", () => {
  it("places permission mode left and model and effort right below the input", () => {
    const html = renderToStaticMarkup(
      <Composer
        cwd="/repo"
        disabled={false}
        canSend
        busy={false}
        onSend={() => {}}
        onCancel={() => {}}
        configOptions={configOptions}
        onSetConfig={() => {}}
      />,
    );

    expect(html).toMatch(/composer-config-left.*config-menu-mode.*config-mode/s);
    expect(html).toMatch(/composer-config-right.*config-menu-model.*config-model.*effort-trigger/s);
    expect(html).toContain("Bypass permissions");
    expect(html).toContain("Opus 4.8");
    expect(html).toContain("High");
    expect(html).toContain('aria-label="Effort: High"');
    expect(html).toContain('aria-label="Enable fast mode"');
    expect(html).toContain('role="menuitemradio"');
  });
});
