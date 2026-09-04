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
use objc2::{msg_send, sel, ClassType, MainThreadMarker, ProtocolType};
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
  ) -> Retained<ASPresentationAnchor> {
    presentation_anchor()
  }

  unsafe {
    builder.add_method(
      sel!(presentationAnchorForWebAuthenticationSession:),
      presentation_anchor_for_session as unsafe extern "C-unwind" fn(_, _, _) -> _,
    );
  }

  let proto = ASWebAuthenticationPresentationContextProviding::protocol()
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
    let obj: Option<Retained<NSObject>> = msg_send![super(allocated, cls), init];
    obj.expect("OAuth context provider init failed")
  }
}

#[cfg(target_os = "ios")]
fn window_to_anchor(window: Retained<UIWindow>) -> Retained<ASPresentationAnchor> {
  window.into_super().into_super().into_super()
}

#[cfg(target_os = "ios")]
fn presentation_anchor() -> Retained<ASPresentationAnchor> {
  let Some(app_cls) = AnyClass::get(c"UIApplication") else {
    panic!("UIApplication unavailable");
  };
  unsafe {
    let app: *mut AnyObject = msg_send![app_cls, sharedApplication];
    let window: *mut UIWindow = msg_send![app, keyWindow];
    if !window.is_null() {
      return window_to_anchor(Retained::retain(window).expect("window retain"));
    }
    let windows: *mut AnyObject = msg_send![app, windows];
    if !windows.is_null() {
      let count: usize = msg_send![windows, count];
      if count > 0 {
        let first: *mut UIWindow = msg_send![windows, objectAtIndex: 0usize];
        if !first.is_null() {
          return window_to_anchor(Retained::retain(first).expect("window retain"));
        }
      }
    }
    panic!("no UIWindow for OAuth presentation");
  }
}

/// Opens an OAuth URL in ASWebAuthenticationSession and returns the callback
/// URL (e.g. `dayspring://auth-callback?code=…`). No-op stub on other platforms.
#[tauri::command]
pub fn start_oauth_session(auth_url: String) -> Result<String, String> {
  #[cfg(not(target_os = "ios"))]
  {
    let _ = auth_url;
    return Err("start_oauth_session is iOS-only".into());
  }

  #[cfg(target_os = "ios")]
  {
    start_oauth_session_ios(&auth_url)
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
      if let Err(err) = start_session_on_main(&auth_url, tx) {
        log::warn!("OAuth session failed to start: {err}");
      }
    }
  });

  rx.recv()
    .map_err(|_| "OAuth session ended unexpectedly".to_string())?
}

#[cfg(target_os = "ios")]
fn start_session_on_main(
  auth_url: &str,
  tx: Arc<Mutex<Option<mpsc::Sender<Result<String, String>>>>>,
) -> Result<(), String> {
  let _mtm = MainThreadMarker::new().ok_or("OAuth must run on the main thread")?;

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
