---
title: Formatting your writing
summary: Bold, italic, headings, lists and quotes — without a single asterisk in sight.
section: writing
order: 1
requires: [capability.editor]
keywords: [format, bold, italic, markdown, heading, list, quote, underline, asterisk, syntax, divider, rule]
updated: 2026-08-29
---

Select some text and a small bar appears above it. Bold, italic, underline,
strikethrough, highlight, code, link, list, quote, heading.

Or use the shortcuts: <kbd>⌘B</kbd> for bold, <kbd>⌘I</kbd> for italic,
<kbd>⌘U</kbd> for underline. On a new line, type `/` and pick a heading or a
list from the menu.

## Why you don't see asterisks

Dayspring stores entries as Markdown — a plain-text format, which is a large
part of why your writing will still be readable in twenty years and openable in
any text editor.

But Markdown means symbols: `**bold**`, `# heading`, `> quote`. Most apps show
you those symbols and expect you to live with them.

Dayspring hides them. Bold a word and you see a bold word. The asterisks are in
the file, but they only appear when your cursor moves inside that word — so you
can edit them if you want to, and otherwise never think about them.

If you'd rather see the raw characters all the time, there's a **Show markdown
syntax** switch in Settings → Writing.

## Lists

Type `-` and a space, and you're in a bullet list. Press Return for the next
item; press it twice to get out. Numbered lists renumber themselves when you
insert one in the middle. <kbd>Tab</kbd> indents, <kbd>Shift-Tab</kbd> steps
back out.

For checkboxes, use the **To-do** command in the slash menu.

## Highlights

<kbd>⌘⇧H</kbd> highlights the selection. (Not <kbd>⌘H</kbd> — macOS reserves
that for hiding the app.)

There's more than one highlighter colour; the swatches sit beside the highlight
button in the format bar.

## Headings

Three sizes, from the slash menu or by typing `#`, `##`, `###` at the start of
a line.

You rarely need them in a daily entry, but they earn their keep in a long
retreat entry or a set of sermon notes.

## Dividers

On a line of its own, type `---` — or pick **Divider** from the slash menu.
It becomes a quiet break in the page, painted to match the palette you're
writing in. Click it and the dashes come back, so you can delete it.

## Marking a passage

There's one formatting action that only appears on entries from a **previous
day**: **Mark this passage**.

That's on purpose. Marking is a reading act, not a writing one — it's for when
you come back to something months later and realise it mattered. You can't mark
a sentence you wrote ten seconds ago, because you don't know yet.

## Something odd worth knowing

If a line starts with several spaces of indentation, Markdown treats it as a
code block, and it'll turn monospaced. If your text unexpectedly looks like
code, that's why — remove the leading spaces and it returns to normal.
