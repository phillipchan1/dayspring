//! The native frame around the webview: what the window does on close and
//! launch, which appearance the OS draws its own chrome in, and the iOS
//! status-bar tap. The web half is src/lib/windowChrome.ts.
//!
//! Every command here is registered on every platform and does nothing where
//! it doesn't apply, so the front end can call it without a cfg of its own
//! (the same shape as `set_privacy_screen` and `ios_selection_action`).

#[cfg(target_os = "macos")]
use std::sync::atomic::{AtomicU64, Ordering};

// ── Mac: ⌘W and the red light close the top layer first ─────────────────────

/// Numbers each close request sent to the webview.
#[cfg(target_os = "macos")]
static CLOSE_SEQ: AtomicU64 = AtomicU64::new(0);
/// The highest request the webview has answered.
#[cfg(target_os = "macos")]
static CLOSE_ACK: AtomicU64 = AtomicU64::new(0);

/// Listened for in src/lib/windowChrome.ts.
#[cfg(target_os = "macos")]
const CLOSE_EVENT: &str = "window-close-requested";

/// If the webview hasn't answered by now (hung, or still loading), the
/// window hides anyway: ⌘W must never do nothing.
#[cfg(target_os = "macos")]
const CLOSE_FALLBACK: std::time::Duration = std::time::Duration::from_millis(900);

/// ⌘W (the menu's predefined Close, i.e. `performClose:`) and the red traffic
/// light both arrive here as CloseRequested.
///
/// Tauri's default close destroys the webview, and with one window that exits
/// the process — ⌘W felt like quit. So the close is always prevented, and the
/// webview decides: if a sheet, menu or dialog is open it closes that (the
/// same Escape path every overlay already answers), otherwise it asks for the
/// window to hide. Hidden, the app stays in the Dock; the Reopen handler in
/// lib.rs brings it back. ⌘Q is a different item and still quits.
#[cfg(target_os = "macos")]
pub fn install_close_handler(window: &tauri::WebviewWindow) {
  use tauri::Emitter;

  let target = window.clone();
  window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
      api.prevent_close();
      let seq = CLOSE_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
      if target.emit(CLOSE_EVENT, seq).is_err() {
        let _ = target.hide();
        return;
      }
      let fallback = target.clone();
      std::thread::spawn(move || {
        std::thread::sleep(CLOSE_FALLBACK);
        if CLOSE_ACK.load(Ordering::SeqCst) < seq {
          let _ = fallback.hide();
        }
      });
    }
  });
}

/// The webview's answer to a close request: `hide` when nothing was open over
/// the surface (or Escape closed nothing), false when it closed a layer.
#[tauri::command]
pub fn resolve_close_request(window: tauri::WebviewWindow, seq: u64, hide: bool) {
  #[cfg(target_os = "macos")]
  {
    let _ = CLOSE_ACK.fetch_max(seq, Ordering::SeqCst);
    if hide {
      let _ = window.hide();
    }
  }
  #[cfg(not(target_os = "macos"))]
  let _ = (window, seq, hide);
}

// ── Mac: launch without the white frame ─────────────────────────────────────

/// How long the window may stay hidden waiting for the webview's first frame.
#[cfg(target_os = "macos")]
const REVEAL_FALLBACK: std::time::Duration = std::time::Duration::from_secs(3);

/// The Mac window is created hidden (tauri.macos.conf.json) and the webview
/// shows it — and focuses it, which is also what brings the app forward after
/// an update relaunch — once React has committed (src/lib/windowChrome.ts
/// `revealWindow`). If that never comes (a script error before render, a
/// webview that failed to load), this shows it anyway so the window can
/// never stay invisible.
#[cfg(target_os = "macos")]
pub fn schedule_reveal_fallback(window: tauri::WebviewWindow) {
  std::thread::spawn(move || {
    std::thread::sleep(REVEAL_FALLBACK);
    if !window.is_visible().unwrap_or(false) {
      log::warn!("window reveal: the webview never showed the window; showing it now");
      let _ = window.show();
      let _ = window.set_focus();
    }
  });
}

// ── Mac: the inspector, only when asked for ─────────────────────────────────

