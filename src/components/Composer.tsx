import { type ChangeEventHandler, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { AvailableCommand } from "@agentclientprotocol/sdk";

import { imageDataUrl, MAX_IMAGE_COUNT, type PromptImage } from "../session/attachments";
import { useCommandPalette } from "../session/useCommandPalette";
import { CommandPalette } from "./CommandPalette";
import { useImageAttachments } from "./useImageAttachments";

interface ComposerProps {
  cwd: string;
  disabled: boolean;
  canSend: boolean;
  busy: boolean;
  /// Agent slash commands, used to power the `/` autocomplete palette.
  commands?: AvailableCommand[];
  onSend: (text: string, images: PromptImage[]) => void;
  onCancel: () => void;
}

function AttachmentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8.5 12.5 15 6a3.54 3.54 0 0 1 5 5l-8.5 8.5a5.3 5.3 0 0 1-7.5-7.5l8-8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 12 14-7-4.5 14-3-6-6.5-1Z" />
      <path d="m11.5 13 3-3" />
    </svg>
  );
}

function AttachmentList({
  images,
  onRemove,
}: {
  images: PromptImage[];
  onRemove: (id: string) => void;
}) {
  if (!images.length) return null;
  return (
    <div className="attachment-list" aria-label="Attached images">
      {images.map((image) => (
        <div className="attachment" key={image.id}>
          <img src={imageDataUrl(image)} alt={image.name} />
          <span className="attachment-name" title={image.name}>
            {image.name}
          </span>
          <button
            type="button"
            className="attachment-remove"
            aria-label={`Remove ${image.name}`}
            onClick={() => onRemove(image.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

interface ComposerToolbarProps {
  busy: boolean;
  disabled: boolean;
  hasContent: boolean;
  imageCount: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFilesSelected: ChangeEventHandler<HTMLInputElement>;
  onCancel: () => void;
}

function ComposerToolbar(props: ComposerToolbarProps) {
  const { busy, disabled, hasContent, imageCount, fileInputRef, onFilesSelected, onCancel } = props;
  return (
    <div className="composer-toolbar">
      <div className="composer-tools">
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          onChange={onFilesSelected}
          tabIndex={-1}
        />
        <button
          type="button"
          className="icon-button attach-button"
          title="Attach images"
          aria-label="Attach images"
          disabled={disabled || imageCount >= MAX_IMAGE_COUNT}
          onClick={() => fileInputRef.current?.click()}
        >
          <AttachmentIcon />
        </button>
        <span className="composer-hint">Shift+Enter for a new line</span>
      </div>
      {busy ? (
        <button type="button" className="cancel composer-action" onClick={onCancel}>
          <span className="stop-icon" /> Stop
        </button>
      ) : (
        <button
          type="submit"
          className="send-button composer-action"
          disabled={!hasContent}
          aria-label="Send message"
        >
          <span>Send</span> <SendIcon />
        </button>
      )}
    </div>
  );
}

interface ComposerBoxProps {
  draft: string;
  disabled: boolean;
  busy: boolean;
  hasContent: boolean;
  attachments: ReturnType<typeof useImageAttachments>;
  setDraft: (text: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCancel: () => void;
}

function ComposerBox(props: ComposerBoxProps) {
  const { draft, disabled, busy, hasContent, attachments, setDraft, onKeyDown, onCancel } = props;
  return (
    <div
      className={`composer-box${attachments.dragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        attachments.setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          attachments.setDragging(false);
      }}
      onDrop={attachments.onDrop}
    >
      <AttachmentList images={attachments.images} onRemove={attachments.remove} />
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        onPaste={attachments.onPaste}
        placeholder="Ask anything, paste an image, or type / for commands"
        aria-label="Message"
        rows={1}
        disabled={disabled}
      />
      <ComposerToolbar
        busy={busy}
        disabled={disabled}
        hasContent={hasContent}
        imageCount={attachments.images.length}
        fileInputRef={attachments.fileInputRef}
        onFilesSelected={attachments.onFilesSelected}
        onCancel={onCancel}
      />
      {attachments.dragging && <div className="drop-overlay">Drop images to attach</div>}
    </div>
  );
}

/// Multiline prompt composer with ACP image attachments. Images can come from
/// the picker, clipboard, or drag-and-drop and are previewed before submission.
export function Composer({
  cwd,
  disabled,
  canSend,
  busy,
  commands,
  onSend,
  onCancel,
}: ComposerProps) {
  const { draft, setDraft, matches, active, paletteOpen, pick, onKeyDown } =
    useCommandPalette(commands);
  const attachments = useImageAttachments();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend || (!draft.trim() && attachments.images.length === 0)) return;
    onSend(draft, attachments.images);
    setDraft("");
    attachments.clear();
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const hasContent = canSend && (draft.trim().length > 0 || attachments.images.length > 0);

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-context">
        <span className="composer-context-dot" />
        <span className="cwd" title={cwd}>
          {cwd}
        </span>
      </div>
      {paletteOpen && <CommandPalette matches={matches} active={active} onPick={pick} />}
      <ComposerBox
        draft={draft}
        disabled={disabled}
        busy={busy}
        hasContent={hasContent}
        attachments={attachments}
        setDraft={setDraft}
        onKeyDown={onComposerKeyDown}
        onCancel={onCancel}
      />
      {attachments.error && (
        <div className="attachment-error" role="alert">
          {attachments.error}
        </div>
      )}
    </form>
  );
}
