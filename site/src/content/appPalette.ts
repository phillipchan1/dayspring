// The `/` palette as the hero mock draws it — hand-copied from the app's
// catalog (src/editor/slashCommands.ts) and capture icons
// (src/editor/spiritualBlockIcons.tsx), because the site build can't import
// app modules. appPalette.test.ts reads both files as text and fails the build
// if a label, hint, order or icon here stops matching the app.
//
// Only the rows the mock has room for: each column is a PREFIX of the app's,
// in the app's order. The real palette clips and scrolls the same way.

export interface PaletteFormatRow {
  label: string;
  badge: string;
  badgeStyle?: "bold" | "italic";
}

export interface PaletteCaptureRow {
  id: string;
  label: string;
  hint: string;
  /** `d` of each <path> in the app's icon; circles and rects as written there. */
  icon: string[];
}

export const paletteFormat: PaletteFormatRow[] = [
  { label: "Heading", badge: "#" },
  { label: "Subheading", badge: "##" },
  { label: "Small heading", badge: "###" },
  { label: "Bold", badge: "B", badgeStyle: "bold" },
  { label: "Italic", badge: "I", badgeStyle: "italic" },
  { label: "Underline", badge: "U" },
  { label: "Strikethrough", badge: "S" },
];

export const paletteCapture: PaletteCaptureRow[] = [
  {
    id: "scripture",
    label: "Scripture",
    hint: "Find relevant passages",
    icon: [
      "M12 7c-1.7-1.2-4-1.7-6.6-1.4a1 1 0 0 0-.9 1v10.2a1 1 0 0 0 1.1 1c2.4-.3 4.5.2 6.4 1.6 1.9-1.4 4-1.9 6.4-1.6a1 1 0 0 0 1.1-1V6.6a1 1 0 0 0-.9-1C16 5.3 13.7 5.8 12 7Z",
      "M12 7v11.4",
    ],
  },
  {
    id: "pray",
    label: "Prayer",
    hint: "Log a prayer",
    icon: [
      "M12 3.6c-.8 1.8-1.8 3.2-3 4.3-1 1-1.5 2-1.5 3.4v7.1a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7.1c0-1.4-.5-2.4-1.5-3.4-1.2-1.1-2.2-2.5-3-4.3Z",
      "M12 3.6v15.8",
    ],
  },
  {
    id: "sense",
    label: "Sense",
    hint: "A word or impression",
    icon: [
      "M12 4l1.7 5.1a2 2 0 0 0 1.2 1.2L20 12l-5.1 1.7a2 2 0 0 0-1.2 1.2L12 20l-1.7-5.1a2 2 0 0 0-1.2-1.2L4 12l5.1-1.7a2 2 0 0 0 1.2-1.2L12 4Z",
      "M19 4.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L17 6l1.5-.5Z",
    ],
  },
  {
    id: "desire",
    label: "Desire",
    hint: "Something you want",
    // + <circle cx="19.2" cy="12" r="1.3" /> — drawn by the mock.
    icon: ["M16.8 7.6a5.6 5.6 0 1 0 0 8.8"],
  },
  {
    id: "learned",
    label: "Learned",
    hint: "Something you would tell yourself again",
    icon: ["M4.5 10.5h15", "M12 10.5v5.5"],
  },
  {
    id: "story",
    label: "Story",
    hint: "A thing that happened, worth keeping",
    icon: ["M15.5 3.5c-4 0-2.5 7.5-7 8.5 4.5 1 3 8.5 7 8.5"],
  },
  {
    id: "ritual",
    label: "Ritual",
    hint: "Practices for the inner life",
    icon: [
      "M12 3c2.6 3.1 4.5 5.4 4.5 8.6a4.5 4.5 0 0 1-9 0c0-1.4.5-2.7 1.4-3.7.3 1 .9 1.7 1.6 2.1 0-2.4.4-4.5 1.5-7Z",
    ],
  },
];
