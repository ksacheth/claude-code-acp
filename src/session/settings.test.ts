import { describe, it, expect } from "vitest";

import {
  defaultSettings,
  loadSettings,
  saveSettings,
  normalizeSettings,
  toMcpServers,
  parseArgs,
  parseDirs,
  parseEnv,
  formatDirs,
  formatEnv,
  type Settings,
} from "./settings";

/// A tiny in-memory Storage stub (only the two methods the module uses).
function memoryStorage(initial?: string) {
  let value = initial;
  return {
    getItem: () => value ?? null,
    setItem: (_k: string, v: string) => {
      value = v;
    },
    read: () => value,
  };
}

describe("loadSettings / saveSettings", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadSettings(memoryStorage())).toEqual(defaultSettings);
  });

  it("round-trips through storage", () => {
    const store = memoryStorage();
    const settings: Settings = {
      enginePath: "/repo/dist/index.js",
      nodePath: "/usr/local/bin/node",
      env: [{ name: "PATH", value: "/usr/local/bin" }],
      defaultModel: "opus",
      defaultMode: "plan",
      theme: "dark",
      mcpServers: [{ name: "fs", command: "npx", args: ["-y", "server"], env: [] }],
      chatsDir: "/data/chats",
      unlistedDirs: ["/Users/me"],
    };
    expect(saveSettings(settings, store)).toBe(true);
    expect(loadSettings(store)).toEqual(settings);
  });

  it("falls back to defaults on corrupt JSON", () => {
    expect(loadSettings(memoryStorage("{not json"))).toEqual(defaultSettings);
  });
});

describe("normalizeSettings", () => {
  it("drops junk and defaults arrays", () => {
    expect(normalizeSettings({ enginePath: 42, env: "nope", mcpServers: null })).toEqual(defaultSettings);
  });

  it("keeps well-formed fields and filters malformed env/servers", () => {
    const s = normalizeSettings({
      nodePath: "node",
      env: [{ name: "A", value: "1" }, { value: "no-name" }],
      mcpServers: [
        { name: "ok", command: "npx", args: ["x", 5], env: [{ name: "K", value: "v" }] },
        { name: "no-command" },
      ],
    });
    expect(s.nodePath).toBe("node");
    expect(s.env).toEqual([{ name: "A", value: "1" }]);
    expect(s.mcpServers).toHaveLength(1);
    expect(s.mcpServers[0]).toEqual({ name: "ok", command: "npx", args: ["x"], env: [{ name: "K", value: "v" }] });
  });

  it("keeps a valid theme and defaults anything else to auto", () => {
    expect(normalizeSettings({ theme: "dark" }).theme).toBe("dark");
    expect(normalizeSettings({ theme: "light" }).theme).toBe("light");
    expect(normalizeSettings({ theme: "neon" }).theme).toBe("auto");
    expect(normalizeSettings({}).theme).toBe("auto");
  });

  it("keeps a chats folder and trims the unlisted directory list", () => {
    const s = normalizeSettings({
      chatsDir: "/data/chats",
      unlistedDirs: ["  /Users/me  ", "/Users/me", "", 7, "/tmp"],
    });
    expect(s.chatsDir).toBe("/data/chats");
    expect(s.unlistedDirs).toEqual(["/Users/me", "/tmp"]);
  });

  it("treats a blank or non-string chats folder as unset", () => {
    expect(normalizeSettings({ chatsDir: "" }).chatsDir).toBeUndefined();
    expect(normalizeSettings({ chatsDir: 7 }).chatsDir).toBeUndefined();
    expect(normalizeSettings({ unlistedDirs: "nope" }).unlistedDirs).toEqual([]);
  });
});

describe("parseDirs / formatDirs", () => {
  it("splits lines, trimming and de-duplicating", () => {
    expect(parseDirs("  /a  \n/b\n\n/a\n   ")).toEqual(["/a", "/b"]);
    expect(parseDirs("")).toEqual([]);
  });

  it("formatDirs is the inverse of parseDirs for clean input", () => {
    const text = "/a\n/b";
    expect(formatDirs(parseDirs(text))).toBe(text);
  });
});

describe("toMcpServers", () => {
  it("maps configs to the ACP stdio shape and drops incomplete ones", () => {
    const servers = toMcpServers([
      { name: " fs ", command: " npx ", args: ["-y", "s"], env: [{ name: "K", value: "v" }] },
      { name: "", command: "npx", args: [], env: [] },
      { name: "x", command: "", args: [], env: [] },
    ]);
    expect(servers).toEqual([{ name: "fs", command: "npx", args: ["-y", "s"], env: [{ name: "K", value: "v" }] }]);
  });
});

describe("parseArgs / parseEnv / formatEnv", () => {
  it("splits args on whitespace", () => {
    expect(parseArgs("  -y  @scope/server  --flag ")).toEqual(["-y", "@scope/server", "--flag"]);
    expect(parseArgs("")).toEqual([]);
  });

  it("parses KEY=VALUE lines, keeping = in values and skipping junk", () => {
    expect(parseEnv("PATH=/a:/b\nTOKEN=x=y\n\n=bad\nnoeq")).toEqual([
      { name: "PATH", value: "/a:/b" },
      { name: "TOKEN", value: "x=y" },
    ]);
  });

  it("formatEnv is the inverse of parseEnv for clean input", () => {
    const text = "PATH=/a:/b\nTOKEN=xyz";
    expect(formatEnv(parseEnv(text))).toBe(text);
  });
});
