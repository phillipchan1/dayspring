//! RFC 8252 loopback listener for Mac Google / Apple sign-in.
//!
//! Binds `127.0.0.1:<ephemeral>` so Safari on *this* machine can deliver the
//! one-time token. The path carries a 128-bit unguessable state
//! (`/auth-callback/<32 hex>`); a mismatch or missing state is 404 and the
//! listener stays up. An attacker who phished the start URL, or any page that
//! sprays loopback ports, cannot complete sign-in without that state.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

const STATE_LEN: usize = 32;
const MAX_REQUEST_BYTES: usize = 16 * 1024;

struct LoopbackSlot {
  rx: Option<Receiver<String>>,
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

fn valid_state(value: &str) -> bool {
  value.len() == STATE_LEN && value.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// Constant-time equality for equal-length slices. Length is public (always 32).
fn constant_time_eq(a: &str, b: &str) -> bool {
  let left = a.as_bytes();
  let right = b.as_bytes();
  if left.len() != right.len() {
    return false;
  }
  let mut diff = 0u8;
  for i in 0..left.len() {
    diff |= left[i] ^ right[i];
  }
  diff == 0
}

fn percent_decode(raw: &str) -> String {
  let bytes = raw.as_bytes();
  let mut out = Vec::with_capacity(bytes.len());
  let mut i = 0;
  while i < bytes.len() {
    match bytes[i] {
      b'+' => {
        out.push(b' ');
        i += 1;
      }
      b'%' if i + 2 < bytes.len() => {
        let hex = &raw[i + 1..i + 3];
        if let Ok(value) = u8::from_str_radix(hex, 16) {
          out.push(value);
          i += 3;
        } else {
          out.push(b'%');
          i += 1;
        }
      }
      byte => {
        out.push(byte);
        i += 1;
      }
    }
  }
  String::from_utf8_lossy(&out).into_owned()
}

fn query_param(source: &str, name: &str) -> Option<String> {
  let encoded = source.split('&').find_map(|pair| {
    let (key, value) = pair.split_once('=')?;
    if key == name {
      Some(value.to_string())
    } else {
      None
    }
  })?;
  let decoded = percent_decode(&encoded);
  if decoded.is_empty() {
    None
  } else {
    Some(decoded)
  }
}

fn content_length(headers: &str) -> usize {
  for line in headers.lines() {
    let line = line.trim();
    if let Some(rest) = line.strip_prefix("Content-Length:") {
      return rest.trim().parse().unwrap_or(0);
    }
    if let Some(rest) = line.strip_prefix("content-length:") {
      return rest.trim().parse().unwrap_or(0);
    }
  }
  0
}

fn read_request(stream: &mut TcpStream) -> Option<String> {
  stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
  let mut buf = Vec::new();
  let mut tmp = [0u8; 1024];
  loop {
    if buf.len() >= MAX_REQUEST_BYTES {
      break;
    }
    match stream.read(&mut tmp) {
      Ok(0) => break,
      Ok(n) => {
        let take = n.min(MAX_REQUEST_BYTES.saturating_sub(buf.len()));
        buf.extend_from_slice(&tmp[..take]);
        if let Some(header_end) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
          let headers = std::str::from_utf8(&buf[..header_end]).ok()?;
          let len = content_length(headers);
          if buf.len() >= header_end + 4 + len {
            break;
          }
        }
      }
      Err(err)
        if err.kind() == std::io::ErrorKind::WouldBlock
          || err.kind() == std::io::ErrorKind::TimedOut =>
      {
        break;
      }
      Err(_) => return None,
    }
  }
  Some(String::from_utf8_lossy(&buf).into_owned())
}

/// Parse `/auth-callback/<32 hex>` off the request-target path. Query is ignored here.
fn path_state(target: &str) -> Option<&str> {
  let path = target.split('?').next().unwrap_or(target);
  let rest = path.strip_prefix("/auth-callback/")?;
  if rest.contains('/') {
    return None;
  }
  if !valid_state(rest) {
    return None;
  }
  Some(rest)
}

struct ValidHit {
  callback: String,
}

/// A valid hit is the expected state in the path (constant-time) plus a `code`
/// or `error` in the query (GET) or form body (POST). Anything else is ignored.
fn valid_hit(req: &str, expected_state: &str, port: u16) -> Option<ValidHit> {
  let first = req.lines().next()?.trim();
  let mut parts = first.split_whitespace();
  let method = parts.next()?;
  let target = parts.next()?;
  if !method.eq_ignore_ascii_case("GET") && !method.eq_ignore_ascii_case("POST") {
    return None;
  }
  let got = path_state(target)?;
  if !constant_time_eq(got, expected_state) {
    return None;
  }
  let header_end = req.find("\r\n\r\n").unwrap_or(req.len());
  let query = target.split_once('?').map(|(_, q)| q).unwrap_or("");
  let body = req.get(header_end.saturating_add(4)..).unwrap_or("");
  let code = query_param(query, "code").or_else(|| query_param(body, "code"));
  let error = query_param(query, "error").or_else(|| query_param(body, "error"));
  let mut params = Vec::new();
  if let Some(value) = error {
    params.push(format!("error={}", urlencoding_encode(&value)));
  } else if let Some(value) = code {
    params.push(format!("code={}", urlencoding_encode(&value)));
  } else {
    return None;
  }
  Some(ValidHit {
    callback: format!(
      "http://127.0.0.1:{port}/auth-callback/{expected_state}?{}",
      params.join("&")
    ),
  })
}

fn urlencoding_encode(value: &str) -> String {
  let mut out = String::new();
  for byte in value.bytes() {
    match byte {
      b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
        out.push(byte as char);
      }
      _ => out.push_str(&format!("%{byte:02X}")),
    }
  }
  out
}

