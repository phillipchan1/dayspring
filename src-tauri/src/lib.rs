#[cfg(any(target_os = "ios", target_os = "macos"))]
mod native_typing;

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

/// Whether the app lock is currently on, as last reported by the web layer.
/// Read on the main thread from the lifecycle observers below.
#[cfg(target_os = "ios")]
static PRIVACY_ARMED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Marks the overlay so it can be found again and removed without keeping a
/// reference to it across notifications.
#[cfg(target_os = "ios")]
const PRIVACY_VIEW_TAG: isize = 0x0DA7_5C10;

/// Arm or disarm the iOS privacy overlay. Called by the web layer whenever the
/// app lock is turned on or off. A no-op everywhere else, so the front end can
/// call it without checking the platform first.
#[tauri::command]
fn set_privacy_screen(enabled: bool) {
  #[cfg(target_os = "ios")]
  PRIVACY_ARMED.store(enabled, std::sync::atomic::Ordering::SeqCst);
  #[cfg(not(target_os = "ios"))]
  let _ = enabled;
}

/// Keep the journal out of the iOS app-switcher snapshot.
///
/// The web layer already paints an opaque veil the moment it hears the app go
/// to the background, and most of the time that is enough. But it is a race it
/// cannot be relied on to win: UIKit takes the snapshot on the main thread right
/// after `applicationDidEnterBackground`, while the veil has to make it through
/// a React render and a compositor pass in a *different process* first. Losing
/// that race means a legible paragraph of somebody's journal on the app-switcher
/// card, which is the one thing the acceptance criteria say cannot happen.
///
/// So the same cover is also thrown up natively, on `willResignActive` — which
/// UIKit posts *before* the snapshot, on the thread that takes it. Belt and
/// braces: whichever wins, nothing legible is captured.
///
/// The overlay borrows the webview's own background colour, so it matches
/// whichever theme the user is in without the web layer having to tell us.
/// Fallible at every step on purpose — if any of it fails, the JS veil is still
/// there, and nothing downstream depends on this.
#[cfg(target_os = "ios")]
fn install_privacy_screen(webview: &tauri::webview::PlatformWebview) {
  use block2::RcBlock;
  use objc2::rc::Retained;
  use objc2::runtime::AnyObject;
  use objc2::{msg_send, MainThreadMarker, MainThreadOnly};
  use objc2_foundation::NSNotificationCenter;
  use objc2_ui_kit::{
    UIApplicationDidBecomeActiveNotification, UIApplicationWillResignActiveNotification, UIColor,
    UIView, UIWindow,
  };
  use std::sync::atomic::Ordering;

  let wk = webview.inner() as *mut AnyObject;
  if wk.is_null() {
    log::warn!("privacy screen: no webview");
    return;
  }

  // SAFETY: `inner()` is the WKWebView. Retaining it keeps the pointer valid for
  // the life of the process, which is how long these observers live.
  let Some(retained) = (unsafe { Retained::retain(wk) }) else {
    return;
  };
  std::mem::forget(retained);
  // Carried into the blocks as an integer so the closures stay sendable.
  let wk_addr = wk as usize;

  /// The webview's window, at the moment we need it. Looked up per notification
  /// rather than cached: at setup time the view is not in a window yet.
  unsafe fn window_of(wk_addr: usize) -> Option<Retained<UIWindow>> {
    let wk = wk_addr as *mut AnyObject;
    msg_send![wk, window]
  }

  let cover = RcBlock::new(move |_: std::ptr::NonNull<objc2_foundation::NSNotification>| {
    if !PRIVACY_ARMED.load(Ordering::SeqCst) {
      return;
    }
    let Some(mtm) = MainThreadMarker::new() else { return };
    // SAFETY: UIApplication posts its lifecycle notifications on the main
    // thread, which the marker above confirms.
    unsafe {
      let Some(window) = window_of(wk_addr) else { return };
      // Already covered — a resign/become pair can arrive more than once.
      if window.viewWithTag(PRIVACY_VIEW_TAG).is_some() {
        return;
      }
      let view = UIView::initWithFrame(UIView::alloc(mtm), window.bounds());
      view.setTag(PRIVACY_VIEW_TAG);
      let wk = wk_addr as *mut AnyObject;
      let background: Option<Retained<UIColor>> = msg_send![wk, backgroundColor];
      view.setBackgroundColor(Some(&background.unwrap_or_else(UIColor::blackColor)));
      window.addSubview(&view);
    }
  });

  let uncover = RcBlock::new(move |_: std::ptr::NonNull<objc2_foundation::NSNotification>| {
    if MainThreadMarker::new().is_none() {
      return;
    }
    // SAFETY: main thread, as above.
    unsafe {
      let Some(window) = window_of(wk_addr) else { return };
      // Removed unconditionally, NOT gated on PRIVACY_ARMED: if the lock is
      // turned off while the app is in the background, a gate on it would leave
      // the cover welded over the app on return.
      if let Some(view) = window.viewWithTag(PRIVACY_VIEW_TAG) {
        view.removeFromSuperview();
      }
    }
  });

  let center = NSNotificationCenter::defaultCenter();
  // SAFETY: both blocks only touch main-thread UIKit state, and both check for
  // the main thread before doing so. `queue: None` delivers on the posting
  // thread, which for these notifications is the main thread — and has to be,
  // since the snapshot is taken there.
  unsafe {
    let a = center.addObserverForName_object_queue_usingBlock(
      Some(UIApplicationWillResignActiveNotification),
      None,
      None,
      &cover,
    );
    let b = center.addObserverForName_object_queue_usingBlock(
      Some(UIApplicationDidBecomeActiveNotification),
      None,
      None,
      &uncover,
    );
    // Never removed — these live as long as the app does. Leaking the tokens is
    // the honest way to say so.
    std::mem::forget(a);
    std::mem::forget(b);
  }
  std::mem::forget(cover);
  std::mem::forget(uncover);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Before wry builds the WKWebView — the predictions flag is creation-only.
  #[cfg(any(target_os = "ios", target_os = "macos"))]
  native_typing::enable_inline_predictions();

  #[cfg_attr(not(desktop), allow(unused_mut))]
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![open_devtools, set_privacy_screen]);

  // The updater plugin is desktop-only.
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
  }

  // StoreKit / Play Billing — mobile only.
  #[cfg(mobile)]
  {
    builder = builder.plugin(tauri_plugin_purchases::init());
    // Face ID / Touch ID for the optional app lock. Only ever invoked once the
    // user has turned the lock on and opted in; the PIN stays the way in.
    builder = builder.plugin(tauri_plugin_biometric::init());
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
          let _ = window.with_webview(|webview| {
            native_typing::enable_writing_tools(webview.inner() as *mut _);
            install_privacy_screen(&webview);
            reclaim_ios_viewport(webview);
          });
        }
      }

      #[cfg(target_os = "macos")]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.with_webview(|webview| {
            native_typing::enable_writing_tools(webview.inner() as *mut _);
          });

          // ⌘W / the red traffic light must hide the window, not destroy it.
          // Tauri's default close destroys the webview, and with a single
          // window that also exits the process — so ⌘W feels like quit.
          // Hidden, the app stays in the Dock; the Reopen handler below
          // brings the window back. ⌘Q is a different menu item and still
          // quits.
          let hidden = window.clone();
          window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
              api.prevent_close();
              let _ = hidden.hide();
            }
          });
        }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|_app, _event| {
      // Dock-icon click after ⌘W hid the window
      // (`applicationShouldHandleReopen:hasVisibleWindows:`). Windows
      // already up: leave it to macOS. No visible windows: restore main.
      #[cfg(target_os = "macos")]
      if let tauri::RunEvent::Reopen {
        has_visible_windows, ..
      } = _event
      {
        if !has_visible_windows {
          use tauri::Manager;
          if let Some(window) = _app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
          }
        }
      }
    });
}
