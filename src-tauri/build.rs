fn main() {
  // Explicit rerun-if-changed prevents Cargo from scanning all of src-tauri/,
  // which would hit gen/apple/*.xcodeproj and be blocked by Xcode's build sandbox.
  println!("cargo:rerun-if-changed=src");
  println!("cargo:rerun-if-changed=Cargo.toml");
  println!("cargo:rerun-if-changed=tauri.conf.json");
  // The Mac's window overrides (hidden until first paint, traffic lights,
  // inspector off) — merged over tauri.conf.json for macOS targets only.
  println!("cargo:rerun-if-changed=tauri.macos.conf.json");
  println!("cargo:rerun-if-changed=build.rs");
  tauri_build::build()
}
