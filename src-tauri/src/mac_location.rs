//! Where a page was written, asked of CoreLocation on the Mac.
//!
//! On the web the page asks `navigator.geolocation` and the browser prompts.
//! On iPhone the geolocation plugin asks CoreLocation in the app's own name.
//! The Mac had neither: the plugin has no macOS implementation, and a
//! WKWebView on macOS turns every geolocation request down unless its UI
//! delegate implements a private method, which wry does not. So every page
//! written on the Mac was saved with its hour and nothing else. 116 of 120
//! entries since August were like that, and the 4 with a place came from a phone.
//!
//! This is the Mac's half of what the plugin does on iPhone: one position,
//! approximate, asked for in the app's name. The prompt reads
//! `NSLocationUsageDescription` from src-tauri/Info.plist, and the hardened
//! runtime needs `com.apple.security.personal-information.location`
//! (src-tauri/Entitlements.plist). Without that entitlement CoreLocation
//! refuses silently, which is exactly how this went unnoticed.
//!
//! The command compiles everywhere so the front end can call it without a
//! cfg of its own. Off the Mac it answers "no position", which is the same
//! quiet case as a writer saying no.

use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Fix {
  pub lat: f64,
  pub lon: f64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub accuracy: Option<f64>,
}

/// One approximate position, or `None` when there is none to give: permission
/// declined, Location Services off, no fix in time, or not a Mac.
#[tauri::command]
pub async fn mac_current_position(app: tauri::AppHandle) -> Option<Fix> {
  #[cfg(target_os = "macos")]
  {
    imp::current_position(app).await
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = app;
    None
  }
}

#[cfg(target_os = "macos")]
mod imp {
  use super::Fix;
  use objc2::rc::Retained;
  use objc2::runtime::ProtocolObject;
  use objc2::{define_class, msg_send, MainThreadMarker, MainThreadOnly};
  use objc2_core_location::{
    CLAuthorizationStatus, CLLocation, CLLocationManager, CLLocationManagerDelegate,
  };
  use objc2_foundation::{NSArray, NSError, NSObject, NSObjectProtocol};
  use std::cell::RefCell;
  use std::sync::mpsc::{channel, Sender};
  use std::time::Duration;

  /// Long enough to cover the first-run permission prompt being read, short
  /// enough that a Mac with no fix doesn't hold a request open all morning.
  /// The snap never blocks a save, so waiting costs the writer nothing.
  const WAIT: Duration = Duration::from_secs(30);

  /// A neighbourhood, not a pin. The coordinate is rounded to two places
  /// before it leaves the device, so asking for more would only cost time.
  const ACCURACY_M: f64 = 1000.0;

  /// The request in flight. Main-thread only, like CLLocationManager itself.
  /// Several callers can wait on one request: they all get the same answer.
  struct Pending {
    manager: Retained<CLLocationManager>,
    // The manager holds its delegate weakly; this is the strong reference.
    _delegate: Retained<LocationDelegate>,
    asked_for_fix: bool,
    waiting: Vec<Sender<Option<Fix>>>,
  }

  thread_local! {
    static PENDING: RefCell<Option<Pending>> = const { RefCell::new(None) };
  }

  fn finish(result: Option<Fix>) {
    let Some(p) = PENDING.with(|cell| cell.borrow_mut().take()) else {
      return;
    };
    unsafe { p.manager.setDelegate(None) };
    for tx in p.waiting {
      let _ = tx.send(result);
    }
  }

  /// Act on the current authorization. Called once when the request starts,
  /// and again every time the writer answers the prompt.
  fn advance(manager: &CLLocationManager) {
    let status = unsafe { manager.authorizationStatus() };
    if status == CLAuthorizationStatus::NotDetermined {
      unsafe { manager.requestWhenInUseAuthorization() };
    } else if status == CLAuthorizationStatus::AuthorizedAlways
      || status == CLAuthorizationStatus::AuthorizedWhenInUse
    {
      let first = PENDING.with(|cell| {
        let mut slot = cell.borrow_mut();
        match slot.as_mut() {
          Some(p) if !p.asked_for_fix => {
            p.asked_for_fix = true;
            true
          }
          _ => false,
        }
      });
      if first {
        unsafe { manager.requestLocation() };
      }
    } else {
      // Denied or restricted. A "no" ends it quietly, and is never asked twice.
      finish(None);
    }
  }

