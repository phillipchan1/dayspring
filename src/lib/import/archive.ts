// A source-agnostic view over an import payload — either a .zip the user picked
// or a *folder* they dropped. Several apps (Day One especially) can leave an
// export as a plain folder of JSON + media rather than a single .zip, and that's
// exactly what trips people up. Parsers and the image pipeline read files
// through this interface, so they never care whether the bytes came from a zip
// entry or a file on disk — the same code path imports both.

/** One file inside an archive. Contents are read lazily so we never hold the
 *  whole export in memory at once (a zip stays compressed until a file is read). */
export interface ArchiveFile {
  /** Forward-slash path within the archive. May include a top-level folder. */
  path: string
  /** Contents decoded as UTF-8 text. */
  text(): Promise<string>
  /** Raw contents as a Blob — for binary assets like photos. */
  blob(): Promise<Blob>
}

export interface ImportArchive {
  /** Every non-directory file in the archive. */
  files: ArchiveFile[]
}

/** Lower-cased-friendly basename of a path (final segment, no directories). */
export function baseName(path: string): string {
  const segs = path.split('/').filter(Boolean)
  return segs[segs.length - 1] ?? path
}

/** Find a file by exact basename (case-insensitive), ignoring any folder prefix. */
export function findByName(archive: ImportArchive, name: string): ArchiveFile | undefined {
  const lower = name.toLowerCase()
  return archive.files.find((f) => baseName(f.path).toLowerCase() === lower)
}

// ── Zip ───────────────────────────────────────────────────────────────────────

/** Build an archive from zip bytes. Entries inflate lazily (memory stays bounded). */
export async function zipArchive(data: ArrayBuffer | Blob): Promise<ImportArchive> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data)
  const files: ArchiveFile[] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    files.push({
      path: entry.name,
      text: () => entry.async('string'),
      blob: () => entry.async('blob'),
    })
  }
  return { files }
}

// ── Folder ────────────────────────────────────────────────────────────────────

/** A file from a folder, paired with its path relative to the dropped root. */
export interface FolderFile {
  path: string
  file: File
}

/** Build an archive from a set of folder files (a dropped directory, or a
 *  webkitdirectory picker). A File is already a Blob, so reads are trivial. */
export function folderArchive(entries: FolderFile[]): ImportArchive {
  return {
    files: entries.map(({ path, file }) => ({
      path,
      text: () => file.text(),
      blob: () => Promise.resolve(file as Blob),
    })),
  }
}

// ── Building archives from browser drop / file-input events ────────────────────

const ZIP_RE = /\.zip$/i

/** Read a dropped directory entry recursively into a flat FolderFile list. */
async function readDirEntry(
  dir: FileSystemDirectoryEntry,
  prefix: string,
  out: FolderFile[],
): Promise<void> {
  const reader = dir.createReader()
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject))
  // readEntries returns the directory in batches; keep calling until it's empty.
  for (;;) {
    const batch = await readBatch()
    if (batch.length === 0) break
    for (const child of batch) {
      const childPath = `${prefix}${child.name}`
      if (child.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (child as FileSystemFileEntry).file(resolve, reject),
        )
        out.push({ path: childPath, file })
      } else if (child.isDirectory) {
        await readDirEntry(child as FileSystemDirectoryEntry, `${childPath}/`, out)
      }
    }
  }
}

const entryFile = (e: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => e.file(resolve, reject))

/**
 * Build an archive from a drag-and-drop, so the user doesn't have to think about
 * the format: a dropped .zip, a dropped folder, or loose files all Just Work.
 * Returns null when nothing usable was dropped.
 *
 * NOTE: DataTransfer entries are only valid synchronously during the drop event,
 * so we capture every `webkitGetAsEntry()` up front before any await.
 */
export async function archiveFromDrop(dt: DataTransfer): Promise<ImportArchive | null> {
  const entries = Array.from(dt.items ?? [])
    .map((it) => (typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => !!e)

  if (entries.length > 0) {
    // A single dropped .zip → unzip it.
    if (entries.length === 1 && entries[0]!.isFile && ZIP_RE.test(entries[0]!.name)) {
      const file = await entryFile(entries[0] as FileSystemFileEntry)
      return zipArchive(await file.arrayBuffer())
    }
    // Otherwise gather every file from the dropped folders/files.
    const out: FolderFile[] = []
    for (const entry of entries) {
      if (entry.isDirectory) {
        await readDirEntry(entry as FileSystemDirectoryEntry, `${entry.name}/`, out)
      } else if (entry.isFile) {
        out.push({ path: entry.name, file: await entryFile(entry as FileSystemFileEntry) })
      }
    }
    if (out.length === 1 && ZIP_RE.test(out[0]!.path)) {
      return zipArchive(await out[0]!.file.arrayBuffer())
    }
    if (out.length > 0) return folderArchive(out)
  }

  // Fallback for browsers without the entry API: use the plain file list.
  return archiveFromFiles(dt.files)
}

/** Build an archive from a file-input selection: a single .zip, or the files of
 *  a folder chosen via a `webkitdirectory` input (which carry webkitRelativePath). */
export async function archiveFromFiles(files: FileList | File[] | null): Promise<ImportArchive | null> {
  const list = Array.from(files ?? [])
  if (list.length === 0) return null
  if (list.length === 1 && ZIP_RE.test(list[0]!.name)) {
    return zipArchive(await list[0]!.arrayBuffer())
  }
  return folderArchive(
    list.map((f) => ({
      path: (f as { webkitRelativePath?: string }).webkitRelativePath || f.name,
      file: f,
    })),
  )
}
