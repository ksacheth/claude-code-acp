//! Agent subprocess bridge.
//!
//! Owns the lifecycle of the spawned ACP agent (`node dist/index.js`) and is
//! deliberately protocol-unaware: it moves raw newline-delimited lines in and
//! out. The ACP client itself lives in the TypeScript frontend.
//!
//! Shutdown is cooperative first: closing the child's stdin makes the engine
//! exit on EOF (see the engine's `src/index.ts`, which resumes stdin and shuts
//! down when the ACP connection closes). A hard kill is only the backstop if
//! the child does not leave within a grace window.

use std::io::{self, BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

/// How long `shutdown` waits for a cooperative exit before hard-killing.
const SHUTDOWN_GRACE: Duration = Duration::from_millis(1000);
/// Polling granularity for exit detection.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// A live agent subprocess with its stdout/stderr wired to callbacks.
pub struct AgentHandle {
    child: Arc<Mutex<Child>>,
    /// `None` once stdin has been closed (either by `shutdown` or `close_stdin`).
    stdin: Mutex<Option<ChildStdin>>,
}

/// Spawn `program args...` with piped stdio, streaming each stdout/stderr line
/// to the corresponding callback and reporting the exit code once (if any).
///
/// The callbacks run on dedicated reader threads and must be `Send`.
pub fn spawn_agent(
    program: &str,
    args: &[String],
    cwd: Option<&str>,
    on_stdout: impl Fn(String) + Send + 'static,
    on_stderr: impl Fn(String) + Send + 'static,
    on_exit: impl Fn(Option<i32>) + Send + 'static,
) -> io::Result<AgentHandle> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let mut child = cmd.spawn()?;
    let stdin = child.stdin.take().expect("stdin piped");
    let stdout = child.stdout.take().expect("stdout piped");
    let stderr = child.stderr.take().expect("stderr piped");
    let child = Arc::new(Mutex::new(child));

    thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            match line {
                Ok(l) => on_stdout(l),
                Err(_) => break,
            }
        }
    });

    thread::spawn(move || {
        for line in BufReader::new(stderr).lines() {
            match line {
                Ok(l) => on_stderr(l),
                Err(_) => break,
            }
        }
    });

    // Exit watcher: polls with `try_wait` so it never holds the lock across a
    // blocking `wait`, leaving `write_line`/`shutdown` free to acquire it.
    let watched = Arc::clone(&child);
    thread::spawn(move || loop {
        let status = watched.lock().expect("child mutex").try_wait();
        match status {
            Ok(Some(s)) => {
                on_exit(s.code());
                break;
            }
            Ok(None) => thread::sleep(POLL_INTERVAL),
            Err(_) => {
                on_exit(None);
                break;
            }
        }
    });

    Ok(AgentHandle {
        child,
        stdin: Mutex::new(Some(stdin)),
    })
}

impl AgentHandle {
    /// Write one newline-terminated line to the agent's stdin.
    pub fn write_line(&self, line: &str) -> io::Result<()> {
        let mut guard = self.stdin.lock().expect("stdin mutex");
        match guard.as_mut() {
            Some(stdin) => {
                stdin.write_all(line.as_bytes())?;
                stdin.write_all(b"\n")?;
                stdin.flush()
            }
            None => Err(io::Error::new(
                io::ErrorKind::BrokenPipe,
                "agent stdin is closed",
            )),
        }
    }

    /// Close stdin so the engine sees EOF and can exit cleanly. Idempotent.
    fn close_stdin(&self) {
        self.stdin.lock().expect("stdin mutex").take();
    }

    /// True once the child has been reaped.
    fn has_exited(&self) -> bool {
        matches!(
            self.child.lock().expect("child mutex").try_wait(),
            Ok(Some(_))
        )
    }

    /// Terminate the agent: close stdin (cooperative), wait out the grace
    /// window, then hard-kill as a backstop. Safe to call more than once.
    pub fn shutdown(&self) {
        self.close_stdin();

        let deadline_polls = SHUTDOWN_GRACE.as_millis() / POLL_INTERVAL.as_millis();
        for _ in 0..deadline_polls {
            if self.has_exited() {
                return;
            }
            thread::sleep(POLL_INTERVAL);
        }

        let mut child = self.child.lock().expect("child mutex");
        let _ = child.kill();
        let _ = child.wait();
    }
}

impl Drop for AgentHandle {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::channel;

    /// Spawn `node -e <script>` for a hermetic test child. `node` is a hard
    /// dependency of the engine, so it is guaranteed present.
    fn node(script: &str) -> Vec<String> {
        vec!["-e".to_string(), script.to_string()]
    }

