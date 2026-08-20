---
title: Bring your old journal in
summary: Import from Day One, Diarly, or a Dayspring backup. Your history arrives dated correctly, and the surfaces read it as if you'd always been here.
section: getting-started
order: 4
requires: [capability.import]
keywords: [import, day one, diarly, migrate, transfer, move, backup, restore, existing]
updated: 2026-08-10
---

You don't have to start from an empty page. Dayspring reads exports from
{{counts.importers}} other journals, and everything comes in dated properly —
so a decade of Day One entries lands across a decade, not all on today.

Go to **Settings → Import & backup**.

> Importing is a desktop job. It's disabled on phones — these exports are often
> hundreds of megabytes, and unpacking one on a phone is a bad time. Import on
> your Mac or in a browser; it'll be on your phone a moment later.

## Day One

1. Open Day One and choose **File → Export**.
2. Pick **JSON** as the format — not PDF, not plain text.
3. Save the `.zip`. It contains one JSON file per journal.
4. Drop the `.zip` onto the import panel, or drag in the unzipped folder.

Every journal in the export comes in at once. Full timestamps, tags and starred
entries carry over, and photos are imported. Audio recordings and PDFs are not.

## Diarly

1. Open Diarly on your Mac, then **Diarly → Preferences → Sync & Backup**.
2. Click **Export** and choose **Markdown**.
3. Pick all journals, or just one, and save the `.zip`.
4. Drop it onto the import panel.

Dates are read from each file's path, and photos come across too.

## A Dayspring backup

If you're restoring your own [backup](/help/download-a-backup), drop the
`dayspring-backup-YYYY-MM-DD.zip` straight in. Entries are matched by their
original ID, so restoring twice never gives you two of everything.

## Your files stay yours

The whole import runs **in your browser**. The archive is read on your machine
and the entries go straight into your journal. It isn't uploaded to a
third-party service to be processed.

## One thing to do afterwards

Imported entries skip the editor, so Bible references in them haven't been
noticed yet — which means [the Lamp](/help/the-lamp) would look emptier than
your life actually was.

There's a **Scan journal for references** button in the scripture settings. It
reads your imported entries on your device and lights up the Lamp accordingly.
Run it once after a big import.

## Coming later

Journey, Apple Journal, and generic Markdown folders are on the way. If you have
one of those exports, hold on to it — and [tell us which
one](/help/contact), because that's genuinely how we decide the order.
