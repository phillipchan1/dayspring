//! In-app OAuth on iOS via ASWebAuthenticationSession.
//!
//! App Store Guideline 4 rejects handing sign-in to the system Safari app.
//! ASWebAuthenticationSession presents provider login in a secure in-app sheet
//! (SFSafariViewController under the hood) and returns the callback URL to us.

#[cfg(target_os = "ios")]
use std::sync::{mpsc, OnceLock};
#[cfg(target_os = "ios")]
use std::sync::{Arc, Mutex};

#[cfg(target_os = "ios")]
use block2::RcBlock;
#[cfg(target_os = "ios")]
use objc2::rc::{Allocated, Retained};
#[cfg(target_os = "ios")]
use objc2::runtime::{AnyClass, AnyObject, ClassBuilder, NSObject, Sel};
#[cfg(target_os = "ios")]
use objc2::{msg_send, sel, AnyThread, ClassType, MainThreadMarker, ProtocolType};
#[cfg(target_os = "ios")]
use objc2_authentication_services::{
  ASPresentationAnchor, ASWebAuthenticationPresentationContextProviding,
  ASWebAuthenticationSession, ASWebAuthenticationSessionCompletionHandler,
};
#[cfg(target_os = "ios")]
use objc2_foundation::{NSError, NSURL, NSString};
#[cfg(target_os = "ios")]
use objc2_ui_kit::UIWindow;

/// Runtime-registered NSObject subclass that implements
/// `ASWebAuthenticationPresentationContextProviding`.
///
/// Built with `ClassBuilder` instead of `define_class!`: objc2 0.6.4's init
/// family requires `msg_send![super(..), init]` to be typed as
/// `Option<Retained<T>>`, and three prior PRs (#76–#78) kept shuffling that
/// call inside/outside `define_class` without fixing the return type.
#[cfg(target_os = "ios")]
static OAUTH_CONTEXT_CLASS: OnceLock<&'static AnyClass> = OnceLock::new();

#[cfg(target_os = "ios")]
fn oauth_context_class() -> &'static AnyClass {
  OAUTH_CONTEXT_CLASS.get_or_init(register_oauth_context_class)
}

#[cfg(target_os = "ios")]
fn register_oauth_context_class() -> &'static AnyClass {
  let mut builder = ClassBuilder::new(c"DayspringOAuthContextProvider", NSObject::class())
    .expect("DayspringOAuthContextProvider already registered");

  unsafe extern "C-unwind" fn presentation_anchor_for_session(
    _this: &NSObject,
    _cmd: Sel,
    _session: &ASWebAuthenticationSession,
  ) -> *mut ASPresentationAnchor {
    // ClassBuilder IMPs must return raw pointers (`Encode` is not implemented
    // for `Retained<T>`). objc2 0.6.4 docs: autorelease_return for id returns.
    Retained::autorelease_return(presentation_anchor())
  }

  unsafe {
    builder.add_method(
      sel!(presentationAnchorForWebAuthenticationSession:),
      presentation_anchor_for_session as unsafe extern "C-unwind" fn(_, _, _) -> _,
    );
  }

  let proto = <dyn ASWebAuthenticationPresentationContextProviding>::protocol()
    .expect("ASWebAuthenticationPresentationContextProviding");
  builder.add_protocol(proto);

  builder.register()
}

#[cfg(target_os = "ios")]
fn new_oauth_context_provider() -> Retained<NSObject> {
  let cls = oauth_context_class();
  // SAFETY: `alloc`/`init` on our NSObject subclass; init-family returns Option.
  unsafe {
    let allocated: Allocated<NSObject> = msg_send![cls, alloc];
    let obj: Option<Retained<NSObject>> = msg_send![allocated, init];
    obj.expect("OAuth context provider init failed")
  }
}

#[cfg(target_os = "ios")]
fn window_to_anchor(window: Retained<UIWindow>) -> Retained<ASPresentationAnchor> {
  window.into_super().into_super().into_super()
}

#[cfg(target_os = "ios")]
fn presentation_anchor() -> Retained<ASPresentationAnchor> {
  let window = crate::key_window() as *mut UIWindow;
  if window.is_null() {
    // The IMP must return a window. start_session_on_main refuses to start
    // when key_window is nil, so this path is a last-resort empty window
    // rather than a panic that leaves the JS side hung with every button
    // disabled (ASC 2.1 on iPad: keyWindow is often nil).
    log::warn!("OAuth presentation anchor: no UIWindow");
    let Some(cls) = AnyClass::get(c"UIWindow") else {
      panic!("UIWindow unavailable");
    };
    unsafe {
      let allocated: Allocated<UIWindow> = msg_send![cls, alloc];
      let created: Option<Retained<UIWindow>> = msg_send![allocated, init];
      return window_to_anchor(created.expect("OAuth fallback window"));
    }
  }
  unsafe { window_to_anchor(Retained::retain(window).expect("window retain")) }
}