  define_class!(
    // SAFETY: NSObject has no subclassing requirements, and this type does
    // not implement Drop.
    #[unsafe(super = NSObject)]
    #[thread_kind = MainThreadOnly]
    #[name = "DayspringLocationDelegate"]
    struct LocationDelegate;

    unsafe impl NSObjectProtocol for LocationDelegate {}

    unsafe impl CLLocationManagerDelegate for LocationDelegate {
      #[unsafe(method(locationManager:didUpdateLocations:))]
      fn did_update_locations(&self, _manager: &CLLocationManager, locations: &NSArray<CLLocation>) {
        let Some(loc) = locations.lastObject() else {
          finish(None);
          return;
        };
        let coord = unsafe { loc.coordinate() };
        let accuracy = unsafe { loc.horizontalAccuracy() };
        if !coord.latitude.is_finite() || !coord.longitude.is_finite() {
          finish(None);
          return;
        }
        finish(Some(Fix {
          lat: coord.latitude,
          lon: coord.longitude,
          // CoreLocation reports a negative accuracy for an invalid fix.
          accuracy: (accuracy.is_finite() && accuracy >= 0.0).then_some(accuracy),
        }));
      }

      #[unsafe(method(locationManager:didFailWithError:))]
      fn did_fail(&self, _manager: &CLLocationManager, _error: &NSError) {
        finish(None);
      }

      #[unsafe(method(locationManagerDidChangeAuthorization:))]
      fn did_change_authorization(&self, manager: &CLLocationManager) {
        advance(manager);
      }

      // The same answer as it was delivered before macOS 11. Newer systems
      // may send both; `advance` only ever asks for one fix.
      #[unsafe(method(locationManager:didChangeAuthorizationStatus:))]
      fn did_change_authorization_status(&self, manager: &CLLocationManager, _status: CLAuthorizationStatus) {
        advance(manager);
      }
    }
  );

  impl LocationDelegate {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
      let this = Self::alloc(mtm).set_ivars(());
      unsafe { msg_send![super(this), init] }
    }
  }

  /// Start a request, or join the one already in flight. Main thread only.
  fn begin(mtm: MainThreadMarker, tx: Sender<Option<Fix>>) {
    let joined = PENDING.with(|cell| {
      if let Some(p) = cell.borrow_mut().as_mut() {
        p.waiting.push(tx.clone());
        true
      } else {
        false
      }
    });
    if joined {
      return;
    }

    let manager = unsafe { CLLocationManager::new() };
    let delegate = LocationDelegate::new(mtm);
    unsafe {
      manager.setDesiredAccuracy(ACCURACY_M);
      manager.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
    }
    PENDING.with(|cell| {
      *cell.borrow_mut() = Some(Pending {
        manager: manager.clone(),
        _delegate: delegate,
        asked_for_fix: false,
        waiting: vec![tx],
      });
    });
    // Recent macOS also calls locationManagerDidChangeAuthorization: as soon
    // as the delegate is set. `asked_for_fix` keeps the two from asking twice.
    advance(&manager);
  }

  pub async fn current_position(app: tauri::AppHandle) -> Option<Fix> {
    let (tx, rx) = channel();
    let scheduled = app.run_on_main_thread(move || {
      if let Some(mtm) = MainThreadMarker::new() {
        begin(mtm, tx);
      }
    });
    if scheduled.is_err() {
      return None;
    }
    let got = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(WAIT).ok().flatten())
      .await
      .ok()
      .flatten();
    if got.is_none() {
      // Timed out, or ended without a fix. Drop the request so the next page
      // starts a fresh one instead of joining one that will never answer.
      let _ = app.run_on_main_thread(|| finish(None));
    }
    got
  }
}
