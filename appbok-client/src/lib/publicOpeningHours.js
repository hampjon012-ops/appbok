const DEFAULT_DAY_LABELS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

/**
 * Returnerar normaliserad vecka (7 poster) om `contact.opening_hours_week` är giltig, annars null.
 * @param {object | null | undefined} contact
 * @returns {Array<{ day: string, isOpen: boolean, openTime: string, closeTime: string }> | null}
 */
export function getValidOpeningHoursWeek(contact) {
  const w = contact?.opening_hours_week;
  if (!Array.isArray(w) || w.length !== 7) return null;
  try {
    return w.map((day, i) => ({
      day: String(day?.day || DEFAULT_DAY_LABELS[i] || `Dag ${i + 1}`),
      isOpen: Boolean(day?.isOpen),
      openTime: String(day?.openTime ?? '09:00').trim() || '09:00',
      closeTime: String(day?.closeTime ?? '18:00').trim() || '18:00',
    }));
  } catch {
    return null;
  }
}

/** Visningstext för höger kolumn (tider eller Stängt). */
export function formatOpeningHoursRange(day) {
  if (!day.isOpen) return 'Stängt';
  return `${day.openTime} - ${day.closeTime}`;
}