fn write_response(stream: &mut TcpStream, status: &str, body: &str) {
  let _ = write!(
    stream,
    "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{body}",
    body.len()
  );
  let _ = stream.flush();
}

fn serve(
  listener: TcpListener,
  port: u16,
  expected_state: String,
  tx: Sender<String>,
  cancel: std::sync::Arc<AtomicBool>,
) {
  listener.set_nonblocking(true).ok();
  while !cancel.load(Ordering::SeqCst) {
    match listener.accept() {
      Ok((mut stream, _)) => {
        stream.set_nonblocking(false).ok();
        let req = read_request(&mut stream).unwrap_or_default();
        if let Some(hit) = valid_hit(&req, &expected_state, port) {
          write_response(
            &mut stream,
            "200 OK",
            "<!doctype html><title>Dayspring</title><p>You can close this window.</p>",
          );
          let _ = tx.send(hit.callback);
          return;
        }
        write_response(&mut stream, "404 Not Found", "<!doctype html><p>Not found.</p>");
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
pub fn begin_loopback_oauth(state: String) -> Result<u16, String> {
  if !valid_state(&state) {
    return Err("invalid loopback state".into());
  }
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
    .spawn(move || serve(listener, port, state, tx, cancel_thread))
    .map_err(|err| err.to_string())?;
  let mut guard = slot().lock().map_err(|err| err.to_string())?;
  *guard = Some(LoopbackSlot {
    rx: Some(rx),
    cancel,
  });
  Ok(port)
}

#[tauri::command]
pub async fn wait_loopback_oauth(timeout_ms: u64) -> Result<String, String> {
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

#[tauri::command]
pub fn cancel_loopback_oauth() {
  cancel_current();
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Write;
  use std::net::TcpStream;

  const STATE: &str = "0123456789abcdef0123456789abcdef";
  const WRONG: &str = "ffffffffffffffffffffffffffffffff";

  fn exchange(port: u16, request: &str) -> String {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("connect");
    stream
      .set_read_timeout(Some(Duration::from_secs(2)))
      .ok();
    stream
      .set_write_timeout(Some(Duration::from_secs(2)))
      .ok();
    stream.write_all(request.as_bytes()).expect("write");
    let _ = stream.flush();
    let mut buf = Vec::new();
    let mut tmp = [0u8; 1024];
    loop {
      match stream.read(&mut tmp) {
        Ok(0) => break,
        Ok(n) => buf.extend_from_slice(&tmp[..n]),
        Err(_) => break,
      }
    }
    String::from_utf8_lossy(&buf).into_owned()
  }

  fn status_line(response: &str) -> &str {
    response.lines().next().unwrap_or("")
  }

  #[test]
  fn constant_time_eq_matches_equal_hex() {
    assert!(constant_time_eq(STATE, STATE));
    assert!(!constant_time_eq(STATE, WRONG));
    assert!(!constant_time_eq(STATE, "abc"));
  }

  #[test]
  fn wrong_or_missing_state_is_ignored_and_the_listener_stays_up() {
    let port = begin_loopback_oauth(STATE.to_string()).expect("bind");

    let missing = exchange(
      port,
      &format!(
        "GET /auth-callback?code=attacker HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
      ),
    );
    assert!(
      status_line(&missing).starts_with("HTTP/1.1 404"),
      "missing state must 404, got {missing:?}"
    );

    let wrong = exchange(
      port,
      &format!(
        "GET /auth-callback/{WRONG}?code=attacker HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
      ),
    );
    assert!(
      status_line(&wrong).starts_with("HTTP/1.1 404"),
      "wrong state must 404, got {wrong:?}"
    );

    let still_up = exchange(
      port,
      &format!(
        "GET /auth-callback HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
      ),
    );
    assert!(
      status_line(&still_up).starts_with("HTTP/1.1 404"),
      "listener must stay up after junk, got {still_up:?}"
    );

    let body = "code=good-token";
    let valid = exchange(
      port,
      &format!(
        "POST /auth-callback/{STATE} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
      ),
    );
    assert!(
      status_line(&valid).starts_with("HTTP/1.1 200"),
      "matching state must close, got {valid:?}"
    );

    std::thread::sleep(Duration::from_millis(100));
    let closed = TcpStream::connect(("127.0.0.1", port));
    assert!(
      closed.is_err(),
      "listener must close only after one valid hit"
    );

    cancel_loopback_oauth();
  }

  #[test]
  fn valid_hit_reconstructs_code_without_accepting_wrong_state() {
    let req = format!(
      "POST /auth-callback/{STATE} HTTP/1.1\r\nHost: 127.0.0.1:54721\r\n\r\ncode=ott-1"
    );
    let hit = valid_hit(&req, STATE, 54721).expect("valid");
    assert_eq!(
      hit.callback,
      "http://127.0.0.1:54721/auth-callback/0123456789abcdef0123456789abcdef?code=ott-1"
    );
    assert!(valid_hit(&req, WRONG, 54721).is_none());

    let missing = "GET /auth-callback?code=ott-1 HTTP/1.1\r\nHost: 127.0.0.1:54721\r\n\r\n";
    assert!(valid_hit(missing, STATE, 54721).is_none());
  }
}
