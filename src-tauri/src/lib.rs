mod process;

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use process::{spawn_agent, AgentHandle};

/// The single live agent process for the app (M0 is single-session).
#[derive(Default)]
struct AgentState(Mutex<Option<AgentHandle>>);

/// Start the agent subprocess. `command` is the executable (e.g. `node`) and
/// `args` its arguments (e.g. the engine's `dist/index.js` path). `env` adds
/// variables to the child's environment (e.g. a full `PATH` for a Finder
/// launch). Stdout, stderr, and exit are forwarded to the webview as
/// `agent-stdout`, `agent-stderr`, and `agent-exit` events.
#[tauri::command]
fn agent_start(
    app: AppHandle,
    state: State<AgentState>,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<Vec<(String, String)>>,
) -> Result<(), String> {
    let mut slot = state.0.lock().expect("agent state");
    if slot.is_some() {
        return Err("agent already running".into());
    }

    let out_app = app.clone();
    let err_app = app.clone();
    let exit_app = app.clone();
    let handle = spawn_agent(
        &command,
        &args,
        cwd.as_deref(),
        &env.unwrap_or_default(),
        move |line| {
            let _ = out_app.emit("agent-stdout", line);
        },
        move |line| {
            let _ = err_app.emit("agent-stderr", line);
        },
        move |code| {
            let _ = exit_app.emit("agent-exit", code);
        },
    )
    .map_err(|e| format!("failed to spawn agent: {e}"))?;

    *slot = Some(handle);
    Ok(())
}

/// Write one line to the agent's stdin (the caller supplies a complete
/// JSON-RPC message; the newline framing is added here).
#[tauri::command]
fn agent_send(state: State<AgentState>, line: String) -> Result<(), String> {
    let slot = state.0.lock().expect("agent state");
    match slot.as_ref() {
        Some(handle) => handle.write_line(&line).map_err(|e| e.to_string()),
        None => Err("agent not running".into()),
    }
}

/// Stop the agent (cooperative close then kill). Idempotent.
#[tauri::command]
fn agent_stop(state: State<AgentState>) {
    if let Some(handle) = state.0.lock().expect("agent state").take() {
        handle.shutdown();
    }
}

/// Resolve where the engine's `dist/index.js` lives.
///
/// Order: the `CLAUDE_TAURI_ENGINE` env var, then the dev default (the engine
/// built in the parent repo checkout). Returns `None` if neither resolves — the
/// frontend then surfaces a clear "set CLAUDE_TAURI_ENGINE" error. A packaged
/// build has no bundled engine, so the env var is required there (until the M6
/// settings UI lets it be configured).
#[tauri::command]
fn default_engine_path() -> Option<String> {
    if let Ok(path) = std::env::var("CLAUDE_TAURI_ENGINE") {
        if !path.is_empty() {
            return Some(path);
        }
    }
    // src-tauri/ -> claude-tauri/ -> repo root; engine is <repo>/dist/index.js.
    let dev = concat!(env!("CARGO_MANIFEST_DIR"), "/../../dist/index.js");
    std::fs::canonicalize(dev)
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
}

/// Pick the directory that holds chats with no project: a non-blank override
/// wins, otherwise `chats` inside the app's data directory.
///
/// The path must be absolute because ACP requires an absolute `cwd`, and because
/// the frontend compares it against the directories `session/list` reports to
/// decide which chats are project-less.
fn resolve_chats_dir(custom: Option<&str>, app_data: &Path) -> Result<PathBuf, String> {
    match custom.map(str::trim).filter(|path| !path.is_empty()) {
        Some(path) => {
            let dir = PathBuf::from(path);
            if !dir.is_absolute() {
                return Err(format!(
                    "the chats directory must be an absolute path, got \"{path}\""
                ));
            }
            Ok(dir)
        }
        None => Ok(app_data.join("chats")),
    }
}

/// Create the chats directory if it is missing and return its path.
fn create_chats_dir(dir: &Path) -> Result<String, String> {
    std::fs::create_dir_all(dir).map_err(|error| {
        format!("could not create the chats directory {}: {error}", dir.display())
    })?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Resolve and create the directory that holds chats with no project.
///
/// Every ACP session needs a `cwd`, so "a chat without a project" is really a
/// chat rooted in one designated directory. Defaulting it to an app-owned empty
/// folder keeps file tools working while nothing of the user's leaks in and no
/// stray `CLAUDE.md` changes how the agent behaves.
#[tauri::command]
fn ensure_chats_dir(app: AppHandle, custom: Option<String>) -> Result<String, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("could not locate the app data directory: {error}"))?;
    let dir = resolve_chats_dir(custom.as_deref(), &app_data)?;
    create_chats_dir(&dir)
}

