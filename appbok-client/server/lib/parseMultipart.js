/**
 * Byte-level multipart/form-data parser.
 * Returns { header: string, body: Uint8Array } for each part.
 * Works correctly with UTF-8 content (e.g. SVG) unlike string-based approaches.
 */
export function parseMultipart(buffer, boundary) {
  const results = [];
  const bLen = boundary.length;
  // Find all occurrences of boundary in the buffer (byte-level search)
  let start = 0;

  while (start < buffer.length) {
    const idx = indexOfUint8(buffer, boundary, start);
    if (idx === -1) break;

    // skip past "--" prefix and "\r\n" after boundary
    const afterBoundary = idx + bLen;
    // part data starts after "\r\n" following the boundary line
    if (buffer[afterBoundary] === 0x2d && buffer[afterBoundary + 1] === 0x2d) {
      // "--" → last boundary, we're done
      break;
    }
    if (buffer[afterBoundary] !== 0x0d || buffer[afterBoundary + 1] !== 0x0a) {
      start = afterBoundary;
      continue;
    }
    const partStart = afterBoundary + 2; // skip \r\n after boundary

    // Find next boundary
    const nextIdx = indexOfUint8(buffer, boundary, partStart);
    if (nextIdx === -1) break;

    // part ends before the preceding \r\n of the next boundary
    let partEnd = nextIdx - 2;
    while (partEnd >= partStart && buffer[partEnd] === 0x0a) partEnd--;
    while (partEnd >= partStart && buffer[partEnd] === 0x0d) partEnd--;

    if (partEnd < partStart) {
      start = nextIdx;
      continue;
    }

    // Scan for \r\n\r\n to split header from body
    let headerEnd = -1;
    for (let i = partStart; i <= partEnd - 3; i++) {
      if (
        buffer[i] === 0x0d &&
        buffer[i + 1] === 0x0a &&
        buffer[i + 2] === 0x0d &&
        buffer[i + 3] === 0x0a
      ) {
        headerEnd = i;
        break;
      }
    }

    if (headerEnd === -1) {
      start = nextIdx;
      continue;
    }

    // Decode header as utf-8 (ASCII-safe)
    const headerBytes = buffer.slice(partStart, headerEnd);
    const header = new TextDecoder('utf-8', { fatal: false }).decode(headerBytes);

    // body is everything after \r\n\r\n up to and including partEnd
    const bodyStart = headerEnd + 4;
    if (bodyStart > partEnd) {
      start = nextIdx;
      continue;
    }
    const body = buffer.slice(bodyStart, partEnd + 1);

    results.push({ header, body });
    start = nextIdx;
  }

  return results;
}

/**
 * Find first occurrence of pattern (as byte sequence) in data starting at offset.
 * Returns -1 if not found.
 */
function indexOfUint8(data, pattern, offset = 0) {
  outer:
  for (let i = offset; i <= data.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) continue outer;
    }
    return i;
  }
  return -1;
}
