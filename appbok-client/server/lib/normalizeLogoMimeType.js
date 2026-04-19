/**
 * Normalize browser-reported MIME types to canonical values.
 * Browsers often send octet-stream for PNG/JPG — we fix that.
 */
export function normalizeLogoMimeType(mimeType, fileName) {
  const name = String(fileName || '').toLowerCase();
  const m = String(mimeType || '').trim().toLowerCase();

  const blobLike =
    !m ||
    m === 'application/octet-stream' ||
    m === 'binary/octet-stream' ||
    m === 'application/x-msdownload';

  if (name.endsWith('.png')) {
    if (blobLike || m === 'image/x-png') return 'image/png';
    return mimeType || 'image/png';
  }

  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    if (blobLike || m === 'image/pjpeg') return 'image/jpeg';
    return mimeType || 'image/jpeg';
  }

  return mimeType;
}
