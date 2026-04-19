/**
 * Upload a logo image to Supabase Storage and return the public URL.
 *
 * Bucket: "logos" (must exist and be public)
 * Path:   {salonId}/{timestamp}-{basename}.{ext}
 *
 * @param {object} opts
 * @param {string} opts.salonId  - The salon DB id
 * @param {string} opts.fileBuffer - Raw file buffer (Uint8Array/Buffer)
 * @param {string} opts.fileName   - Original file name (used for extension)
 * @param {string} opts.mimeType   - e.g. "image/png", "image/jpeg", "image/svg+xml"
 * @returns {Promise<string>} public URL of the uploaded file
 */
export async function uploadLogoToSupabase({ salonId, fileBuffer, fileName, mimeType }) {
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

  // Derive extension from mime type or original filename
  const extFromMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/svg+xml': 'svg',
  };
  const ext = extFromMime[mimeType] || fileName.split('.').pop() || 'png';
  const safeName = String(salonId || 'unknown').replace(/[^a-zA-Z0-9-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `${safeName}/${timestamp}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('logos')
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: urlData, error: urlError } = supabase.storage
    .from('logos')
    .getPublicUrl(storagePath);

  if (urlError) {
    throw new Error(`Could not get public URL: ${urlError.message}`);
  }

  console.log('[uploadLogo] storagePath:', storagePath, '→ publicUrl:', urlData.publicUrl);
  return urlData.publicUrl;
}
