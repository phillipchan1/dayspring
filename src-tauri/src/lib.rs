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
  suppress_ios_edit_menu();
  IOS_WK.store(wk as usize, std::sync::atomic::Ordering::SeqCst);
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

/// Hide iOS's text-selection edit menu (Copy / Look Up / Translate / Share).
///
/// The web layer already mounts `SelectionFormatBar` on every non-empty
/// selection. On iOS that pill loses to `UIEditMenuInteraction`, which lives in
/// a UIKit window above the WKWebView — CSS z-index cannot cover it. So the
/// system bubble is suppressed here, and the format bar re-hosts every item
/// the native menu used to offer.
///
/// iOS 16+: no-op `-[UIEditMenuInteraction presentEditMenuWithConfiguration:]`
/// and return an empty menu from WKContentView's delegate builder. iOS 15:
/// swallow `-[UIMenuController setMenuVisible:animated:]` when showing.
///
/// `canPerformAction:withSender:` is left alone so Cut / Copy / Paste still
/// work as first-responder actions if anything else asks.
///
/// Same fallible-once pattern as the accessory bar. If a selector disappears
/// the stock menu comes back and nothing downstream depends on this.
#[cfg(target_os = "ios")]
fn suppress_ios_edit_menu() {
  use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
  use objc2::sel;
  use std::sync::atomic::{AtomicBool, Ordering};

  static DONE: AtomicBool = AtomicBool::new(false);
  if DONE.swap(true, Ordering::SeqCst) {
    return;
  }

  // --- iOS 16+ present-time backstop ---------------------------------------
  if let Some(cls) = AnyClass::get(c"UIEditMenuInteraction") {
    if let Some(method) = cls.instance_method(sel!(presentEditMenuWithConfiguration:)) {
      extern "C" fn no_present(_this: &AnyObject, _cmd: Sel, _config: *mut AnyObject) {}
      unsafe {
        let imp: Imp = std::mem::transmute::<extern "C" fn(&AnyObject, Sel, *mut AnyObject), Imp>(
          no_present,
        );
        method.set_implementation(imp);
      }
    } else {
      log::warn!("edit menu: UIEditMenuInteraction has no -presentEditMenuWithConfiguration:");
    }
  }

  // --- iOS 16+ menu builder on the content view ----------------------------
  if let Some(cls) = AnyClass::get(c"WKContentView") {
    let sel = sel!(editMenuInteraction:menuForConfiguration:suggestedActions:);
    if let Some(method) = cls.instance_method(sel) {
      extern "C" fn empty_menu(
        _this: &AnyObject,
        _cmd: Sel,
        _interaction: *mut AnyObject,
        _config: *mut AnyObject,
        _suggested: *mut AnyObject,
      ) -> *mut AnyObject {
        empty_uimenu()
      }
      unsafe {
        let imp: Imp = std::mem::transmute::<
          extern "C" fn(&AnyObject, Sel, *mut AnyObject, *mut AnyObject, *mut AnyObject) -> *mut AnyObject,
          Imp,
        >(empty_menu);
        method.set_implementation(imp);
      }
    }
  }

  // --- iOS 15 UIMenuController ---------------------------------------------
  if let Some(cls) = AnyClass::get(c"UIMenuController") {
    if let Some(method) = cls.instance_method(sel!(setMenuVisible:animated:)) {
      extern "C" fn no_show(this: &AnyObject, cmd: Sel, visible: bool, animated: bool) {
        if visible {
          return;
        }
        // Still allow hides so a leftover menu can dismiss.
        let _ = (this, cmd, animated);
      }
      unsafe {
        let imp: Imp =
          std::mem::transmute::<extern "C" fn(&AnyObject, Sel, bool, bool), Imp>(no_show);
        method.set_implementation(imp);
      }
    }
  }
}

#[cfg(target_os = "ios")]
fn empty_uimenu() -> *mut objc2::runtime::AnyObject {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};
  use objc2_foundation::NSString;

  let Some(cls) = AnyClass::get(c"UIMenu") else {
    return std::ptr::null_mut();
  };
  let title = NSString::from_str("");
  let Some(arr_cls) = AnyClass::get(c"NSArray") else {
    return std::ptr::null_mut();
  };
  unsafe {
    let children: *mut AnyObject = msg_send![arr_cls, array];
    msg_send![cls, menuWithTitle: &*title, children: children]
  }
}

/// WKWebView pointer, stored so selection-menu commands can find a window.
#[cfg(target_os = "ios")]
static IOS_WK: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

/// Look Up / Share / Search Web / Translate / Replace guesses — the system
/// edit-menu items the format bar now owns. No-op on every other platform so
/// the front end can invoke without a platform check.
#[tauri::command]
fn ios_selection_action(action: String, text: String) -> Result<Option<Vec<String>>, String> {
  #[cfg(not(target_os = "ios"))]
  {
    let _ = (action, text);
    return Ok(None);
  }
  #[cfg(target_os = "ios")]
  {
    ios_selection_action_impl(&action, &text)
  }
}

