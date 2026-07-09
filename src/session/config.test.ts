import { describe, it, expect } from "vitest";
import type { SessionConfigOption } from "@agentclientprotocol/sdk";

import { selectConfigs, patchCurrentValue, MODE_CONFIG_ID } from "./config";

const select = (
  id: string,
  currentValue: string,
  values: { value: string; name: string }[],
): SessionConfigOption =>
  ({ id, name: id[0].toUpperCase() + id.slice(1), type: "select", currentValue, options: values }) as SessionConfigOption;

const options: SessionConfigOption[] = [
  select("mode", "default", [
    { value: "default", name: "Default" },
    { value: "plan", name: "Plan" },
  ]),
  select("model", "opus", [
    { value: "opus", name: "Opus" },
    { value: "sonnet", name: "Sonnet" },
  ]),
];

describe("selectConfigs", () => {
  it("returns each select option flattened for rendering", () => {
    const configs = selectConfigs(options);
    expect(configs.map((c) => c.id)).toEqual(["mode", "model"]);
    expect(configs[1].currentValue).toBe("opus");
    expect(configs[1].options.map((o) => o.value)).toEqual(["opus", "sonnet"]);
  });

  it("drops single-option selectors (no real choice)", () => {
    const single = [select("agent", "default", [{ value: "default", name: "Default" }])];
    expect(selectConfigs(single)).toEqual([]);
  });

  it("skips boolean options and tolerates undefined", () => {
    const withBool = [
      ...options,
      { id: "fast", name: "Fast", type: "boolean", currentValue: true } as SessionConfigOption,
    ];
    expect(selectConfigs(withBool).map((c) => c.id)).toEqual(["mode", "model"]);
    expect(selectConfigs(undefined)).toEqual([]);
  });

  it("flattens grouped select options", () => {
    const grouped = [
      {
        id: "model",
        name: "Model",
        type: "select",
        currentValue: "opus",
        options: [
          { group: "g1", name: "Frontier", options: [{ value: "opus", name: "Opus" }] },
          { group: "g2", name: "Fast", options: [{ value: "haiku", name: "Haiku" }] },
        ],
      } as SessionConfigOption,
    ];
    expect(selectConfigs(grouped)[0].options.map((o) => o.value)).toEqual(["opus", "haiku"]);
  });
});

describe("patchCurrentValue", () => {
  it("sets one select option's currentValue, leaving others untouched", () => {
    const patched = patchCurrentValue(options, "model", "sonnet");
    const model = patched!.find((o) => o.id === "model");
    expect(model && "currentValue" in model && model.currentValue).toBe("sonnet");
    const mode = patched!.find((o) => o.id === "mode");
    expect(mode && "currentValue" in mode && mode.currentValue).toBe("default");
  });

  it("patches the mode option via MODE_CONFIG_ID", () => {
    const patched = patchCurrentValue(options, MODE_CONFIG_ID, "plan");
    const mode = patched!.find((o) => o.id === "mode");
    expect(mode && "currentValue" in mode && mode.currentValue).toBe("plan");
  });

  it("returns undefined unchanged", () => {
    expect(patchCurrentValue(undefined, "model", "x")).toBeUndefined();
  });
});
