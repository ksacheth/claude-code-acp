mod process;

use std::process::{Command, Stdio};
use std::sync::Mutex;

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

/// Kill the agent when the app is tearing down so no `node` child is orphaned.
fn stop_agent(app: &AppHandle) {
    if let Some(handle) = app.state::<AgentState>().0.lock().expect("agent state").take() {
        handle.shutdown();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AgentState::default())
        .invoke_handler(tauri::generate_handler![
            agent_start,
            agent_send,
            agent_stop,
            default_engine_path,
            claude_login
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
