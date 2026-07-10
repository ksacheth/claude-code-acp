import type { ContentBlock } from "@agentclientprotocol/sdk";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_COUNT = 5;

const SUPPORTED_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

export interface PromptImage {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  size: number;
}

export function imageDataUrl(image: Pick<PromptImage, "mimeType" | "data">): string {
  return `data:${image.mimeType};base64,${image.data}`;
}

export function contentBlocksForPrompt(text: string, images: PromptImage[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (text.trim()) blocks.push({ type: "text", text });
  blocks.push(...images.map(({ data, mimeType }) => ({ type: "image" as const, data, mimeType })));
  return blocks;
}

export function validateImageFile(file: Pick<File, "name" | "type" | "size">): string | undefined {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return `${file.name} is not a supported image. Use PNG, JPEG, GIF, or WebP.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is larger than 20 MB.`;
  }
  return undefined;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function promptImageFromFile(file: File): Promise<PromptImage> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const dataUrl = await readAsDataUrl(file);
  const separator = dataUrl.indexOf(",");
  if (separator === -1) throw new Error(`Could not encode ${file.name}.`);

  return {
    id: crypto.randomUUID(),
    name: file.name || "Pasted image",
    mimeType: file.type,
    data: dataUrl.slice(separator + 1),
    size: file.size,
  };
}

export function imageFilesFrom(items: FileList | readonly File[]): File[] {
  return Array.from(items).filter((file) => file.type.startsWith("image/"));
}
