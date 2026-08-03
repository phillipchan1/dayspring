/// Open the web inspector (devtools). Gated by the `devtools` Cargo feature so
/// it works in both debug and release builds when the user enables dev mode.
#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) {
  window.open_devtools();
}

/// Give the web layer the whole screen back on iOS.
///
/// wry sizes the WKWebView to its parent view's full frame, so the webview is
/// not short — its *scroll view* is. UIKit's automatic content-inset adjustment
/// subtracts both safe-area insets (59pt top + 34pt bottom on an iPhone 16 Pro)
/// from the scrollable area, and WebKit derives the visual viewport from that.
/// The result is `100dvh == 778` on an 874pt screen: a 96pt band along the
/// bottom that the app can never paint, with the tab bar's touch targets
/// floating 96pt above the physical edge.
///
/// `.never` zeroes that adjustment. `env(safe-area-inset-*)` keeps reporting
/// 59/34 because those come from the window's safe area under
/// `viewport-fit=cover`, so the CSS `--safe-*` tokens go on working — they just
/// stop being applied twice.
///
/// Scrolling and bouncing are disabled on the same scroll view because this is
/// an app shell, not a page: `.app-shell` owns its own scrollers, and letting
/// WKWebView scroll the document underneath them is what slides the header
/// behind the status bar on editor focus and offsets every `position: fixed`
/// element (the docked CommandToolbar landed 59pt above the keyboard).
#[cfg(target_os = "ios")]
fn reclaim_ios_viewport(webview: tauri::webview::PlatformWebview) {
  use objc2::msg_send;
  use objc2::rc::Retained;
  use objc2::runtime::AnyObject;
  use objc2_ui_kit::{UIScrollView, UIScrollViewContentInsetAdjustmentBehavior};

  let wk = webview.inner() as *mut AnyObject;
  if wk.is_null() {
    return;
  }

  // SAFETY: `inner()` is documented to be the WKWebView, which responds to
  // -scrollView with a UIScrollView on iOS.
  unsafe {
    let scroll: Retained<UIScrollView> = msg_send![wk, scrollView];
    scroll.setContentInsetAdjustmentBehavior(UIScrollViewContentInsetAdjustmentBehavior::Never);
    scroll.setScrollEnabled(false);
    scroll.setBounces(false);
  }

  suppress_ios_accessory_bar();
}

/// Hide iOS's own form accessory bar — the grey `^ ⌄ … Done` strip that WebKit
/// puts above the keyboard on every editor focus.
///
/// It duplicates the app's own Done button in `CommandToolbar` and costs ~54pt
/// of an already short viewport. There is no API for this: `inputAccessoryView`
/// is read-only on `UIResponder`, and the responder in question is WebKit's
/// private `WKContentView`.
///
/// So the getter is replaced on the class itself, once per process. Re-classing
/// just our own instance would be narrower, but the content view does not exist
/// yet when `setup()` runs — WebKit creates it lazily with the first load — and
/// there is no good hook to come back later on the main thread. The class is
/// registered as soon as `WKWebView` is, so this works from setup.
///
/// The blast radius is every WKWebView in the process, which here is only ours:
/// OAuth opens in Safari, not an embedded webview.
///
/// Fallible at every step by design. If WebKit renames the class or drops the
/// method, this quietly does nothing and the stock accessory bar comes back.
/// Nothing downstream depends on it.
#[cfg(target_os = "ios")]
fn suppress_ios_accessory_bar() {
  use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
  use objc2::sel;
  use std::ffi::CStr;
  use std::sync::atomic::{AtomicBool, Ordering};

  extern "C" fn no_accessory_view(_this: &AnyObject, _cmd: Sel) -> *mut AnyObject {
    std::ptr::null_mut()
  }

  static DONE: AtomicBool = AtomicBool::new(false);
  if DONE.swap(true, Ordering::SeqCst) {
    return;
  }

  const CONTENT_VIEW: &CStr = c"WKContentView";

  let Some(cls) = AnyClass::get(CONTENT_VIEW) else {
    log::warn!("accessory bar: no WKContentView class");
    return;
  };
  let Some(method) = cls.instance_method(sel!(inputAccessoryView)) else {
    log::warn!("accessory bar: WKContentView has no -inputAccessoryView");
    return;
  };

  // SAFETY: the replacement has the signature the runtime expects for an
  // `id`-returning getter, and nil is what `-[UIResponder inputAccessoryView]`
  // returns by default — callers already handle it.
  unsafe {
    let imp: Imp = std::mem::transmute::<extern "C" fn(&AnyObject, Sel) -> *mut AnyObject, Imp>(
      no_accessory_view,
    );
    method.set_implementation(imp);
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg_attr(not(desktop), allow(unused_mut))]
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![open_devtools]);

  // The updater plugin is desktop-only.
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
  }

  // StoreKit / Play Billing — mobile only.
  #[cfg(mobile)]
  {
    builder = builder.plugin(tauri_plugin_purchases::init());
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // After a post-update relaunch on macOS the new process starts without
      // activating, leaving the window hidden behind other apps. Explicitly
      // show and focus here so every launch — including relaunches — brings
      // the window to the front.
      #[cfg(desktop)]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }

      #[cfg(target_os = "ios")]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.with_webview(reclaim_ios_viewport);
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