#[cfg(target_os = "ios")]
fn ios_selection_action_impl(action: &str, text: &str) -> Result<Option<Vec<String>>, String> {
  let trimmed = text.trim();
  if trimmed.is_empty() {
    return Ok(None);
  }
  match action {
    "guesses" => Ok(Some(text_guesses(trimmed))),
    "lookup" => {
      run_on_main({
        let t = trimmed.to_string();
        move || present_lookup(&t)
      });
      Ok(None)
    }
    "share" => {
      run_on_main({
        let t = trimmed.to_string();
        move || present_share(&t)
      });
      Ok(None)
    }
    "search" => {
      run_on_main({
        let t = trimmed.to_string();
        move || open_url(&format!("x-web-search://?{}", encode_query(&t)))
      });
      Ok(None)
    }
    "translate" => {
      run_on_main({
        let t = trimmed.to_string();
        move || {
          open_url(&format!(
            "https://translate.google.com/?sl=auto&tl=auto&text={}",
            encode_query(&t)
          ))
        }
      });
      Ok(None)
    }
    _ => Ok(None),
  }
}

#[cfg(target_os = "ios")]
fn encode_query(s: &str) -> String {
  let mut out = String::new();
  for b in s.as_bytes() {
    match *b {
      b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
        out.push(*b as char)
      }
      b' ' => out.push_str("%20"),
      other => out.push_str(&format!("%{other:02X}")),
    }
  }
  out
}

#[cfg(target_os = "ios")]
fn run_on_main(f: impl FnOnce() + Send + 'static) {
  use block2::RcBlock;
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};
  use objc2::MainThreadMarker;
  use std::sync::Mutex;

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
    log::warn!("selection action: no NSOperationQueue");
    return;
  };
  unsafe {
    let queue: *mut AnyObject = msg_send![cls, mainQueue];
    if !queue.is_null() {
      let _: () = msg_send![queue, addOperationWithBlock: &*block];
    }
  }
}

#[cfg(target_os = "ios")]
fn key_window() -> *mut objc2::runtime::AnyObject {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};

  let wk = IOS_WK.load(std::sync::atomic::Ordering::SeqCst) as *mut AnyObject;
  if !wk.is_null() {
    let window: *mut AnyObject = unsafe { msg_send![wk, window] };
    if !window.is_null() {
      return window;
    }
  }
  let Some(app_cls) = AnyClass::get(c"UIApplication") else {
    return std::ptr::null_mut();
  };
  unsafe {
    let app: *mut AnyObject = msg_send![app_cls, sharedApplication];
    if app.is_null() {
      return std::ptr::null_mut();
    }
    msg_send![app, keyWindow]
  }
}

#[cfg(target_os = "ios")]
fn top_view_controller() -> *mut objc2::runtime::AnyObject {
  use objc2::msg_send;
  use objc2::runtime::AnyObject;

  let window = key_window();
  if window.is_null() {
    return std::ptr::null_mut();
  }
  unsafe {
    let mut vc: *mut AnyObject = msg_send![window, rootViewController];
    while !vc.is_null() {
      let presented: *mut AnyObject = msg_send![vc, presentedViewController];
      if presented.is_null() {
        break;
      }
      vc = presented;
    }
    vc
  }
}

#[cfg(target_os = "ios")]
fn present(sheet: *mut objc2::runtime::AnyObject) {
  use objc2::msg_send;
  use objc2::runtime::AnyObject;

  if sheet.is_null() {
    return;
  }
  let host = top_view_controller();
  if host.is_null() {
    log::warn!("selection action: no view controller to present on");
    return;
  }
  unsafe {
    let _: () = msg_send![
      host,
      presentViewController: sheet,
      animated: true,
      completion: std::ptr::null::<AnyObject>()
    ];
  }
}

#[cfg(target_os = "ios")]
fn present_lookup(term: &str) {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};
  use objc2_foundation::NSString;

  let Some(cls) = AnyClass::get(c"UIReferenceLibraryViewController") else {
    log::warn!("lookup: no UIReferenceLibraryViewController");
    return;
  };
  let ns = NSString::from_str(term);
  unsafe {
    let alloc: *mut AnyObject = msg_send![cls, alloc];
    let vc: *mut AnyObject = msg_send![alloc, initWithTerm: &*ns];
    present(vc);
  }
}

