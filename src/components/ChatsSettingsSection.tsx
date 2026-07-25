interface ChatsSettingsSectionProps {
  chatsDir: string;
  unlistedDirsText: string;
  onChange: (patch: { chatsDir?: string; unlistedDirsText?: string }) => void;
}

/// Where chats with no project live, and which folders should not be listed as
/// projects. Both exist because ACP gives every session a working directory:
/// "no project" is a directory the sidebar shows without a project header.
export function ChatsSettingsSection({
  chatsDir,
  unlistedDirsText,
  onChange,
}: ChatsSettingsSectionProps) {
  return (
    <section className="settings-section">
      <h3>Chats</h3>
      <label>
        Chats folder <span className="muted">(blank = an app-owned folder)</span>
        <input
          value={chatsDir}
          onChange={(e) => onChange({ chatsDir: e.currentTarget.value })}
          placeholder="/Users/you/Library/Application Support/claude-tauri/chats"
        />
      </label>
      <p className="muted">
        Every session needs a directory, so chats with no project are rooted here and listed without
        a project folder.
      </p>
      <label>
        Not projects <span className="muted">(one absolute path per line)</span>
        <textarea
          value={unlistedDirsText}
          onChange={(e) => onChange({ unlistedDirsText: e.currentTarget.value })}
          placeholder="/Users/you&#10;/Users/you/Downloads"
          rows={3}
        />
      </label>
      <p className="muted">Chats in these folders join the flat list instead of a project.</p>
    </section>
  );
}