/// Make the webview inspectable: Safari's Develop menu on macOS 13.3+, and
/// "Inspect Element" in the right-click menu.
///
/// tauri.macos.conf.json sets `devtools: false`, so a release build is not
/// inspectable and its context menus don't offer the inspector. This turns it
/// back on for debug builds (from setup) and when dev mode opens the
/// inspector (`open_devtools`). The Cargo `devtools` feature stays, so that
/// command still compiles in release.
#[cfg(target_os = "macos")]
pub fn enable_web_inspector(wk: *mut objc2::runtime::AnyObject) {
  use objc2::runtime::AnyObject;
  use objc2::{msg_send, sel};

  if wk.is_null() {
    return;
  }
  // SAFETY: `wk` is the WKWebView (PlatformWebview::inner). Both setters are
  // checked for first; `_setDeveloperExtrasEnabled:` is the private setter
  // behind the `developerExtrasEnabled` key wry itself sets when devtools are
  // on.
  unsafe {
    let inspectable: bool = msg_send![wk, respondsToSelector: sel!(setInspectable:)];
    if inspectable {
      let _: () = msg_send![wk, setInspectable: true];
    }
    let config: *mut AnyObject = msg_send![wk, configuration];
    if config.is_null() {
      return;
    }
    let prefs: *mut AnyObject = msg_send![config, preferences];
    if prefs.is_null() {
      return;
    }
    let extras: bool = msg_send![prefs, respondsToSelector: sel!(_setDeveloperExtrasEnabled:)];
    if extras {
      let _: () = msg_send![prefs, _setDeveloperExtrasEnabled: true];
    }
  }
}

// ── iOS: chrome in the voice's appearance ───────────────────────────────────

/// Draw iOS's own chrome in the page's appearance (src/lib/windowChrome.ts
/// `syncNativeAppearance`, from App.tsx's theme effect).
///
/// - `appearance` ("light" | "dark") becomes the key window's
///   `overrideUserInterfaceStyle`: the status bar, the keyboard, and system
///   sheets follow the voice, not the system setting.
/// - `accent` (`#rrggbb`, the theme's `--accent`) becomes the web view's
///   `tintColor`, so selection handles and the caret are the voice's accent
///   rather than system blue (DESIGN_PRINCIPLES Rulings).
/// - `ground` (`#rrggbb`, `--bg`) becomes the web view's background, which is
///   what shows before a frame paints and what the privacy cover borrows.
#[tauri::command]
pub fn set_native_appearance(appearance: String, accent: Option<String>, ground: Option<String>) {
  #[cfg(target_os = "ios")]
  crate::run_on_main(move || ios::apply_appearance(&appearance, accent.as_deref(), ground.as_deref()));
  #[cfg(not(target_os = "ios"))]
  let _ = (appearance, accent, ground);
}

/// Open Dayspring's page in the Settings app — where a refused microphone (or
/// camera) can be turned back on. "Try again" can't succeed once iOS has
/// been told no; this is the only way back. iOS only.
#[tauri::command]
pub fn open_app_settings() -> Result<(), String> {
  #[cfg(not(target_os = "ios"))]
  {
    return Err("open_app_settings is iOS-only".into());
  }
  #[cfg(target_os = "ios")]
  {
    crate::run_on_main(ios::open_settings);
    Ok(())
  }
}

/// Set up the iOS web view's ground and status-bar tap. Called from
/// `reclaim_ios_viewport` in lib.rs, before the first page loads.
#[cfg(target_os = "ios")]
pub fn prepare_ios_webview(wk: *mut objc2::runtime::AnyObject) {
  ios::prepare_webview(wk);
}

#[cfg(target_os = "ios")]
mod ios {
  use objc2::rc::{Allocated, Retained};
  use objc2::runtime::{AnyClass, AnyObject, AnyProtocol, Bool, ClassBuilder, NSObject, Sel};
  use objc2::{msg_send, sel, ClassType};
  use objc2_foundation::NSString;
  use objc2_ui_kit::UIColor;
  use std::sync::OnceLock;