#[cfg(target_os = "ios")]
fn present_share(text: &str) {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};
  use objc2_foundation::NSString;

  let Some(cls) = AnyClass::get(c"UIActivityViewController") else {
    log::warn!("share: no UIActivityViewController");
    return;
  };
  let Some(arr_cls) = AnyClass::get(c"NSArray") else {
    return;
  };
  let ns = NSString::from_str(text);
  unsafe {
    let items: *mut AnyObject = msg_send![arr_cls, arrayWithObject: &*ns];
    let alloc: *mut AnyObject = msg_send![cls, alloc];
    let vc: *mut AnyObject = msg_send![
      alloc,
      initWithActivityItems: items,
      applicationActivities: std::ptr::null::<AnyObject>()
    ];
    // iPad refuses to present an activity sheet without a popover source.
    let pop: *mut AnyObject = msg_send![vc, popoverPresentationController];
    if !pop.is_null() {
      let window = key_window();
      if !window.is_null() {
        let _: () = msg_send![pop, setSourceView: window];
        #[repr(C)]
        struct CGPoint {
          x: f64,
          y: f64,
        }
        #[repr(C)]
        struct CGSize {
          width: f64,
          height: f64,
        }
        #[repr(C)]
        struct CGRect {
          origin: CGPoint,
          size: CGSize,
        }
        let bounds: CGRect = msg_send![window, bounds];
        let rect = CGRect {
          origin: CGPoint {
            x: bounds.origin.x + bounds.size.width * 0.5,
            y: bounds.origin.y + bounds.size.height * 0.5,
          },
          size: CGSize {
            width: 1.0,
            height: 1.0,
          },
        };
        let _: () = msg_send![pop, setSourceRect: rect];
      }
    }
    present(vc);
  }
}

#[cfg(target_os = "ios")]
fn open_url(url: &str) {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};
  use objc2_foundation::NSString;

  let Some(url_cls) = AnyClass::get(c"NSURL") else {
    return;
  };
  let Some(app_cls) = AnyClass::get(c"UIApplication") else {
    return;
  };
  let Some(dict_cls) = AnyClass::get(c"NSDictionary") else {
    return;
  };
  let ns = NSString::from_str(url);
  unsafe {
    let nsurl: *mut AnyObject = msg_send![url_cls, URLWithString: &*ns];
    if nsurl.is_null() {
      return;
    }
    let app: *mut AnyObject = msg_send![app_cls, sharedApplication];
    let opts: *mut AnyObject = msg_send![dict_cls, dictionary];
    if app.is_null() {
      return;
    }
    let _: () = msg_send![
      app,
      openURL: nsurl,
      options: opts,
      completionHandler: std::ptr::null::<AnyObject>()
    ];
  }
}

#[cfg(target_os = "ios")]
fn preferred_language() -> objc2::rc::Retained<objc2_foundation::NSString> {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};
  use objc2_foundation::NSString;
  use std::ffi::CStr;

  if let Some(cls) = AnyClass::get(c"NSLocale") {
    unsafe {
      let langs: *mut AnyObject = msg_send![cls, preferredLanguages];
      if !langs.is_null() {
        let first: *mut AnyObject = msg_send![langs, firstObject];
        if !first.is_null() {
          let utf8: *const i8 = msg_send![first, UTF8String];
          if !utf8.is_null() {
            let s = CStr::from_ptr(utf8).to_string_lossy();
            return NSString::from_str(&s);
          }
        }
      }
    }
  }
  NSString::from_str("en")
}

#[cfg(target_os = "ios")]
fn text_guesses(word: &str) -> Vec<String> {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};
  use objc2_foundation::NSString;
  use std::ffi::CStr;

  let Some(cls) = AnyClass::get(c"UITextChecker") else {
    return Vec::new();
  };
  let ns = NSString::from_str(word);
  let lang = preferred_language();
  unsafe {
    let alloc: *mut AnyObject = msg_send![cls, alloc];
    let checker: *mut AnyObject = msg_send![alloc, init];
    if checker.is_null() {
      return Vec::new();
    }
    #[repr(C)]
    struct NSRange {
      location: usize,
      length: usize,
    }
    let length: usize = msg_send![&*ns, length];
    let range = NSRange {
      location: 0,
      length,
    };
    let guesses: *mut AnyObject =
      msg_send![checker, guessesForWordRange: range, inString: &*ns, language: &*lang];
    if guesses.is_null() {
      return Vec::new();
    }
    let count: usize = msg_send![guesses, count];
    let mut out = Vec::with_capacity(count.min(8));
    for i in 0..count.min(8) {
      let item: *mut AnyObject = msg_send![guesses, objectAtIndex: i];
      if item.is_null() {
        continue;
      }
      let utf8: *const i8 = msg_send![item, UTF8String];
      if utf8.is_null() {
        continue;
      }
      out.push(CStr::from_ptr(utf8).to_string_lossy().into_owned());
    }
    out
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
  #[cfg_attr(not(desktop), allow(unused_mut))]
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![
      open_devtools,
      set_privacy_screen,
      ios_selection_action
    ]);

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
            install_privacy_screen(&webview);
            reclaim_ios_viewport(webview);
          });
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
