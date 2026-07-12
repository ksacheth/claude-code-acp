interface AuthBannerProps {
  visible: boolean;
  loggingIn: boolean;
  error?: string;
  onLogin: () => void;
}

/// Guides users through the supported browser login instead of forwarding the
/// unsupported `/login` slash command to an ACP session.
export function AuthBanner({ visible, loggingIn, error, onLogin }: AuthBannerProps) {
  if (!visible) return null;

  return (
    <div className="banner auth-banner" role="status">
      <span>
        {loggingIn
          ? "Complete the Claude sign-in in your browser."
          : error || "You are not logged in to Claude."}
      </span>
      <button type="button" onClick={onLogin} disabled={loggingIn}>
        {loggingIn ? "Waiting for sign-in…" : "Log in with Claude"}
      </button>
    </div>
  );
}
