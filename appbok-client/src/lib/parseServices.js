/**
 * parseServices — Bokadirekt text → strukturerad tjänstedata
 *
 * Format som stöds:
 *   Klippning 350 kr
 *   Färg 800kr
 *   Barbering 200
 *   Klippning (indenterad) → underkategori
 *   Kategorinamn (saknar pris) → ny kategori
 *
 * @param {string} text — inklistrad text från Bokadirekt eller godtycklig lista
 * @returns {{ categories: Array<{ name, services: Array }>, errors: string[] }}
 */
export function parseServices(text) {
  if (!text || typeof text !== 'string') {
    return { categories: [], errors: [] };
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const errors = [];
  const categories = [];
  let currentCategory = { name: 'Tjänster', services: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Bestäm om raden är indenterad (underkategori / undertjänst)
    const isIndented = /^\s/.test(line) || /^\u2003/.test(line); // space eller &emsp;

    // Extrahera pris ur raden
    const priceMatch = trimmedLine.match(/(\d+)\s*(kr|sek|:-)?/i);
    const priceAmount = priceMatch ? parseInt(priceMatch[1], 10) * 100 : 0;

    // Ta bort priset från namnet
    const nameWithoutPrice = priceAmount > 0
      ? trimmedLine.replace(/\d+\s*(kr|sek|:-)?/i, '').replace(/[()（）\[\]]/g, '').trim()
      : trimmedLine;

    // Om raden inte har någon siffra alls → troligen en kategorirubrik
    if (!priceMatch && !isIndented) {
      if (nameWithoutPrice.length > 0 && nameWithoutPrice.length < 80) {
        if (currentCategory.services.length > 0 || categories.length > 0) {
          categories.push(currentCategory);
          currentCategory = { name: nameWithoutPrice, services: [] };
        } else {
          currentCategory.name = nameWithoutPrice;
        }
      }
      continue;
    }

    // Fast tjänst-rad
    const service = {
      name: nameWithoutPrice,
      price_amount: priceAmount,
      price_label: priceAmount > 0 ? `${priceAmount / 100} kr` : '',
      duration_minutes: 60,
      duration: '',
    };

    if (!service.name) {
      errors.push(`Rad ${i + 1}: kunde inte Parsa tjänst.`);
      continue;
    }

    // Försök hitta varaktighet i parentes eller efter bindestreck
    const durationMatch = trimmedLine.match(/\((\d+)\s*min\)|\b(\d+)\s*min\b/i);
    if (durationMatch) {
      const mins = parseInt(durationMatch[1] || durationMatch[2], 10);
      service.duration_minutes = mins;
      service.duration = `${mins} min`;
    }

    currentCategory.services.push(service);
  }

  if (currentCategory.services.length > 0) {
    categories.push(currentCategory);
  }

  return { categories, errors };
}

/**
 * Slår ihop kategorier med samma namn (case-insensitive).
 */
export function mergeCategories(categories) {
  const map = {};
  for (const cat of categories) {
    const key = (cat.name || 'Tjänster').toLowerCase().trim();
    if (!map[key]) {
      map[key] = { name: cat.name, services: [] };
    }
    map[key].services.push(...cat.services);
  }
  return Object.values(map);
}

/**
 * Platta ut kategorier → platt lista av tjänster (utan kategorier).
 * Används för enkel bulk-import.
 */
export function flattenServices(categories) {
  return categories.flatMap((cat) =>
    cat.services.map((svc) => ({
      ...svc,
      category_name: cat.name,
    })),
  );
}
