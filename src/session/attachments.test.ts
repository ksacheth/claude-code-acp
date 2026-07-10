import { describe, expect, it } from "vitest";

import {
  contentBlocksForPrompt,
  imageDataUrl,
  MAX_IMAGE_BYTES,
  type PromptImage,
  validateImageFile,
} from "./attachments";

const image: PromptImage = {
  id: "image-1",
  name: "diagram.png",
  mimeType: "image/png",
  data: "aGVsbG8=",
  size: 5,
};

describe("image attachments", () => {
  it("creates an ACP prompt containing text and image content", () => {
    expect(contentBlocksForPrompt("Explain this", [image])).toEqual([
      { type: "text", text: "Explain this" },
      { type: "image", mimeType: "image/png", data: "aGVsbG8=" },
    ]);
  });

  it("allows an image-only prompt", () => {
    expect(contentBlocksForPrompt("  ", [image])).toEqual([
      { type: "image", mimeType: "image/png", data: "aGVsbG8=" },
    ]);
  });

  it("builds a previewable data URL", () => {
    expect(imageDataUrl(image)).toBe("data:image/png;base64,aGVsbG8=");
  });

  it("rejects unsupported and oversized images with a useful error", () => {
    expect(validateImageFile({ name: "photo.heic", type: "image/heic", size: 100 })).toContain(
      "PNG",
    );
    expect(
      validateImageFile({ name: "huge.png", type: "image/png", size: MAX_IMAGE_BYTES + 1 }),
    ).toContain("20 MB");
  });
});