    fn noop_stderr() -> impl Fn(String) + Send + 'static {
        |_| {}
    }

    #[test]
    fn streams_stdout_lines_and_writes_stdin() {
        // Echo each received line back prefixed, line-buffered.
        let script = r#"
            let buf = '';
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', d => {
              buf += d;
              let i;
              while ((i = buf.indexOf('\n')) >= 0) {
                const line = buf.slice(0, i);
                buf = buf.slice(i + 1);
                process.stdout.write('echo:' + line + '\n');
              }
            });
        "#;
        let (tx, rx) = channel();
        let handle = spawn_agent(
            "node",
            &node(script),
            None,
            move |line| tx.send(line).unwrap(),
            noop_stderr(),
            |_| {},
        )
        .expect("spawn");

        handle.write_line("hello").expect("write");
        let got = rx.recv_timeout(Duration::from_secs(5)).expect("stdout line");
        assert_eq!(got, "echo:hello");

        handle.shutdown();
    }

    #[test]
    fn closing_stdin_triggers_cooperative_exit() {
        // Exits with code 7 the moment stdin reaches EOF — no kill needed.
        let script = "process.stdin.on('end', () => process.exit(7)); process.stdin.resume();";
        let (tx, rx) = channel();
        let handle = spawn_agent(
            "node",
            &node(script),
            None,
            |_| {},
            noop_stderr(),
            move |code| tx.send(code).unwrap(),
        )
        .expect("spawn");

        handle.shutdown();
        let code = rx.recv_timeout(Duration::from_secs(5)).expect("exit event");
        assert_eq!(code, Some(7), "engine should exit cleanly on stdin EOF");
    }

    #[test]
    fn shutdown_hard_kills_uncooperative_child() {
        // Ignores stdin EOF and runs forever; only a kill stops it.
        let script = "process.stdin.resume(); setInterval(() => {}, 1000);";
        let (tx, rx) = channel();
        let handle = spawn_agent(
            "node",
            &node(script),
            None,
            |_| {},
            noop_stderr(),
            move |code| tx.send(code).unwrap(),
        )
        .expect("spawn");

        handle.shutdown();
        assert!(handle.has_exited(), "child must be reaped after shutdown");
        // Exit watcher still reports the (kill-induced) termination.
        rx.recv_timeout(Duration::from_secs(5))
            .expect("exit event after kill");
    }

    #[test]
    fn write_line_fails_after_shutdown() {
        let script = "process.stdin.resume();";
        let handle = spawn_agent("node", &node(script), None, |_| {}, noop_stderr(), |_| {})
            .expect("spawn");
        handle.shutdown();
        assert!(
            handle.write_line("nope").is_err(),
            "writing to a closed agent must error, not panic"
        );
    }

    /// End-to-end against the real ACP engine: the bridge must carry a genuine
    /// `initialize` request out and the agent's JSON-RPC response back. Skipped
    /// automatically if the engine has not been built.
    #[test]
    fn real_engine_initialize_handshake() {
        // src-tauri/ -> repo root (claude-tauri) -> engine root -> dist/index.js
        let engine = concat!(env!("CARGO_MANIFEST_DIR"), "/../../dist/index.js");
        if !std::path::Path::new(engine).exists() {
            eprintln!("skipping: engine not built at {engine}");
            return;
        }

        let (tx, rx) = channel();
        let handle = spawn_agent(
            "node",
            &[engine.to_string()],
            None,
            move |line| {
                let _ = tx.send(line);
            },
            noop_stderr(),
            |_| {},
        )
        .expect("spawn engine");

        let request = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{}}}"#;
        handle.write_line(request).expect("write initialize");

        // Read stdout lines until the response to id=1 arrives.
        let deadline = std::time::Instant::now() + Duration::from_secs(20);
        let mut response = None;
        while std::time::Instant::now() < deadline {
            match rx.recv_timeout(Duration::from_secs(2)) {
                Ok(line) => {
                    let v: serde_json::Value = match serde_json::from_str(&line) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    if v.get("id") == Some(&serde_json::json!(1)) && v.get("result").is_some() {
                        response = Some(v);
                        break;
                    }
                }
                Err(_) => continue,
            }
        }
        handle.shutdown();

        let response = response.expect("initialize response from real engine");
        assert_eq!(response["result"]["protocolVersion"], serde_json::json!(1));
        assert!(
            response["result"]["agentInfo"]["name"].is_string(),
            "expected agentInfo.name in initialize result, got {response}"
        );
    }
}
