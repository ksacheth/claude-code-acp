import { describe, expect, it } from "vitest";

import { requestErrorMessage } from "./errors";

describe("requestErrorMessage", () => {
  it("digs the real text out of a generic internal error", () => {
    const error = Object.assign(new Error("Internal error"), {
      data: { details: "Session abc not found in any project directory" },
    });
    expect(requestErrorMessage(error)).toBe("Session abc not found in any project directory");
  });

  it("accepts a structured message field", () => {
    const error = Object.assign(new Error("Internal error"), {
      data: { message: "EACCES: permission denied" },
    });
    expect(requestErrorMessage(error)).toBe("EACCES: permission denied");
  });

  it("accepts data sent as a bare string", () => {
    const error = Object.assign(new Error("Internal error"), { data: "disk is full" });
    expect(requestErrorMessage(error)).toBe("disk is full");
  });

  it("falls back to the error's own message when data says nothing", () => {
    expect(requestErrorMessage(new Error("no connection"))).toBe("no connection");
    expect(requestErrorMessage(Object.assign(new Error("boom"), { data: { details: "  " } }))).toBe(
      "boom",
    );
  });

  it("stringifies anything that is not an error", () => {
    expect(requestErrorMessage("plain failure")).toBe("plain failure");
    expect(requestErrorMessage(undefined)).toBe("undefined");
  });
});
