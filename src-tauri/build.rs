fn main() {
  // Tell Cargo to only watch these paths for rebuild decisions.
  // Without this, Cargo scans all of src-tauri/ including gen/apple/*.xcodeproj,
  // which macOS prevents non-Xcode processes from reading (os error 1).
  println!("cargo:rerun-if-changed=src");
  println!("cargo:rerun-if-changed=Cargo.toml");
  println!("cargo:rerun-if-changed=tauri.conf.json");
  println!("cargo:rerun-if-changed=build.rs");
  tauri_build::build()
}
