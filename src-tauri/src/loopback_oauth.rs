//! RFC 8252 loopback listener for Mac Google / Apple sign-in.
//!
//! Binds `127.0.0.1:<ephemeral>` so Safari on *this* machine can deliver the
//! one-time token. An attacker who phished the start URL cannot receive that
//! redirect: it never leaves the victim's host.

#[cfg(target_os = "macos")]
use std::io::{Read, Write};
#[cfg(target_os = "macos")]
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(target_os = "macos")]
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Mutex, OnceLock};
#[cfg(target_os = "macos")]
use std::time::Duration;

#[cfg(target_os = "macos")]
struct LoopbackSlot {
  rx: Option<Receiver<String>>,
  cancel: std::sync::Arc<AtomicBool>,
}

#[cfg(not(target_os = "macos"))]
struct LoopbackSlot {
  cancel: std::sync::Arc<AtomicBool>,
}

static SLOT: OnceLock<Mutex<Option<LoopbackSlot>>> = OnceLock::new();

fn slot() -> &'static Mutex<Option<LoopbackSlot>> {
  SLOT.get_or_init(|| Mutex::new(None))
}

fn cancel_current() {
  if let Ok(mut guard) = slot().lock() {
    if let Some(current) = guard.take() {
      current.cancel.store(true, Ordering::SeqCst);
    }
  }
}

#[cfg(target_os = "macos")]
fn parse_request_target(first_line: &str) -> Option<String> {
  let mut parts = first_line.split_whitespace();
  let method = parts.next()?;
  let target = parts.next()?;
  if !method.eq_ignore_ascii_case("GET") {
    return None;
  }
  let path = target.split('?').next().unwrap_or(target);
  if path != "/auth-callback" {
    return None;
  }
  Some(target.to_string())
}

#[cfg(target_os = "macos")]
fn write_response(stream: &mut TcpStream, status: &str, body: &str) {
  let _ = write!(
    stream,
    "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{body}",
    body.len()
  );
  let _ = stream.flush();
}

#[cfg(target_os = "macos")]
fn serve(listener: TcpListener, port: u16, tx: Sender<String>, cancel: std::sync::Arc<AtomicBool>) {
  listener.set_nonblocking(true).ok();
  while !cancel.load(Ordering::SeqCst) {
    match listener.accept() {
      Ok((mut stream, _)) => {
        stream.set_nonblocking(false).ok();
        stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
        let mut buf = [0u8; 8192];
        let n = stream.read(&mut buf).unwrap_or(0);
        let req = String::from_utf8_lossy(&buf[..n]);
        let first = req.lines().next().unwrap_or("");
        match parse_request_target(first) {
          Some(target) => {
            write_response(
              &mut stream,
              "200 OK",
              "<!doctype html><title>Dayspring</title><p>You can close this window.</p>",
            );
            let _ = tx.send(format!("http://127.0.0.1:{port}{target}"));
            return;
          }
          None => {
            write_response(&mut stream, "404 Not Found", "<!doctype html><p>Not found.</p>");
          }
        }
      }
      Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
        std::thread::sleep(Duration::from_millis(50));
      }
      Err(_) => return,
    }
  }
}

/// Bind `127.0.0.1:0` and return the chosen port. Cancels any previous listener.
#[tauri::command]
pub fn begin_loopback_oauth() -> Result<u16, String> {
  #[cfg(not(target_os = "macos"))]
  {
    return Err("begin_loopback_oauth is macOS-only".into());
  }

  #[cfg(target_os = "macos")]
  {
    cancel_current();
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|err| err.to_string())?;
    let port = listener.local_addr().map_err(|err| err.to_string())?.port();
    if port < 1024 {
      return Err("loopback port too low".into());
    }
    let (tx, rx) = mpsc::channel();
    let cancel = std::sync::Arc::new(AtomicBool::new(false));
    let cancel_thread = cancel.clone();
    std::thread::Builder::new()
      .name("dayspring-oauth-loopback".into())
      .spawn(move || serve(listener, port, tx, cancel_thread))
      .map_err(|err| err.to_string())?;
    let mut guard = slot().lock().map_err(|err| err.to_string())?;
    *guard = Some(LoopbackSlot {
      rx: Some(rx),
      cancel,
    });
    Ok(port)
  }
}

#[tauri::command]
pub async fn wait_loopback_oauth(timeout_ms: u64) -> Result<String, String> {
  #[cfg(not(target_os = "macos"))]
  {
    let _ = timeout_ms;
    return Err("wait_loopback_oauth is macOS-only".into());
  }

  #[cfg(target_os = "macos")]
  {
    let timeout = Duration::from_millis(timeout_ms.clamp(1, 5 * 60 * 1000));
    let rx = {
      let mut guard = slot().lock().map_err(|err| err.to_string())?;
      guard
        .as_mut()
        .and_then(|current| current.rx.take())
        .ok_or_else(|| "no loopback listener".to_string())?
    };
    tauri::async_runtime::spawn_blocking(move || {
      rx.recv_timeout(timeout).map_err(|_| "loopback timed out".to_string())
    })
    .await
    .map_err(|err| err.to_string())?
  }
}

#[tauri::command]
pub fn cancel_loopback_oauth() {
  cancel_current();
}
