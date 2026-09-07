---
title: The Mac app won't open or update
summary: Gatekeeper on first launch, and what to do if an update seems stuck.
section: troubleshooting
order: 3
requires: []
platforms: [macos]
keywords: [mac, macos, update, gatekeeper, damaged, open, install, version, restart]
updated: 2026-08-10
---

## "Downloaded from the internet"

macOS shows this the first time you open any newly downloaded app. Click
**Open** and it won't ask again.

Dayspring is signed and notarised by Apple, so you shouldn't see anything
stronger than that. If macOS claims the app is *damaged*, the download was
probably incomplete — delete it, empty the Trash, and download it again.

## How updating works

The Mac app checks for updates by itself and installs them quietly in the
background. When one is ready you get a small prompt offering to restart.
There's nothing to download manually.

You can also check by hand in **Settings → About**.

## An update that won't apply

1. **Quit Dayspring properly** — <kbd>⌘Q</kbd>, not just closing the window.
   An update can't replace a running app.
2. Open it again and let it check.
3. If it's still stuck, download a fresh copy and drag it over the old one in
   Applications. Your writing isn't in the app, so replacing it loses nothing.

## Where your writing actually is

Not inside the app bundle. It's in your Library folder and on our servers, so
deleting and reinstalling the app never touches your journal.

## Checking your version

**Settings → About** shows the version you're on and what changed recently.
Include that version if you [report something](/help/contact) — it saves a
round-trip.
