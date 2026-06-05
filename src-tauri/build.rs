fn main() {
  // Explicit rerun-if-changed prevents Cargo from scanning all of src-tauri/,
  // which would hit gen/apple/*.xcodeproj and be blocked by Xcode's build sandbox.
  println!("cargo:rerun-if-changed=src");
  println!("cargo:rerun-if-changed=Cargo.toml");
  println!("cargo:rerun-if-changed=tauri.conf.json");
  println!("cargo:rerun-if-changed=build.rs");
  tauri_build::build()
}