/// Opens an OAuth URL in ASWebAuthenticationSession and returns the callback
/// URL (e.g. `dayspring://auth-callback?code=…`). No-op stub on other platforms.
///
/// **Must be `async`.** A sync command on iOS often runs on the UIKit main
/// thread (WKScriptMessageHandler). The old body did `run_on_main(start)`
/// then `rx.recv_timeout(90s)` on that same thread. Presentation and the
/// completion handler both need the main run loop, so the recv deadlocked:
/// no sheet, React never painted “Opening…”, every later tap looked dead,
/// and leaving the app tripped the watchdog (“this app crashed”).
/// `spawn_blocking` keeps the wait off main. JS `invoke` is unchanged.
#[tauri::command]
pub async fn start_oauth_session(auth_url: String) -> Result<String, String> {
  #[cfg(not(target_os = "ios"))]
  {
    let _ = auth_url;
    return Err("start_oauth_session is iOS-only".into());
  }

  #[cfg(target_os = "ios")]
  {
    tauri::async_runtime::spawn_blocking(move || start_oauth_session_ios(&auth_url))
      .await
      .map_err(|e| format!("OAuth waiter failed: {e}"))?
  }
}

#[cfg(target_os = "ios")]
fn start_oauth_session_ios(auth_url: &str) -> Result<String, String> {
  let (tx, rx) = mpsc::channel::<Result<String, String>>();
  let tx = Arc::new(Mutex::new(Some(tx)));

  run_on_main({
    let auth_url = auth_url.to_string();
    let tx = Arc::clone(&tx);
    move || {
      if let Err(err) = start_session_on_main(&auth_url, Arc::clone(&tx)) {
        log::warn!("OAuth session failed to start: {err}");
        if let Ok(mut guard) = tx.lock() {
          if let Some(sender) = guard.take() {
            let _ = sender.send(Err(err));
          }
        }
      }
    }
  });

  rx.recv_timeout(std::time::Duration::from_secs(90))
    .map_err(|_| {
      "Sign-in didn’t open. Tap again, or use email.".to_string()
    })?
}

#[cfg(target_os = "ios")]
fn start_session_on_main(
  auth_url: &str,
  tx: Arc<Mutex<Option<mpsc::Sender<Result<String, String>>>>>,
) -> Result<(), String> {
  let _mtm = MainThreadMarker::new().ok_or("OAuth must run on the main thread")?;

  let window_ptr = crate::key_window();
  if window_ptr.is_null() {
    if let Ok(mut guard) = tx.lock() {
      if let Some(sender) = guard.take() {
        let _ = sender.send(Err(
          "Could not find a window to present sign-in. Try email, or tap again.".into(),
        ));
      }
    }
    return Err("Could not find a window to present sign-in".into());
  }
  unsafe {
    let _: () = msg_send![window_ptr, makeKeyAndVisible];
  }

  let ns_url = NSString::from_str(auth_url);
  let url: Retained<NSURL> =
    NSURL::URLWithString(&ns_url).ok_or_else(|| format!("invalid OAuth URL: {auth_url}"))?;

  let scheme = NSString::from_str("dayspring");
  let tx_for_block = Arc::clone(&tx);
  let completion_block = RcBlock::new(
    move |callback_url: *mut NSURL, error: *mut NSError| {
      let sender = tx_for_block.lock().ok().and_then(|mut g| g.take());
      let Some(sender) = sender else {
        return;
      };
      if !error.is_null() {
        let msg = unsafe {
          let desc: Retained<NSString> = msg_send![error, localizedDescription];
          desc.to_string()
        };
        let _ = sender.send(Err(msg));
        return;
      }
      if callback_url.is_null() {
        let _ = sender.send(Err("OAuth returned no callback URL".into()));
        return;
      }
      let absolute: Retained<NSString> = unsafe { msg_send![callback_url, absoluteString] };
      let url_str = absolute.to_string();
      let _ = sender.send(Ok(url_str));
    },
  );
  let completion: ASWebAuthenticationSessionCompletionHandler =
    RcBlock::into_raw(completion_block);

  // ASWebAuthenticationSession is AnyThread — `alloc()` takes no MainThreadMarker.
  // PR #78 passed `alloc(mtm)`, which does not match the generated ClassType impl.
  let session = unsafe {
    ASWebAuthenticationSession::initWithURL_callbackURLScheme_completionHandler(
      ASWebAuthenticationSession::alloc(),
      &url,
      Some(&scheme),
      completion,
    )
  };

  let provider = new_oauth_context_provider();
  unsafe {
    let _: () = msg_send![&session, setPresentationContextProvider: &*provider];
    session.setPrefersEphemeralWebBrowserSession(false);
  }

  let started = unsafe { session.start() };
  // Retain until the completion handler fires (provider is weak on the session).
  std::mem::forget(provider);
  std::mem::forget(session);

  if !started {
    if let Ok(mut guard) = tx.lock() {
      if let Some(sender) = guard.take() {
        let _ = sender.send(Err("Could not start in-app OAuth session".into()));
      }
    }
    return Err("Could not start in-app OAuth session".into());
  }

  Ok(())
}

#[cfg(target_os = "ios")]
fn run_on_main(f: impl FnOnce() + Send + 'static) {
  use objc2::MainThreadMarker;

  if MainThreadMarker::new().is_some() {
    f();
    return;
  }
  let cell = Mutex::new(Some(f));
  let block = RcBlock::new(move || {
    if let Some(func) = cell.lock().ok().and_then(|mut g| g.take()) {
      func();
    }
  });
  let Some(cls) = AnyClass::get(c"NSOperationQueue") else {
    log::warn!("OAuth: no NSOperationQueue");
    return;
  };
  unsafe {
    let queue: *mut AnyObject = msg_send![cls, mainQueue];
    if !queue.is_null() {
      let _: () = msg_send![queue, addOperationWithBlock: &*block];
    }
  }
}
