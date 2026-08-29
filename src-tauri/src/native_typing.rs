//! Make the WKWebView type like Notes, not like a code editor.
//!
//! WKWebViewConfiguration.allowsInlinePredictions defaults to false. Safari
//! the browser turns this on; the Tauri shell does not. That is why
//! autocorrect and the grey inline guesses feel weaker in the app than in
//! a Safari tab of the same page. The flag is read only at webview creation,
//! so we set it on every new configuration before wry builds the view.
//!
//! Writing Tools (macOS 15 / iOS 18) lives on the view itself and can be
//! turned on after create.

#[cfg(any(target_os = "ios", target_os = "macos"))]
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};

#[cfg(any(target_os = "ios", target_os = "macos"))]
type InitFn = unsafe extern "C" fn(*mut objc2::runtime::AnyObject, objc2::runtime::Sel) -> *mut objc2::runtime::AnyObject;

#[cfg(any(target_os = "ios", target_os = "macos"))]
static ORIG_CONFIG_INIT: AtomicPtr<core::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());

/// Patch `-[WKWebViewConfiguration init]` so every webview wry creates
/// already has inline predictions on. Must run before `Builder::run`.
#[cfg(any(target_os = "ios", target_os = "macos"))]
pub fn enable_inline_predictions() {
  use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
  use objc2::{msg_send, sel};

  static DONE: AtomicBool = AtomicBool::new(false);
  if DONE.swap(true, Ordering::SeqCst) {
    return;
  }

  let Some(cls) = AnyClass::get(c"WKWebViewConfiguration") else {
    log::warn!("native typing: no WKWebViewConfiguration class");
    return;
  };
  let Some(method) = cls.instance_method(sel!(init)) else {
    log::warn!("native typing: WKWebViewConfiguration has no -init");
    return;
  };

  extern "C" fn patched_init(this: *mut AnyObject, cmd: Sel) -> *mut AnyObject {
    unsafe {
      let orig: InitFn = std::mem::transmute(ORIG_CONFIG_INIT.load(Ordering::SeqCst));
      let obj = orig(this, cmd);
      if !obj.is_null() {
        let sel_pred = sel!(setAllowsInlinePredictions:);
        let responds: bool = msg_send![obj, respondsToSelector: sel_pred];
        if responds {
          let _: () = msg_send![obj, setAllowsInlinePredictions: true];
        }
      }
      obj
    }
  }

  // SAFETY: same signature as `-[NSObject init]`. We call through to the
  // original IMP so the object is fully initialised before the extra flag.
  // `set_implementation` returns the previous IMP — store that, not a
  // separate `implementation()` read that could race with the swap.
  unsafe {
    let imp: Imp = std::mem::transmute::<
      extern "C" fn(*mut AnyObject, Sel) -> *mut AnyObject,
      Imp,
    >(patched_init);
    let old = method.set_implementation(imp);
    ORIG_CONFIG_INIT.store(std::mem::transmute::<Imp, *mut core::ffi::c_void>(old), Ordering::SeqCst);
  }
}

/// Ask the webview for the full Writing Tools set (Complete = 2).
///
/// No-op on older OS versions that lack the selector. Safe to call from
/// `setup` after the view exists.
#[cfg(any(target_os = "ios", target_os = "macos"))]
pub fn enable_writing_tools(wk: *mut objc2::runtime::AnyObject) {
  use objc2::{msg_send, sel};

  if wk.is_null() {
    return;
  }
  unsafe {
    let sel_wt = sel!(setWritingToolsBehavior:);
    let responds: bool = msg_send![wk, respondsToSelector: sel_wt];
    if responds {
      // UIWritingToolsBehaviorComplete / WKWritingToolsBehaviorComplete = 2
      let _: () = msg_send![wk, setWritingToolsBehavior: 2i64];
    }
  }
}
