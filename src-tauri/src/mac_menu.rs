//! The Mac menu bar (DESIGN_PRINCIPLES N4).
//!
//! Tauri's default menu has Edit and Window and nothing of Dayspring's own —
//! no Settings…, no New Entry, no Go. A command that only exists as a hidden
//! keyboard shortcut is undiscoverable, so every app command the shortcut
//! sheet lists is here too, with the same chord.
//!
//! The chords are copied from `src/features/shortcuts/shortcuts.ts`, which is
//! the single source of truth. `src/lib/nativeMenu.test.ts` reads this file
//! and fails if an id or an accelerator here drifts from it, so change both
//! together.
//!
//! App commands are plain custom items. Picking one emits `native-menu` with
//! the item's id to the webview, and `src/lib/nativeMenu.ts` replays the
//! command's own keyboard shortcut there, so "what ⌘N does" stays defined in
//! one place (useJournalShortcuts.ts) whether it came from the keyboard or
//! the menu. Everything the system already knows how to do (Undo, Copy,
//! Hide, Full Screen, Minimize…) is a predefined item and never reaches JS.
//!
//! ⌘W is the predefined Close item, i.e. `performClose:`. That raises the
//! same CloseRequested the red traffic light does, which `lib.rs` turns into
//! "close the top layer first, then hide the window" — never quit.

use tauri::menu::{
  Menu, MenuBuilder, MenuItem, MenuItemBuilder, Submenu, SubmenuBuilder, HELP_SUBMENU_ID,
  WINDOW_SUBMENU_ID,
};
use tauri::{AppHandle, Runtime};

/// The event the webview listens for (src/lib/nativeMenu.ts).
pub const MENU_EVENT: &str = "native-menu";

/// Every custom item's id. Predefined items have generated ids and never
/// reach `on_menu_event` as one of these.
pub const COMMAND_IDS: &[&str] = &[
  "settings",
  "check-updates",
  "new-entry",
  "print",
  "find",
  "find-or-ask",
  "bold",
  "italic",
  "underline",
  "highlight",
  "link",
  "focus-mode",
  "zoom-in",
  "zoom-out",
  "zoom-reset",
  "go-write",
  "go-journal",
  "go-ascent",
  "go-lamp",
  "go-altar",
  "go-back",
  "go-forward",
  "shortcuts",
];

/// True for the ids `build` gives its custom items.
pub fn is_app_command(id: &str) -> bool {
  COMMAND_IDS.contains(&id)
}

fn command<R: Runtime>(
  app: &AppHandle<R>,
  id: &str,
  text: &str,
  accelerator: Option<&str>,
) -> tauri::Result<MenuItem<R>> {
  let builder = MenuItemBuilder::with_id(id, text);
  let builder = match accelerator {
    Some(accelerator) => builder.accelerator(accelerator),
    None => builder,
  };
  builder.build(app)
}

/// Build the whole menu bar. Errors propagate so the caller can log them and
/// keep Tauri's default menu, rather than launch with no Edit menu (and so no
/// Copy or Paste).
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
  let dayspring: Submenu<R> = SubmenuBuilder::new(app, "Dayspring")
    .about_with_text("About Dayspring", None)
    .separator()
    .item(&command(app, "settings", "Settings…", Some("CmdOrCtrl+,"))?)
    .item(&command(app, "check-updates", "Check for Updates…", None)?)
    .separator()
    .services()
    .separator()
    .hide_with_text("Hide Dayspring")
    .hide_others()
    .show_all()
    .separator()
    .quit_with_text("Quit Dayspring")
    .build()?;

  let file: Submenu<R> = SubmenuBuilder::new(app, "File")
    .item(&command(app, "new-entry", "New Entry", Some("CmdOrCtrl+N"))?)
    .separator()
    .close_window_with_text("Close")
    .separator()
    .item(&command(app, "print", "Print…", Some("CmdOrCtrl+P"))?)
    .build()?;

  // ⌘K appears twice on purpose, as it does in shortcuts.ts: Find or Ask, and
  // Link with text selected. The webview tells them apart by the selection;
  // whichever item AppKit matches, the replayed ⌘K lands on the same handler.
  let edit: Submenu<R> = SubmenuBuilder::new(app, "Edit")
    .undo()
    .redo()
    .separator()
    .cut()
    .copy()
    .paste()
    .select_all()
    .separator()
    .item(&command(app, "find", "Find…", Some("CmdOrCtrl+F"))?)
    .item(&command(app, "find-or-ask", "Find or Ask…", Some("CmdOrCtrl+K"))?)
    .build()?;

  let format: Submenu<R> = SubmenuBuilder::new(app, "Format")
    .item(&command(app, "bold", "Bold", Some("CmdOrCtrl+B"))?)
    .item(&command(app, "italic", "Italic", Some("CmdOrCtrl+I"))?)
    .item(&command(app, "underline", "Underline", Some("CmdOrCtrl+U"))?)
    .item(&command(app, "highlight", "Highlight", Some("CmdOrCtrl+Shift+H"))?)
    .separator()
    .item(&command(app, "link", "Link…", Some("CmdOrCtrl+K"))?)
    .build()?;

  let view: Submenu<R> = SubmenuBuilder::new(app, "View")
    .item(&command(app, "focus-mode", "Focus Mode", Some("CmdOrCtrl+Enter"))?)
    .separator()
    .item(&command(app, "zoom-in", "Bigger", Some("CmdOrCtrl+="))?)
    .item(&command(app, "zoom-out", "Smaller", Some("CmdOrCtrl+-"))?)
    .item(&command(app, "zoom-reset", "Actual Size", Some("CmdOrCtrl+0"))?)
    .separator()
    .fullscreen_with_text("Enter Full Screen")
    .build()?;

  let go: Submenu<R> = SubmenuBuilder::new(app, "Go")
    .item(&command(app, "go-write", "New Entry", Some("CmdOrCtrl+1"))?)
    .item(&command(app, "go-journal", "Journal", Some("CmdOrCtrl+2"))?)
    .item(&command(app, "go-ascent", "Ascent", Some("CmdOrCtrl+3"))?)
    .item(&command(app, "go-lamp", "Lamp", Some("CmdOrCtrl+4"))?)
    .item(&command(app, "go-altar", "Altar", Some("CmdOrCtrl+5"))?)
    .separator()
    .item(&command(app, "go-back", "Back", Some("CmdOrCtrl+["))?)
    .item(&command(app, "go-forward", "Forward", Some("CmdOrCtrl+]"))?)
    .build()?;

  // The reserved ids make Tauri hand these two to AppKit as the Window menu
  // (window list, Bring All to Front) and the Help menu (the search field).
  let window: Submenu<R> = SubmenuBuilder::with_id(app, WINDOW_SUBMENU_ID, "Window")
    .minimize()
    .maximize_with_text("Zoom")
    .separator()
    .bring_all_to_front()
    .build()?;

  let help: Submenu<R> = SubmenuBuilder::with_id(app, HELP_SUBMENU_ID, "Help")
    .item(&command(app, "shortcuts", "Keyboard Shortcuts", None)?)
    .build()?;

  MenuBuilder::new(app)
    .items(&[&dayspring, &file, &edit, &format, &view, &go, &window, &help])
    .build()
}
