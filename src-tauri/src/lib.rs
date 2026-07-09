mod process;

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use process::{spawn_agent, AgentHandle};

/// The single live agent process for the app (M0 is single-session).
#[derive(Default)]
struct AgentState(Mutex<Option<AgentHandle>>);

/// Start the agent subprocess. `command` is the executable (e.g. `node`) and
/// `args` its arguments (e.g. the engine's `dist/index.js` path). Stdout,
/// stderr, and exit are forwarded to the webview as `agent-stdout`,
/// `agent-stderr`, and `agent-exit` events.
#[tauri::command]
fn agent_start(
    app: AppHandle,
    state: State<AgentState>,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
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
        .manage(AgentState::default())
        .invoke_handler(tauri::generate_handler![agent_start, agent_send, agent_stop])
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                stop_agent(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
