import { describe, it, expect } from "vitest";

import type { Settings } from "./settings";
import { settingsToForm, formToSettings } from "./settingsForm";

const settings: Settings = {
  enginePath: "/repo/dist/index.js",
  nodePath: "/usr/local/bin/node",
  env: [{ name: "PATH", value: "/usr/local/bin" }],
  defaultModel: "opus",
  defaultMode: "plan",
  theme: "dark",
  mcpServers: [{ name: "fs", command: "npx", args: ["-y", "server"], env: [{ name: "K", value: "v" }] }],
};

describe("settingsToForm / formToSettings", () => {
  it("round-trips a fully populated settings object", () => {
    expect(formToSettings(settingsToForm(settings))).toEqual(settings);
  });

  it("renders scalars and text fields for editing", () => {
    const form = settingsToForm(settings);
    expect(form.envText).toBe("PATH=/usr/local/bin");
    expect(form.servers[0].argsText).toBe("-y server");
    expect(form.servers[0].envText).toBe("K=v");
  });

  it("maps blank scalars to undefined and drops incomplete servers", () => {
    const form = {
      enginePath: "  ",
      nodePath: "",
      defaultModel: " ",
      defaultMode: "",
      theme: "auto" as const,
      envText: "",
      servers: [
        { name: "ok", command: "npx", argsText: "a b", envText: "" },
        { name: "", command: "npx", argsText: "", envText: "" },
        { name: "x", command: "  ", argsText: "", envText: "" },
      ],
    };
    const out = formToSettings(form);
    expect(out.enginePath).toBeUndefined();
    expect(out.defaultModel).toBeUndefined();
    expect(out.env).toEqual([]);
    expect(out.mcpServers).toEqual([{ name: "ok", command: "npx", args: ["a", "b"], env: [] }]);
  });
});
