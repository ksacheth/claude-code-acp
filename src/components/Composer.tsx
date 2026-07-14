import { type ChangeEventHandler, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { AvailableCommand, SessionConfigOption } from "@agentclientprotocol/sdk";

import { imageDataUrl, MAX_IMAGE_COUNT, type PromptImage } from "../session/attachments";
import {
  EFFORT_CONFIG_ID,
  FAST_MODE_CONFIG_ID,
  MODE_CONFIG_ID,
  MODEL_CONFIG_ID,
  selectConfigs,
  type SelectConfig,
} from "../session/config";
import { useCommandPalette } from "../session/useCommandPalette";
import { formatContext, formatCost, type Usage } from "../session/usage";
import { CommandPalette } from "./CommandPalette";
import { EffortControl } from "./EffortControl";
import { SessionConfigMenu } from "./SessionConfigMenu";
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
  usage?: Usage;
  configOptions?: SessionConfigOption[];
  onSetConfig: (configId: string, value: string) => void;
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
  usage?: Usage;
}

function ComposerToolbar(props: ComposerToolbarProps) {
  const { busy, disabled, hasContent, imageCount, fileInputRef, onFilesSelected, onCancel, usage } =
    props;
  const cost = usage && formatCost(usage.cost);
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
      <div className="composer-actions">
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
        {usage && (
          <div className="usage composer-usage" title="Context tokens used / window (·cost)">
            {formatContext(usage)}
            {cost && <span className="cost"> · {cost}</span>}
          </div>
        )}
      </div>
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
  usage?: Usage;
}

function ComposerBox(props: ComposerBoxProps) {
  const { draft, disabled, busy, hasContent, attachments, setDraft, onKeyDown, onCancel, usage } =
    props;
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
        usage={usage}
      />
      {attachments.dragging && <div className="drop-overlay">Drop images to attach</div>}
    </div>
  );
}

function ConfigSelect({
  config,
  disabled,
  onSetConfig,
}: {
  config: SelectConfig;
  disabled: boolean;
  onSetConfig: (configId: string, value: string) => void;
}) {
  return (
    <select
      className={`config-select composer-config-select config-${config.id}`}
      title={config.name}
      aria-label={config.name}
      value={config.currentValue}
      disabled={disabled}
      onChange={(event) => onSetConfig(config.id, event.currentTarget.value)}
    >
      {config.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

function ComposerConfigBar({
  configOptions,
  disabled,
  onSetConfig,
}: {
  configOptions?: SessionConfigOption[];
  disabled: boolean;
  onSetConfig: (configId: string, value: string) => void;
}) {
  const configs = selectConfigs(configOptions);
  const mode = configs.find((config) => config.id === MODE_CONFIG_ID);
  const model = configs.find((config) => config.id === MODEL_CONFIG_ID);
  const effort = configs.find((config) => config.id === EFFORT_CONFIG_ID);
  const fastMode = configs.find((config) => config.id === FAST_MODE_CONFIG_ID);
  const remaining = configs.filter(
    (config) =>
      config.id !== MODE_CONFIG_ID &&
      config.id !== MODEL_CONFIG_ID &&
      config.id !== EFFORT_CONFIG_ID &&
      config.id !== FAST_MODE_CONFIG_ID,
  );
  if (!mode && !model && !effort && remaining.length === 0) return null;

  return (
    <div className="composer-config-bar">
      <div className="composer-config-left">
        {mode && (
          <SessionConfigMenu
            config={mode}
            kind="mode"
            disabled={disabled}
            onSetConfig={onSetConfig}
          />
        )}
      </div>
      <div className="composer-config-right">
        {model && (
          <SessionConfigMenu
            config={model}
            kind="model"
            fastMode={fastMode}
            disabled={disabled}
            onSetConfig={onSetConfig}
          />
        )}
        {remaining.map((config) => (
          <ConfigSelect
            key={config.id}
            config={config}
            disabled={disabled}
            onSetConfig={onSetConfig}
          />
        ))}
        {effort && <EffortControl config={effort} disabled={disabled} onSetConfig={onSetConfig} />}
      </div>
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
  usage,
  configOptions,
  onSetConfig,
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
        usage={usage}
      />
      <ComposerConfigBar
        configOptions={configOptions}
        disabled={disabled}
        onSetConfig={onSetConfig}
      />
      {attachments.error && (
        <div className="attachment-error" role="alert">
          {attachments.error}
        </div>
      )}
    </form>
  );
}
