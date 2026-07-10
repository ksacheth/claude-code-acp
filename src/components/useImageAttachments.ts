import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";

import {
  imageFilesFrom,
  MAX_IMAGE_COUNT,
  promptImageFromFile,
  type PromptImage,
} from "../session/attachments";

function clipboardImages(event: ClipboardEvent<HTMLTextAreaElement>): File[] {
  const itemFiles = Array.from(event.clipboardData.items)
    .filter((item) => item.kind === "file")
    .flatMap((item) => {
      const file = item.getAsFile();
      return file ? [file] : [];
    });
  return imageFilesFrom(itemFiles.length ? itemFiles : Array.from(event.clipboardData.files));
}

export function useImageAttachments() {
  const [images, setImages] = useState<PromptImage[]>([]);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (files: File[]) => {
      setError(undefined);
      try {
        const encoded = await Promise.all(files.slice(0, MAX_IMAGE_COUNT).map(promptImageFromFile));
        setImages((current) => [...current, ...encoded].slice(0, MAX_IMAGE_COUNT));
        if (files.length > MAX_IMAGE_COUNT - images.length) {
          setError(`Only ${MAX_IMAGE_COUNT} images can be attached at once.`);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [images.length],
  );

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(imageFilesFrom(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = clipboardImages(event);
    if (!files.length) return;
    event.preventDefault();
    void addFiles(files);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = imageFilesFrom(event.dataTransfer.files);
    if (files.length) void addFiles(files);
  };

  const remove = (id: string) => setImages((current) => current.filter((image) => image.id !== id));
  const clear = () => {
    setImages([]);
    setError(undefined);
  };

  return {
    images,
    error,
    dragging,
    fileInputRef,
    onFilesSelected,
    onPaste,
    onDrop,
    remove,
    clear,
    setDragging,
  };
}