  /// The two grounds a page can open on before the web layer has said which
  /// voice it is in: Dawn's paper and Ink's night (src/styles/themes.css).
  /// The system appearance picks one, as `appearance: auto` would.
  const DAWN_GROUND: &str = "#fbf6ee";
  const INK_GROUND: &str = "#14161d";

  /// What the web layer listens for (src/lib/windowChrome.ts).
  const SCROLL_TO_TOP_JS: &str = "window.dispatchEvent(new Event('dayspring:scroll-to-top'))";

  /// `#rrggbb` → components in 0…1.
  fn parse_hex(hex: &str) -> Option<(f64, f64, f64)> {
    let h = hex.trim().trim_start_matches('#');
    if h.len() != 6 || !h.is_ascii() {
      return None;
    }
    let channel = |i: usize| {
      u8::from_str_radix(&h[i..i + 2], 16)
        .ok()
        .map(|v| f64::from(v) / 255.0)
    };
    Some((channel(0)?, channel(2)?, channel(4)?))
  }

  fn ui_color(hex: &str) -> Option<Retained<UIColor>> {
    let (r, g, b) = parse_hex(hex)?;
    Some(UIColor::colorWithRed_green_blue_alpha(r, g, b, 1.0))
  }

  /// The web view, its scroll view and its parent all take the ground, and
  /// the web view stops being opaque — WebKit's own white would otherwise
  /// show until the first frame, which on a dark voice is a flash.
  ///
  /// # Safety
  /// Main thread; `wk` is the live WKWebView.
  unsafe fn apply_ground(wk: *mut AnyObject, color: &UIColor) {
    let _: () = msg_send![wk, setOpaque: false];
    let _: () = msg_send![wk, setBackgroundColor: color];
    let scroll: *mut AnyObject = msg_send![wk, scrollView];
    if !scroll.is_null() {
      let _: () = msg_send![scroll, setBackgroundColor: color];
    }
    let parent: *mut AnyObject = msg_send![wk, superview];
    if !parent.is_null() {
      let _: () = msg_send![parent, setBackgroundColor: color];
    }
  }

  pub fn apply_appearance(appearance: &str, accent: Option<&str>, ground: Option<&str>) {
    // UIUserInterfaceStyle: 0 unspecified (follow the system), 1 light, 2 dark.
    let style: isize = match appearance {
      "light" => 1,
      "dark" => 2,
      _ => 0,
    };
    let window = crate::key_window();
    if !window.is_null() {
      // SAFETY: main thread (run_on_main); `window` is a UIWindow, which is a
      // UIView, which has overrideUserInterfaceStyle (iOS 13+).
      unsafe {
        let _: () = msg_send![window, setOverrideUserInterfaceStyle: style];
        let root: *mut AnyObject = msg_send![window, rootViewController];
        if !root.is_null() {
          let _: () = msg_send![root, setNeedsStatusBarAppearanceUpdate];
        }
      }
    }

    let wk = crate::ios_webview();
    if wk.is_null() {
      return;
    }
    if let Some(color) = accent.and_then(ui_color) {
      // SAFETY: main thread; UIView's tintColor.
      unsafe {
        let _: () = msg_send![wk, setTintColor: &*color];
      }
    }
    if let Some(color) = ground.and_then(ui_color) {
      // SAFETY: main thread; `wk` is the live WKWebView.
      unsafe { apply_ground(wk, &color) }
    }
  }

  pub fn open_settings() {
    // SAFETY: UIKit's exported constant ("app-settings:"), read on the main
    // thread like the rest of UIApplication.
    let url = unsafe { objc2_ui_kit::UIApplicationOpenSettingsURLString }.to_string();
    crate::open_url(&url);
  }

  pub fn prepare_webview(wk: *mut AnyObject) {
    if wk.is_null() {
      return;
    }
    let ground = if system_is_dark() { INK_GROUND } else { DAWN_GROUND };
    if let Some(color) = ui_color(ground) {
      // SAFETY: called from setup's with_webview closure, on the main thread.
      unsafe { apply_ground(wk, &color) }
    }
    // SAFETY: as above; -scrollView is a WKWebView property.
    unsafe {
      let scroll: *mut AnyObject = msg_send![wk, scrollView];
      if !scroll.is_null() {
        install_scroll_to_top(scroll);
      }
    }
  }

