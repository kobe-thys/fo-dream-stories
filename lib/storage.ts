import { createClient } from '@/lib/supabase/client'

/**
 * Upload a Blob to Supabase Storage and return the public URL.
 * Bucket must already exist and be configured in Supabase.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: Blob,
  contentType: string
): Promise<string> {
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** Generate a UUID-like path segment for unique filenames */
export function storagePath(
  childProfileId: string,
  tileId: string,
  ext: string
): string {
  const uid = crypto.randomUUID()
  return `${childProfileId}/${tileId}/${uid}.${ext}`
}
