import * as FileSystem from "expo-file-system/legacy"

const MEDIA_FOLDER_NAME = "raota-media/"

export const MEDIA_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${MEDIA_FOLDER_NAME}`
  : null

function extensionFromUri(uri: string): string {
  const path = uri.split(/[?#]/, 1)[0] ?? ""
  const match = path.match(/\.([a-zA-Z0-9]{2,5})$/)
  return match ? `.${match[1].toLowerCase()}` : ".jpg"
}

function safePrefix(prefix: string): string {
  const cleaned = prefix.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")
  return cleaned.replace(/^-+|-+$/g, "") || "media"
}

async function ensureMediaDirectory(): Promise<string | null> {
  if (!MEDIA_DIRECTORY) return null
  const info = await FileSystem.getInfoAsync(MEDIA_DIRECTORY)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_DIRECTORY, {
      intermediates: true,
    })
  }
  return MEDIA_DIRECTORY
}

export function isPersistedMediaUri(uri: string | null | undefined): boolean {
  return Boolean(uri && MEDIA_DIRECTORY && uri.startsWith(MEDIA_DIRECTORY))
}

/** Copies a picker/camera URI into the durable app documents directory. */
export async function persistMediaFile(
  uri: string,
  prefix = "media",
): Promise<string> {
  if (
    !uri ||
    isPersistedMediaUri(uri) ||
    /^https?:\/\//i.test(uri) ||
    uri.startsWith("data:")
  ) {
    return uri
  }

  const directory = await ensureMediaDirectory()
  if (!directory) return uri

  const filename = `${safePrefix(prefix)}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${extensionFromUri(uri)}`
  const destination = `${directory}${filename}`
  await FileSystem.copyAsync({ from: uri, to: destination })
  return destination
}

export async function persistMediaFiles(
  uris: string[],
  prefix = "media",
): Promise<string[]> {
  const persisted: string[] = []
  try {
    for (const [index, uri] of uris.entries()) {
      persisted.push(await persistMediaFile(uri, `${prefix}-${index + 1}`))
    }
    return persisted
  } catch (error) {
    await deletePersistedMediaMany(persisted)
    throw error
  }
}

export async function deletePersistedMedia(
  uri: string | null | undefined,
): Promise<void> {
  if (typeof uri !== "string" || !isPersistedMediaUri(uri)) return
  await FileSystem.deleteAsync(uri, { idempotent: true })
}

export async function deletePersistedMediaMany(
  uris: Array<string | null | undefined>,
): Promise<void> {
  const uniqueUris = [
    ...new Set(
      uris.filter(
        (uri): uri is string =>
          typeof uri === "string" && isPersistedMediaUri(uri),
      ),
    ),
  ]
  // File cleanup is best-effort: a missing/corrupted file must never keep the
  // corresponding record or account alive in persisted application state.
  await Promise.allSettled(uniqueUris.map((uri) => deletePersistedMedia(uri)))
}

/** Removes every app-owned media file, including leftovers from abandoned old drafts. */
export async function clearPersistedMediaDirectory(): Promise<void> {
  if (!MEDIA_DIRECTORY) return
  await FileSystem.deleteAsync(MEDIA_DIRECTORY, { idempotent: true })
}