/// Run Claude's browser-based subscription login through the configured engine.
/// The command returns after the browser flow completes and credentials have
/// been written to Claude's normal credential store.
#[tauri::command]
async fn claude_login(
    command: String,
    args: Vec<String>,
    env: Option<Vec<(String, String)>>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut login = Command::new(command);
        login.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        for (key, value) in env.unwrap_or_default() {
            login.env(key, value);
        }

        let output = login
            .output()
            .map_err(|error| format!("could not start Claude login: {error}"))?;
        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        Err(if detail.is_empty() {
            format!("Claude login exited with status {}", output.status)
        } else {
            format!("Claude login failed: {detail}")
        })
    })
    .await
    .map_err(|error| format!("Claude login task failed: {error}"))?
}

/// The subset of the engine's JSON `auth status` response that the settings UI
/// needs. The CLI does not expose an email address, so this reports the
/// verified sign-in state without reading credential files.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeAuthStatus {
    logged_in: bool,
}

/// Check whether the configured engine can currently use Claude credentials.
/// It follows the same Node, engine-path, and environment configuration as
/// `claude_login`, avoiding a result from a different shell environment.
#[tauri::command]
async fn claude_auth_status(
    command: String,
    args: Vec<String>,
    env: Option<Vec<(String, String)>>,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut status = Command::new(command);
        status.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        for (key, value) in env.unwrap_or_default() {
            status.env(key, value);
        }

        let output = status
            .output()
            .map_err(|error| format!("could not check Claude sign-in: {error}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            return Err(if detail.is_empty() {
                format!("Claude sign-in check exited with status {}", output.status)
            } else {
                format!("Claude sign-in check failed: {detail}")
            });
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let auth: ClaudeAuthStatus = serde_json::from_str(&stdout)
            .map_err(|error| format!("could not read Claude sign-in status: {error}"))?;
        Ok(auth.logged_in)
    })
    .await
    .map_err(|error| format!("Claude sign-in check task failed: {error}"))?
}

/// Kill the agent when the app is tearing down so no `node` child is orphaned.
fn stop_agent(app: &AppHandle) {
    if let Some(handle) = app.state::<AgentState>().0.lock().expect("agent state").take() {
        handle.shutdown();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A unique scratch path per test, so the suite can run in parallel.
    fn scratch(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("claude-tauri-{name}-{}", std::process::id()))
    }

    #[test]
    fn defaults_the_chats_dir_under_the_app_data_dir() {
        let dir = resolve_chats_dir(None, Path::new("/data/app")).expect("resolve");
        assert_eq!(dir, PathBuf::from("/data/app/chats"));
    }

    #[test]
    fn an_absolute_override_wins_over_the_default() {
        let dir = resolve_chats_dir(Some("  /elsewhere/chats  "), Path::new("/data/app"))
            .expect("resolve");
        assert_eq!(dir, PathBuf::from("/elsewhere/chats"));
    }

    #[test]
    fn a_blank_override_falls_back_to_the_default() {
        for blank in ["", "   "] {
            let dir = resolve_chats_dir(Some(blank), Path::new("/data/app")).expect("resolve");
            assert_eq!(dir, PathBuf::from("/data/app/chats"));
        }
    }

    #[test]
    fn a_relative_override_is_rejected() {
        let error = resolve_chats_dir(Some("chats"), Path::new("/data/app")).expect_err("relative");
        assert!(error.contains("absolute"), "{error}");
    }

    #[test]
    fn creates_the_chats_dir_and_is_idempotent() {
        let root = scratch("create");
        let dir = root.join("nested").join("chats");
        let _ = std::fs::remove_dir_all(&root);

        let path = create_chats_dir(&dir).expect("create");
        assert!(dir.is_dir());
        assert_eq!(path, dir.to_string_lossy());

        // A second call on an existing directory must succeed unchanged.
        assert_eq!(create_chats_dir(&dir).expect("recreate"), path);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn reports_a_chats_dir_that_cannot_be_created() {
        let root = scratch("blocked");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("root");
        // A file where a directory needs to be: create_dir_all cannot proceed.
        let blocker = root.join("chats");
        std::fs::write(&blocker, b"not a directory").expect("blocker");

        let error = create_chats_dir(&blocker.join("inner")).expect_err("blocked");
        assert!(error.contains("could not create the chats directory"), "{error}");

        let _ = std::fs::remove_dir_all(&root);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AgentState::default())
        .invoke_handler(tauri::generate_handler![
            agent_start,
            agent_send,
            agent_stop,
            default_engine_path,
            ensure_chats_dir,
            claude_login,
            claude_auth_status
        ])
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                stop_agent(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        // Belt-and-suspenders: also stop the agent when the app itself exits,
        // covering quit paths that do not fire a window Destroyed event.
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                stop_agent(app);
            }
        });
}
