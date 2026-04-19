/**
 * Webbläsare skickar ofta SVG som application/octet-stream eller application/xml.
 * Supabase Storage måste få image/svg+xml så att <img src="...svg"> laddar rätt.
 */
export function normalizeLogoMimeType(mimeType, fileName) {
  const name = String(fileName || '').toLowerCase();
  const m = String(mimeType || '').trim().toLowerCase();

  const blobLike =
    !m ||
    m === 'application/octet-stream' ||
    m === 'binary/octet-stream' ||
    m === 'application/x-msdownload';

  if (name.endsWith('.svg')) {
    if (
      blobLike ||
      m === 'application/xml' ||
      m === 'text/xml' ||
      m === 'text/plain' ||
      m === 'application/svg+xml'
    ) {
      return 'image/svg+xml';
    }
    if (m === 'image/svg+xml' || m.includes('svg')) return 'image/svg+xml';
    return 'image/svg+xml';
  }

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
