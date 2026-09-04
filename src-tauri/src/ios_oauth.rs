//! In-app OAuth on iOS via ASWebAuthenticationSession.
//!
//! App Store Guideline 4 rejects handing sign-in to the system Safari app.
//! ASWebAuthenticationSession presents provider login in a secure in-app sheet
//! (SFSafariViewController under the hood) and returns the callback URL to us.

#[cfg(target_os = "ios")]
use std::sync::mpsc;
#[cfg(target_os = "ios")]
use std::sync::{Arc, Mutex};

#[cfg(target_os = "ios")]
use block2::RcBlock;
#[cfg(target_os = "ios")]
use objc2::rc::Retained;
#[cfg(target_os = "ios")]
use objc2::runtime::{AnyClass, AnyObject, NSObject, NSObjectProtocol, ProtocolObject};
#[cfg(target_os = "ios")]
use objc2::{define_class, msg_send, AnyThread, MainThreadMarker, MainThreadOnly};
#[cfg(target_os = "ios")]
use objc2_authentication_services::{
  ASPresentationAnchor, ASWebAuthenticationPresentationContextProviding,
  ASWebAuthenticationSession, ASWebAuthenticationSessionCompletionHandler,
};
#[cfg(target_os = "ios")]
use objc2_foundation::{NSError, NSURL, NSString};
#[cfg(target_os = "ios")]
use objc2_ui_kit::UIWindow;

#[cfg(target_os = "ios")]
define_class!(
  #[unsafe(super = NSObject)]
  #[thread_kind = MainThreadOnly]
  #[name = "DayspringOAuthContextProvider"]
  struct OAuthContextProvider;

  unsafe impl NSObjectProtocol for OAuthContextProvider {}

  unsafe impl ASWebAuthenticationPresentationContextProviding for OAuthContextProvider {
    #[unsafe(method(presentationAnchorForWebAuthenticationSession:))]
    fn presentation_anchor(
      &self,
      _session: &ASWebAuthenticationSession,
    ) -> Retained<ASPresentationAnchor> {
      presentation_anchor()
    }
  }
);

#[cfg(target_os = "ios")]
impl OAuthContextProvider {
  fn new(mtm: MainThreadMarker) -> Retained<Self> {
    let this = Self::alloc(mtm);
    // SAFETY: NSObject's `init` has the usual signature.
    unsafe { msg_send![super(this), init] }
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
  let mtm = MainThreadMarker::new().ok_or("OAuth must run on the main thread")?;

  let ns_url = NSString::from_str(auth_url);
  let url: Retained<NSURL> = unsafe {
    NSURL::URLWithString(&ns_url).ok_or_else(|| format!("invalid OAuth URL: {auth_url}"))?
  };

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

  let session = unsafe {
    ASWebAuthenticationSession::initWithURL_callbackURLScheme_completionHandler(
      ASWebAuthenticationSession::alloc(),
      &url,
      Some(&scheme),
      completion,
    )
  };

  let provider = OAuthContextProvider::new(mtm);
  let provider_obj = ProtocolObject::from_retained(provider);
  unsafe {
    session.setPresentationContextProvider(Some(&provider_obj));
    session.setPrefersEphemeralWebBrowserSession(false);
  }

  let started = unsafe { session.start() };
  // Retain until the completion handler fires (provider is weak on the session).
  std::mem::forget(provider_obj);
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
