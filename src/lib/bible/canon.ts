// Canonical Bible book metadata — the single source of truth for the Scripture
// surface's layout, the reference parser's validation, and the OT/NT split.
//
// 66 Protestant-canon books, in canonical order. Pure data, no runtime fetch:
// the map and the parser both import this directly so they stay isomorphic
// (usable from the editor, the read-only view, and the backfill script alike).

export type Testament = 'OT' | 'NT'

export interface BibleBook {
  /** OSIS book code — e.g. 'Ps', 'Rom', 'John', '1Cor', 'Phil' (Philippians), 'Phlm' (Philemon). */
  osis: string
  /** Display name. */
  name: string
  /** 1..66 canonical position; drives sort + OT/NT split. */
  order: number
  testament: Testament
  /** Number of chapters — bounds the chapter grid and clamps parser output. */
  chapters: number
  /**
   * Lowercase textual forms the parser accepts for this book (full names,
   * common abbreviations, and numbered/roman-numeral variants). Spaces are
   * matched flexibly, so '1 cor' also catches '1cor'. Trailing-period forms
   * (e.g. 'gen.') are handled by the parser, not enumerated here.
   */
  abbr: string[]
}

export const BOOKS: BibleBook[] = [
  // ── Old Testament ─────────────────────────────────────────────────────────
  { osis: 'Gen', name: 'Genesis', order: 1, testament: 'OT', chapters: 50, abbr: ['genesis', 'gen', 'ge', 'gn'] },
  { osis: 'Exod', name: 'Exodus', order: 2, testament: 'OT', chapters: 40, abbr: ['exodus', 'exod', 'exo', 'ex'] },
  { osis: 'Lev', name: 'Leviticus', order: 3, testament: 'OT', chapters: 27, abbr: ['leviticus', 'lev', 'lv'] },
  { osis: 'Num', name: 'Numbers', order: 4, testament: 'OT', chapters: 36, abbr: ['numbers', 'num', 'nu', 'nm', 'nb'] },
  { osis: 'Deut', name: 'Deuteronomy', order: 5, testament: 'OT', chapters: 34, abbr: ['deuteronomy', 'deut', 'deu', 'dt'] },
  { osis: 'Josh', name: 'Joshua', order: 6, testament: 'OT', chapters: 24, abbr: ['joshua', 'josh', 'jos', 'jsh'] },
  { osis: 'Judg', name: 'Judges', order: 7, testament: 'OT', chapters: 21, abbr: ['judges', 'judg', 'jdg', 'jdgs'] },
  { osis: 'Ruth', name: 'Ruth', order: 8, testament: 'OT', chapters: 4, abbr: ['ruth', 'rth', 'ru'] },
  { osis: '1Sam', name: '1 Samuel', order: 9, testament: 'OT', chapters: 31, abbr: ['1 samuel', '1 sam', '1 sa', '1sam', '1sa', '1s', 'i samuel', 'i sam', 'first samuel'] },
  { osis: '2Sam', name: '2 Samuel', order: 10, testament: 'OT', chapters: 24, abbr: ['2 samuel', '2 sam', '2 sa', '2sam', '2sa', '2s', 'ii samuel', 'ii sam', 'second samuel'] },
  { osis: '1Kgs', name: '1 Kings', order: 11, testament: 'OT', chapters: 22, abbr: ['1 kings', '1 kgs', '1 kin', '1kings', '1kgs', '1ki', 'i kings', 'first kings'] },
  { osis: '2Kgs', name: '2 Kings', order: 12, testament: 'OT', chapters: 25, abbr: ['2 kings', '2 kgs', '2 kin', '2kings', '2kgs', '2ki', 'ii kings', 'second kings'] },
  { osis: '1Chr', name: '1 Chronicles', order: 13, testament: 'OT', chapters: 29, abbr: ['1 chronicles', '1 chron', '1 chr', '1chron', '1chr', '1ch', 'i chronicles', 'first chronicles'] },
  { osis: '2Chr', name: '2 Chronicles', order: 14, testament: 'OT', chapters: 36, abbr: ['2 chronicles', '2 chron', '2 chr', '2chron', '2chr', '2ch', 'ii chronicles', 'second chronicles'] },
  { osis: 'Ezra', name: 'Ezra', order: 15, testament: 'OT', chapters: 10, abbr: ['ezra', 'ezr', 'ez'] },
  { osis: 'Neh', name: 'Nehemiah', order: 16, testament: 'OT', chapters: 13, abbr: ['nehemiah', 'neh', 'ne'] },
  { osis: 'Esth', name: 'Esther', order: 17, testament: 'OT', chapters: 10, abbr: ['esther', 'esth', 'est', 'es'] },
  { osis: 'Job', name: 'Job', order: 18, testament: 'OT', chapters: 42, abbr: ['job', 'jb'] },
  { osis: 'Ps', name: 'Psalms', order: 19, testament: 'OT', chapters: 150, abbr: ['psalms', 'psalm', 'pslm', 'psm', 'pss', 'ps', 'psa'] },
  { osis: 'Prov', name: 'Proverbs', order: 20, testament: 'OT', chapters: 31, abbr: ['proverbs', 'prov', 'prv', 'pr'] },
  { osis: 'Eccl', name: 'Ecclesiastes', order: 21, testament: 'OT', chapters: 12, abbr: ['ecclesiastes', 'eccles', 'eccl', 'ecc', 'ec', 'qoheleth'] },
  { osis: 'Song', name: 'Song of Solomon', order: 22, testament: 'OT', chapters: 8, abbr: ['song of solomon', 'song of songs', 'song', 'sos', 'sng', 'canticles', 'cant'] },
  { osis: 'Isa', name: 'Isaiah', order: 23, testament: 'OT', chapters: 66, abbr: ['isaiah', 'isa', 'is'] },
  { osis: 'Jer', name: 'Jeremiah', order: 24, testament: 'OT', chapters: 52, abbr: ['jeremiah', 'jer', 'je', 'jr'] },
  { osis: 'Lam', name: 'Lamentations', order: 25, testament: 'OT', chapters: 5, abbr: ['lamentations', 'lament', 'lam', 'la'] },
  { osis: 'Ezek', name: 'Ezekiel', order: 26, testament: 'OT', chapters: 48, abbr: ['ezekiel', 'ezek', 'eze', 'ezk'] },
  { osis: 'Dan', name: 'Daniel', order: 27, testament: 'OT', chapters: 12, abbr: ['daniel', 'dan', 'da', 'dn'] },
  { osis: 'Hos', name: 'Hosea', order: 28, testament: 'OT', chapters: 14, abbr: ['hosea', 'hos', 'ho'] },
  { osis: 'Joel', name: 'Joel', order: 29, testament: 'OT', chapters: 3, abbr: ['joel', 'joe', 'jl'] },
  { osis: 'Amos', name: 'Amos', order: 30, testament: 'OT', chapters: 9, abbr: ['amos', 'amo', 'am'] },
  { osis: 'Obad', name: 'Obadiah', order: 31, testament: 'OT', chapters: 1, abbr: ['obadiah', 'obad', 'oba', 'ob'] },
  { osis: 'Jonah', name: 'Jonah', order: 32, testament: 'OT', chapters: 4, abbr: ['jonah', 'jon', 'jnh'] },
  { osis: 'Mic', name: 'Micah', order: 33, testament: 'OT', chapters: 7, abbr: ['micah', 'mic', 'mc'] },
  { osis: 'Nah', name: 'Nahum', order: 34, testament: 'OT', chapters: 3, abbr: ['nahum', 'nah', 'na'] },
  { osis: 'Hab', name: 'Habakkuk', order: 35, testament: 'OT', chapters: 3, abbr: ['habakkuk', 'hab', 'hb'] },
  { osis: 'Zeph', name: 'Zephaniah', order: 36, testament: 'OT', chapters: 3, abbr: ['zephaniah', 'zeph', 'zep', 'zp'] },
  { osis: 'Hag', name: 'Haggai', order: 37, testament: 'OT', chapters: 2, abbr: ['haggai', 'hag', 'hg'] },
  { osis: 'Zech', name: 'Zechariah', order: 38, testament: 'OT', chapters: 14, abbr: ['zechariah', 'zech', 'zec', 'zc'] },
  { osis: 'Mal', name: 'Malachi', order: 39, testament: 'OT', chapters: 4, abbr: ['malachi', 'mal', 'ml'] },
  // ── New Testament ─────────────────────────────────────────────────────────
  { osis: 'Matt', name: 'Matthew', order: 40, testament: 'NT', chapters: 28, abbr: ['matthew', 'matt', 'mat', 'mt'] },
  { osis: 'Mark', name: 'Mark', order: 41, testament: 'NT', chapters: 16, abbr: ['mark', 'mrk', 'mar', 'mk', 'mr'] },
  { osis: 'Luke', name: 'Luke', order: 42, testament: 'NT', chapters: 24, abbr: ['luke', 'luk', 'lk'] },
  { osis: 'John', name: 'John', order: 43, testament: 'NT', chapters: 21, abbr: ['john', 'jhn', 'jn'] },
  { osis: 'Acts', name: 'Acts', order: 44, testament: 'NT', chapters: 28, abbr: ['acts', 'act', 'ac'] },
  { osis: 'Rom', name: 'Romans', order: 45, testament: 'NT', chapters: 16, abbr: ['romans', 'rom', 'ro', 'rm'] },
  { osis: '1Cor', name: '1 Corinthians', order: 46, testament: 'NT', chapters: 16, abbr: ['1 corinthians', '1 cor', '1 co', '1corinthians', '1cor', '1co', 'i corinthians', 'first corinthians'] },
  { osis: '2Cor', name: '2 Corinthians', order: 47, testament: 'NT', chapters: 13, abbr: ['2 corinthians', '2 cor', '2 co', '2corinthians', '2cor', '2co', 'ii corinthians', 'second corinthians'] },
  { osis: 'Gal', name: 'Galatians', order: 48, testament: 'NT', chapters: 6, abbr: ['galatians', 'gal', 'ga'] },
  { osis: 'Eph', name: 'Ephesians', order: 49, testament: 'NT', chapters: 6, abbr: ['ephesians', 'eph', 'ephes'] },
  { osis: 'Phil', name: 'Philippians', order: 50, testament: 'NT', chapters: 4, abbr: ['philippians', 'phil', 'php', 'pp'] },
  { osis: 'Col', name: 'Colossians', order: 51, testament: 'NT', chapters: 4, abbr: ['colossians', 'col', 'co'] },
  { osis: '1Thess', name: '1 Thessalonians', order: 52, testament: 'NT', chapters: 5, abbr: ['1 thessalonians', '1 thess', '1 thes', '1 th', '1thessalonians', '1thess', '1th', 'i thessalonians', 'first thessalonians'] },
  { osis: '2Thess', name: '2 Thessalonians', order: 53, testament: 'NT', chapters: 3, abbr: ['2 thessalonians', '2 thess', '2 thes', '2 th', '2thessalonians', '2thess', '2th', 'ii thessalonians', 'second thessalonians'] },
  { osis: '1Tim', name: '1 Timothy', order: 54, testament: 'NT', chapters: 6, abbr: ['1 timothy', '1 tim', '1 ti', '1timothy', '1tim', '1ti', 'i timothy', 'first timothy'] },
  { osis: '2Tim', name: '2 Timothy', order: 55, testament: 'NT', chapters: 4, abbr: ['2 timothy', '2 tim', '2 ti', '2timothy', '2tim', '2ti', 'ii timothy', 'second timothy'] },
  { osis: 'Titus', name: 'Titus', order: 56, testament: 'NT', chapters: 3, abbr: ['titus', 'tit', 'ti'] },
  { osis: 'Phlm', name: 'Philemon', order: 57, testament: 'NT', chapters: 1, abbr: ['philemon', 'philem', 'phlm', 'phm', 'pm'] },
  { osis: 'Heb', name: 'Hebrews', order: 58, testament: 'NT', chapters: 13, abbr: ['hebrews', 'heb', 'hbr'] },
  { osis: 'Jas', name: 'James', order: 59, testament: 'NT', chapters: 5, abbr: ['james', 'jas', 'jm', 'jas'] },
  { osis: '1Pet', name: '1 Peter', order: 60, testament: 'NT', chapters: 5, abbr: ['1 peter', '1 pet', '1 pe', '1peter', '1pet', '1pe', '1pt', 'i peter', 'first peter'] },
  { osis: '2Pet', name: '2 Peter', order: 61, testament: 'NT', chapters: 3, abbr: ['2 peter', '2 pet', '2 pe', '2peter', '2pet', '2pe', '2pt', 'ii peter', 'second peter'] },
  { osis: '1John', name: '1 John', order: 62, testament: 'NT', chapters: 5, abbr: ['1 john', '1 jhn', '1 jn', '1john', '1jhn', '1jn', '1jo', 'i john', 'first john'] },
  { osis: '2John', name: '2 John', order: 63, testament: 'NT', chapters: 1, abbr: ['2 john', '2 jhn', '2 jn', '2john', '2jhn', '2jn', '2jo', 'ii john', 'second john'] },
  { osis: '3John', name: '3 John', order: 64, testament: 'NT', chapters: 1, abbr: ['3 john', '3 jhn', '3 jn', '3john', '3jhn', '3jn', '3jo', 'iii john', 'third john'] },
  { osis: 'Jude', name: 'Jude', order: 65, testament: 'NT', chapters: 1, abbr: ['jude', 'jud', 'jd'] },
  { osis: 'Rev', name: 'Revelation', order: 66, testament: 'NT', chapters: 22, abbr: ['revelation', 'revelations', 'rev', 're', 'rv', 'the revelation', 'apocalypse'] },
]

export const OT_BOOKS: BibleBook[] = BOOKS.filter((b) => b.testament === 'OT')
export const NT_BOOKS: BibleBook[] = BOOKS.filter((b) => b.testament === 'NT')

const BY_OSIS = new Map(BOOKS.map((b) => [b.osis, b]))

export function bookByOsis(osis: string): BibleBook | undefined {
  return BY_OSIS.get(osis)
}