  fn system_is_dark() -> bool {
    let Some(cls) = AnyClass::get(c"UITraitCollection") else { return false };
    // SAFETY: +currentTraitCollection (iOS 13) and -userInterfaceStyle
    // (an NSInteger enum; 2 is dark).
    unsafe {
      let traits: *mut AnyObject = msg_send![cls, currentTraitCollection];
      if traits.is_null() {
        return false;
      }
      let style: isize = msg_send![traits, userInterfaceStyle];
      style == 2
    }
  }

  // ── The status-bar tap ────────────────────────────────────────────────────

  /// Tapping the status bar scrolls to the top in every iOS app. Here the
  /// document never scrolls — `.app-shell` owns its scrollers, and the WK
  /// scroll view is pinned (`reclaim_ios_viewport`) — so UIKit's own
  /// scroll-to-top had nothing to move. The scroll view keeps `scrollsToTop`
  /// so UIKit still asks, and a delegate answers NO and tells the page
  /// instead, which scrolls whatever the writer is looking at (windowChrome.ts
  /// `scrollActiveSurfaceToTop`, the same scroller the tab bar's second tap
  /// uses).
  ///
  /// The delegate is set as the scroll view's EXTERNAL delegate: WKScrollView
  /// keeps WKWebView as its internal one and forwards each callback to both,
  /// so WebKit's own handling is untouched. Ours answers only this one
  /// selector, and the external delegate's return value is the one UIKit sees.
  ///
  /// # Safety
  /// Main thread; `scroll` is the WKWebView's scroll view.
  unsafe fn install_scroll_to_top(scroll: *mut AnyObject) {
    let _: () = msg_send![scroll, setScrollsToTop: true];
    let delegate = scroll_top_delegate();
    if delegate.is_null() {
      log::warn!("status-bar tap: no delegate class");
      return;
    }
    let _: () = msg_send![scroll, setDelegate: delegate];
  }

  /// One delegate for the process. UIScrollView holds its delegate weakly.
  fn scroll_top_delegate() -> *mut AnyObject {
    static DELEGATE: OnceLock<usize> = OnceLock::new();
    *DELEGATE.get_or_init(|| {
      let Some(cls) = scroll_top_class() else { return 0 };
      // SAFETY: alloc/init of our own NSObject subclass; `into_raw` keeps the
      // +1 for the life of the process.
      unsafe {
        let allocated: Allocated<NSObject> = msg_send![cls, alloc];
        let obj: Option<Retained<NSObject>> = msg_send![allocated, init];
        obj.map(|o| Retained::into_raw(o) as usize).unwrap_or(0)
      }
    }) as *mut AnyObject
  }

  fn scroll_top_class() -> Option<&'static AnyClass> {
    if let Some(cls) = AnyClass::get(c"DayspringScrollToTop") {
      return Some(cls);
    }
    let mut builder = ClassBuilder::new(c"DayspringScrollToTop", NSObject::class())?;
    // SAFETY: `- (BOOL)scrollViewShouldScrollToTop:(UIScrollView *)scrollView`.
    unsafe {
      builder.add_method(
        sel!(scrollViewShouldScrollToTop:),
        should_scroll_to_top as unsafe extern "C-unwind" fn(_, _, _) -> _,
      );
    }
    if let Some(proto) = AnyProtocol::get(c"UIScrollViewDelegate") {
      builder.add_protocol(proto);
    }
    Some(builder.register())
  }

  unsafe extern "C-unwind" fn should_scroll_to_top(
    _this: &NSObject,
    _cmd: Sel,
    _scroll: *mut AnyObject,
  ) -> Bool {
    let wk = crate::ios_webview();
    if !wk.is_null() {
      let js = NSString::from_str(SCROLL_TO_TOP_JS);
      let _: () = msg_send![
        wk,
        evaluateJavaScript: &*js,
        completionHandler: std::ptr::null::<AnyObject>()
      ];
    }
    Bool::NO
  }
}
