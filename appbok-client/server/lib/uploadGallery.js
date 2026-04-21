/**
 * Upload a gallery image to Supabase Storage and return the public URL.
 *
 * Bucket: "backgrounds" (re-used for gallery)
 * Path:   {salonId}/gallery/{timestamp}-{basename}.{ext}
 *
 * @param {object} opts
 * @param {string} opts.salonId
 * @param {Buffer|Uint8Array} opts.fileBuffer
 * @param {string} opts.fileName
 * @param {string} opts.mimeType  - e.g. "image/jpeg", "image/webp", "image/png"
 * @returns {Promise<string>} public URL
 */
export async function uploadGalleryToSupabase({ salonId, fileBuffer, fileName, mimeType }) {
  const { createClient } = await import('@supabase/supabase-js');
  const dotenv = await import('dotenv');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');

  const __dirname = dirname(fileURLToPath(import.meta.url));
  dotenv.default.config({ path: join(__dirname, '..', '.env') });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const extFromMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  const ext = extFromMime[mimeType] || fileName.split('.').pop() || 'jpg';
  const safeName = String(salonId || 'unknown').replace(/[^a-zA-Z0-9-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `${safeName}/gallery/${timestamp}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('backgrounds')
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: urlData, error: urlError } = supabase.storage
    .from('backgrounds')
    .getPublicUrl(storagePath);

  if (urlError) {
    throw new Error(`Could not get public URL: ${urlError.message}`);
  }

  return urlData.publicUrl;
}
