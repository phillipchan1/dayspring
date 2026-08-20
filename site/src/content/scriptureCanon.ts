// Canon data for ScriptureTeaser — matches dayspring-scripture-view.html

export type CanonBook = readonly [name: string, chapters: number, base: number];

export const scriptureOT: CanonBook[] = [
  ["Genesis", 50, 0.42],
  ["Exodus", 40, 0.3],
  ["Leviticus", 27, 0.04],
  ["Numbers", 36, 0.05],
  ["Deuteronomy", 34, 0.18],
  ["Joshua", 24, 0.12],
  ["Judges", 21, 0.08],
  ["Ruth", 4, 0.3],
  ["1 Samuel", 31, 0.18],
  ["2 Samuel", 24, 0.14],
  ["1 Kings", 22, 0.08],
  ["2 Kings", 25, 0.05],
  ["1 Chron.", 29, 0.03],
  ["2 Chron.", 36, 0.04],
  ["Ezra", 10, 0.06],
  ["Nehemiah", 13, 0.16],
  ["Esther", 10, 0.18],
  ["Job", 42, 0.46],
  ["Psalms", 150, 0.96],
  ["Proverbs", 31, 0.58],
  ["Eccles.", 12, 0.52],
  ["Song", 8, 0.2],
  ["Isaiah", 66, 0.5],
  ["Jeremiah", 52, 0.3],
  ["Lament.", 5, 0.62],
  ["Ezekiel", 48, 0.12],
  ["Daniel", 12, 0.26],
  ["Hosea", 14, 0.14],
  ["Joel", 3, 0.1],
  ["Amos", 9, 0.08],
  ["Obadiah", 1, 0.02],
  ["Jonah", 4, 0.22],
  ["Micah", 7, 0.2],
  ["Nahum", 3, 0.02],
  ["Habakkuk", 3, 0.4],
  ["Zeph.", 3, 0.05],
  ["Haggai", 2, 0.06],
  ["Zech.", 14, 0.1],
  ["Malachi", 4, 0.14],
];

export const scriptureNT: CanonBook[] = [
  ["Matthew", 28, 0.62],
  ["Mark", 16, 0.4],
  ["Luke", 24, 0.5],
  ["John", 21, 0.82],
  ["Acts", 28, 0.42],
  ["Romans", 16, 0.78],
  ["1 Cor.", 16, 0.48],
  ["2 Cor.", 13, 0.44],
  ["Galatians", 6, 0.4],
  ["Ephesians", 6, 0.56],
  ["Philippians", 4, 0.72],
  ["Colossians", 4, 0.38],
  ["1 Thess.", 5, 0.26],
  ["2 Thess.", 3, 0.12],
  ["1 Timothy", 6, 0.2],
  ["2 Timothy", 4, 0.34],
  ["Titus", 3, 0.1],
  ["Philemon", 1, 0.06],
  ["Hebrews", 13, 0.44],
  ["James", 5, 0.5],
  ["1 Peter", 5, 0.4],
  ["2 Peter", 3, 0.16],
  ["1 John", 5, 0.54],
  ["2 John", 1, 0.06],
  ["3 John", 1, 0.04],
  ["Jude", 1, 0.06],
  ["Revelation", 22, 0.36],
];

export const scriptureSeasons = [
  { id: "all", label: "All time", note: "" },
  {
    id: "grief",
    label: "The hard year",
    note: "In the hard year, you lived in the laments — Psalms, Lamentations, Job, and Habakkuk held you when little else did.",
  },
  {
    id: "spring",
    label: "This spring",
    note: "This spring your eyes have lifted — the Gospels, Acts, and Philippians, the language of resurrection and joy.",
  },
  {
    id: "dry",
    label: "A dry stretch",
    note: "In the dry stretch you mostly stopped — a few honest Psalms, a return to Proverbs for something to hold onto.",
  },
] as const;

export type ScriptureSeasonId = (typeof scriptureSeasons)[number]["id"];

const seasonProfiles: Record<
  ScriptureSeasonId,
  { fade: number; boost: Record<string, number> }
> = {
  all: { fade: 1, boost: {} },
  grief: {
    fade: 0.22,
    boost: {
      Psalms: 1.1,
      "Lament.": 1.6,
      Job: 1.5,
      "Eccles.": 1.3,
      Habakkuk: 1.7,
      "2 Cor.": 1.4,
      Romans: 1.1,
      Isaiah: 1.1,
    },
  },
  spring: {
    fade: 0.2,
    boost: {
      John: 1.4,
      Matthew: 1.3,
      Luke: 1.3,
      Acts: 1.6,
      Philippians: 1.6,
      Romans: 1.2,
      "1 Peter": 1.2,
    },
  },
  dry: {
    fade: 0.1,
    boost: { Psalms: 0.7, Proverbs: 0.9, "Eccles.": 0.8, James: 0.6 },
  },
};

export const scriptureReturning = [
  { ref: "Psalm 23:2", count: "returned 9×" },
  { ref: "Romans 8:28", count: "returned 7×" },
  { ref: "John 15:5", count: "returned 6×" },
  { ref: "Lam. 3:22-23", count: "returned 5×" },
  { ref: "Phil. 4:6", count: "returned 5×" },
];

/** Marketing card — hero books only, rendered at full size (not scaled-down full canon). */
export const scriptureMarketingOT = new Set([
  "Genesis",
  "Exodus",
  "Deuteronomy",
  "Job",
  "Psalms",
  "Proverbs",
  "Isaiah",
  "Lament.",
  "Habakkuk",
]);

export const scriptureMarketingNT = new Set([
  "Matthew",
  "John",
  "Romans",
  "Philippians",
  "James",
]);

export function seed(n: number): number {
  let t = n + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function colorFor(v: number): string | null {
  if (v <= 0) return null;
  const c1 = [197, 106, 110];
  const c2 = [243, 189, 118];
  const t = Math.min(1, v);
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r},${g},${b})`;
}

export function bookIntensity(book: CanonBook, seasonId: ScriptureSeasonId): number {
  const profile = seasonProfiles[seasonId];
  let v = book[2];
  if (seasonId !== "all") {
    const m = profile.boost[book[0]];
    v = m ? Math.min(1, v * m) : v * profile.fade;
  }
  return v;
}

export interface BookCell {
  bg: string;
  shadow: string;
}

export function buildBookCells(
  book: CanonBook,
  seasonId: ScriptureSeasonId,
  offset: number,
  index: number,
): { cols: number; cells: BookCell[]; lit: boolean } {
  const v = bookIntensity(book, seasonId);
  const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(book[1]))));
  const nLit = Math.round(book[1] * v);
  const cells: BookCell[] = [];
  for (let c = 0; c < book[1]; c++) {
    const r = seed((offset + index) * 97 + c * 13);
    const lit = r < nLit / book[1];
    if (!lit) {
      cells.push({ bg: "var(--cell-unlit)", shadow: "none" });
      continue;
    }
    const b = 0.45 + 0.55 * seed((offset + index) * 31 + c * 7) * v;
    const col = colorFor(b)!;
    const glow = col.replace("rgb", "rgba").replace(")", `,${0.45 * b})`);
    cells.push({
      bg: col,
      shadow: `0 0 ${Math.round(4 + 10 * b)}px ${glow}`,
    });
  }
  return { cols, cells, lit: v > 0.28 };
}
