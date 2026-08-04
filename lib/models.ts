import manifest from '@/public/models/manifest.json'

const HASHES: Map<string, string> = new Map(
  (manifest.models as { file: string; hash?: string }[]).map(m => [m.file, m.hash ?? ''])
)

/**
 * URL for a tile model, carrying a content-hash cache-buster.
 *
 * Model filenames stay the same when a tile is re-normalized, so both the browser
 * HTTP cache and drei's useGLTF cache (keyed on the URL) keep serving the old
 * geometry — an updated tile appears unchanged until a hard refresh, and it is not
 * obvious whether the deploy even landed. Appending the content hash makes an
 * updated tile a genuinely different resource.
 *
 * Falls back to the bare path for models missing from the manifest, so a tile
 * referenced by the DB but not yet in the manifest still loads.
 */
export function modelUrl(file: string): string {
  const hash = HASHES.get(file)
  return `/models/${encodeURIComponent(file)}${hash ? `?v=${hash}` : ''}`
}
