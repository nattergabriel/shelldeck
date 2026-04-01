use std::{
    collections::HashMap,
    io::Read,
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc,
    },
};

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tokio::sync::{Mutex, RwLock};

/// Opaque handle returned to the frontend to identify a PTY session.
type PtyHandler = u32;

/// Read buffer size for PTY output.
const READ_BUF_SIZE: usize = 4096;

#[derive(Default)]
pub struct PtyState {
    next_id: AtomicU32,
    sessions: RwLock<HashMap<PtyHandler, Arc<Session>>>,
}

struct Session {
    /// The PTY master handle, used for resize operations.
    master: Mutex<Box<dyn MasterPty + Send>>,
    /// Cloned killer handle for terminating the child process.
    killer: Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>,
    /// Writer end of the PTY master for sending input.
    writer: Mutex<Box<dyn std::io::Write + Send>>,
    /// Reader end of the PTY master for receiving output.
    /// Uses std::sync::Mutex because reads are blocking and run inside spawn_blocking.
    reader: std::sync::Mutex<Box<dyn Read + Send>>,
    /// The child process handle, used for waiting on exit status.
    /// Uses std::sync::Mutex because wait() blocks and runs inside spawn_blocking.
    /// Wrapped in Option because it is taken once wait() completes.
    child: std::sync::Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>,
}

fn get_session(
    sessions: &HashMap<PtyHandler, Arc<Session>>,
    id: PtyHandler,
) -> Result<Arc<Session>, String> {
    sessions
        .get(&id)
        .cloned()
        .ok_or_else(|| format!("No PTY session with id {id}"))
}

#[tauri::command]
pub async fn pty_spawn(
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    state: tauri::State<'_, PtyState>,
) -> Result<PtyHandler, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {e}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {e}"))?;

    let mut cmd = CommandBuilder::new_default_prog();
    if let Some(cwd) = cwd {
        cmd.cwd(cwd);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {e}"))?;
    let killer = child.clone_killer();
    let id = state.next_id.fetch_add(1, Ordering::Relaxed);

    let session = Arc::new(Session {
        master: Mutex::new(pair.master),
        killer: Mutex::new(killer),
        writer: Mutex::new(writer),
        reader: std::sync::Mutex::new(reader),
        child: std::sync::Mutex::new(Some(child)),
    });

    state.sessions.write().await.insert(id, session);
    Ok(id)
}

#[tauri::command]
pub async fn pty_write(
    pid: PtyHandler,
    data: String,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let session = get_session(&*state.sessions.read().await, pid)?;
    let mut writer = session.writer.lock().await;
    use std::io::Write;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {e}"))
}

#[tauri::command]
pub async fn pty_read(
    pid: PtyHandler,
    state: tauri::State<'_, PtyState>,
) -> Result<Option<Vec<u8>>, String> {
    let session = get_session(&*state.sessions.read().await, pid)?;

    tokio::task::spawn_blocking(move || {
        let mut reader = session
            .reader
            .lock()
            .map_err(|e| format!("Reader lock poisoned: {e}"))?;
        let mut buf = vec![0u8; READ_BUF_SIZE];
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("Failed to read from PTY: {e}"))?;
        if n == 0 {
            Ok(None)
        } else {
            buf.truncate(n);
            Ok(Some(buf))
        }
    })
    .await
    .map_err(|e| format!("Read task failed: {e}"))?
}

#[tauri::command]
pub async fn pty_resize(
    pid: PtyHandler,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let session = get_session(&*state.sessions.read().await, pid)?;
    let master = session.master.lock().await;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {e}"))
}

#[tauri::command]
pub async fn pty_kill(
    pid: PtyHandler,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let session = get_session(&*state.sessions.read().await, pid)?;
    let mut killer = session.killer.lock().await;
    killer
        .kill()
        .map_err(|e| format!("Failed to kill PTY process: {e}"))
}

#[tauri::command]
pub async fn pty_exitstatus(
    pid: PtyHandler,
    state: tauri::State<'_, PtyState>,
) -> Result<u32, String> {
    let session = get_session(&*state.sessions.read().await, pid)?;

    tokio::task::spawn_blocking(move || {
        let mut guard = session
            .child
            .lock()
            .map_err(|e| format!("Child lock poisoned: {e}"))?;
        let mut child = guard.take().ok_or("Child process already consumed")?;
        let status = child
            .wait()
            .map_err(|e| format!("Failed to wait for child process: {e}"))?;
        Ok(status.exit_code())
    })
    .await
    .map_err(|e| format!("Exit status task failed: {e}"))?
}

/// Remove a finished session from the session map, releasing all resources.
#[tauri::command]
pub async fn pty_cleanup(
    pid: PtyHandler,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    state
        .sessions
        .write()
        .await
        .remove(&pid)
        .ok_or_else(|| format!("No PTY session with id {pid}"))?;
    Ok(())
}
