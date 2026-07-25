import { describe, it, expect } from "vitest";
import type { SessionConfigOption } from "@agentclientprotocol/sdk";

import { selectConfigs, patchCurrentValue, versionedModelName, MODE_CONFIG_ID } from "./config";

const select = (
  id: string,
  currentValue: string,
  values: { value: string; name: string }[],
): SessionConfigOption =>
  ({
    id,
    name: id[0].toUpperCase() + id.slice(1),
    type: "select",
    currentValue,
    options: values,
  }) as SessionConfigOption;

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

// Captured verbatim from a live `session/new` response: bare family names, with
// the version stated only in the description. Note that Default repeats the
// description of whichever model it resolves to, so a rule that simply grabbed
// the first version in the description would mislabel it.
const LIVE_MODEL_OPTIONS: SessionConfigOption[] = [
  {
    id: "model",
    name: "Model",
    type: "select",
    currentValue: "opus[1m]",
    options: [
      {
        value: "default",
        name: "Default (recommended)",
        description: "Opus 4.8 with 1M context · Best for everyday, complex tasks",
      },
      {
        value: "opus[1m]",
        name: "Opus",
        description: "Opus 4.8 with 1M context · Best for everyday, complex tasks",
      },
      {
        value: "fable",
        name: "Fable",
        description: "Fable 5 · Most capable for your hardest and longest-running tasks",
      },
      { value: "sonnet", name: "Sonnet", description: "Sonnet 5 · Efficient for routine tasks" },
      { value: "haiku", name: "Haiku", description: "Haiku 4.5 · Fastest for quick answers" },
      {
        value: "opus-4-6",
        name: "Opus 4.6",
        description: "Newer version available · select Opus for Opus 4.8",
      },
    ],
  } as SessionConfigOption,
];

describe("versionedModelName", () => {
  it("appends the version the description states for that family", () => {
    expect(versionedModelName("Opus", "Opus 4.8 with 1M context · Best for everyday")).toBe(
      "Opus 4.8",
    );
    expect(versionedModelName("Sonnet", "Sonnet 5 · Efficient for routine tasks")).toBe("Sonnet 5");
    expect(versionedModelName("Haiku", "Haiku 4.5 · Fastest for quick answers")).toBe("Haiku 4.5");
  });

  it("does not borrow another row's version", () => {
    // Default repeats the description of the model it resolves to, so the
    // version here belongs to Opus. Default's own version changes with the
    // recommendation, and claiming 4.8 would go stale silently.
    expect(
      versionedModelName(
        "Default (recommended)",
        "Opus 4.8 with 1M context · Best for everyday, complex tasks",
      ),
    ).toBe("Default (recommended)");
  });

  it("leaves a name that already carries a version alone", () => {
    expect(versionedModelName("Haiku 4.5", "Haiku 4.5 · Fastest")).toBe("Haiku 4.5");
  });

  it("falls back to the bare name when the version cannot be read", () => {
    expect(versionedModelName("Opus", undefined)).toBe("Opus");
    expect(versionedModelName("Opus", "")).toBe("Opus");
    expect(versionedModelName("Opus", "Best for everyday, complex tasks")).toBe("Opus");
    expect(versionedModelName("Opus", "Opus is the strongest")).toBe("Opus");
  });

  it("matches the family name case-insensitively and trims", () => {
    expect(versionedModelName("  opus  ", "OPUS 5 · strongest")).toBe("opus 5");
  });

  it("treats a name with regex characters literally", () => {
    // Unescaped, the parentheses would become a capture group and the version
    // would be read as "Pro" rather than 5.
    expect(versionedModelName("Opus (Pro)", "Opus (Pro) 5 · strongest")).toBe("Opus (Pro) 5");
  });
});

describe("selectConfigs model versions", () => {
  const model = () => selectConfigs(LIVE_MODEL_OPTIONS)[0];

  it("labels every model row with its version", () => {
    expect(model().options.map((o) => o.name)).toEqual([
      "Default (recommended)",
      "Opus 4.8",
      "Fable 5",
      "Sonnet 5",
      "Haiku 4.5",
      // Already versioned by the engine, so it is passed through as-is.
      "Opus 4.6",
    ]);
  });

  it("keeps the values untouched so selection still round-trips", () => {
    expect(model().options.map((o) => o.value)).toEqual([
      "default",
      "opus[1m]",
      "fable",
      "sonnet",
      "haiku",
      "opus-4-6",
    ]);
    expect(model().currentValue).toBe("opus[1m]");
  });

  it("leaves non-model selectors alone", () => {
    const modes = selectConfigs([
      select("mode", "default", [
        { value: "default", name: "Default" },
        { value: "plan", name: "Plan" },
      ]),
    ]);
    expect(modes[0].options.map((o) => o.name)).toEqual(["Default", "Plan"]);
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
