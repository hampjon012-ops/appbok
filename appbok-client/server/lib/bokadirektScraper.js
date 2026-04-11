/**
 * Bokadirekt scraper — server-side
 *
 * Bokadirekt levererar all tjänstedata inline i HTML:en som
 * `window.__PRELOADED_STATE__ = { place: { services: [...] } }`
 *
 * Struktur:
 *   place.services = [{ id, name, order, services: [{ name, price, duration, priceLabel, durationLabel }] }]
 *   (pris är i ÖRE, duration är i SEKUNDER)
 */

import { load } from 'cheerio';

/**
 * @param {string} url — fullständig Bokadirekt-URL
 * @returns {Promise<{ categories: Array, errors: string[] }>}
 */
export async function scrapeBokadirekt(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Ogiltig URL');
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('bokadirekt.se')) {
      throw new Error('Endast bokadirekt.se-URL:er stöds');
    }
  } catch {
    throw new Error('Ogiltig URL-format');
  }

  let html;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Appbok/1.0; +https://appbok.se)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Bokadirekt svarade med ${res.status}`);
    }
    html = await res.text();
  } catch (err) {
    throw new Error(`Kunde inte hämta från Bokadirekt: ${err.message}`);
  }

  return parseBokadirektHtml(html);
}

/**
 * Extraherar och parsar __PRELOADED_STATE__ ur HTML.
 *
 * @param {string} html
 * @returns {{ categories: Array, errors: string[] }}
 */
export function parseBokadirektHtml(html) {
  const $ = load(html);
  const errors = [];

  // Hitta start av JSON-objektet ("cookies" ligger tidigt i __PRELOADED_STATE__)
  const cookieIdx = html.indexOf('"cookies"');
  if (cookieIdx === -1) {
    errors.push('Kunde inte hitta tjänstedata på sidan.');
    return { categories: [], errors };
  }

  // Gå bakåt till början av JSON-objektet
  const startJson = html.lastIndexOf('{', cookieIdx);
  if (startJson === -1) {
    errors.push('Kunde inte parsa siddata.');
    return { categories: [], errors };
  }

  // Hitta balanserad avslutning (sista '}' innan </script>)
  const afterScript = html.indexOf('</script>', startJson);
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let endPos = -1;

  for (let i = startJson; i < afterScript; i++) {
    const c = html[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (c === '\\') { escapeNext = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') braceCount++;
    else if (c === '}') { braceCount--; if (braceCount === 0) { endPos = i + 1; break; } }
  }

  if (endPos === -1) {
    errors.push('Kunde inte parsa tjänstedata — ogiltigt format.');
    return { categories: [], errors };
  }

  let state;
  try {
    state = JSON.parse(html.substring(startJson, endPos));
  } catch (err) {
    errors.push(`Kunde inte parsa tjänstedata: ${err.message}`);
    return { categories: [], errors };
  }

  const place = state?.place;
  if (!place) {
    errors.push('Inga tjänster hittades på sidan.');
    return { categories: [], errors };
  }

  // place.services = array av kategorier
  const rawCategories = Array.isArray(place.services) ? place.services : [];

  if (rawCategories.length === 0) {
    errors.push('Inga tjänster hittades. Bokadirekts sidstruktur kan ha ändrats.');
    return { categories: [], errors };
  }

  const categories = [];

  for (const cat of rawCategories) {
    if (!cat.name || !Array.isArray(cat.services)) continue;

    const services = [];

    for (const svc of cat.services) {
      if (!svc.name || !svc.name.trim()) continue;

      // Bokadirekt price är i kronor (integer), Appbok lagrar i öre
      const price_amount = typeof svc.price === 'number' ? Math.round(svc.price * 100) : 0;
      // duration är i sekunder (integer), t.ex. 3600 = 60 min
      const duration_seconds = typeof svc.duration === 'number' ? svc.duration : 0;
      const duration_minutes = Math.round(duration_seconds / 60) || 60;
      const duration = duration_seconds > 0 ? `${duration_minutes} min` : '';

      // priceLabel är formaterad sträng, t.ex. "6 000 kr" eller "299-600 kr"
      const price_label = svc.priceLabel || (
        price_amount > 0
          ? `${(price_amount / 100).toLocaleString('sv-SE')} kr`
          : ''
      );

      if (price_amount === 0 && !svc.priceLabel) continue; // Hoppa tjänster utan pris

      services.push({
        name: svc.name.trim(),
        price_amount,
        price_label,
        duration,
        duration_minutes,
      });
    }

    if (services.length > 0) {
      categories.push({ name: cat.name, services });
    }
  }

  return { categories, errors };
}

/**
 * Platta ut kategorier → lista av tjänster för import-backend.
 */
export function prepareForImport(scrapeResult) {
  const { categories } = scrapeResult;
  return categories.flatMap((cat) =>
    cat.services.map((svc) => ({
      name: svc.name,
      price_amount: svc.price_amount,
      price_label: svc.price_label,
      duration: svc.duration || '',
      duration_minutes: svc.duration_minutes || 60,
      category_name: cat.name,
    })),
  );
}
