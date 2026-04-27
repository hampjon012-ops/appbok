import supabase from './supabase.js';

const PUBLIC_SALON_SELECT =
  'id, name, slug, tagline, logo_url, theme, contact, map_url, instagram, status, plan, trial_ends_at, allow_pay_on_site, stripe_account_id';

/**
 * Om trial löpt ut utan att salongen gått live → uppdatera status till expired.
 * Returnerar uppdaterad rad (eller samma rad om ingen ändring / fel).
 */
export async function maybeExpireTrialSalonIfNeeded(salon) {
  if (!salon || salon.status === 'deleted') return salon;
  if (salon.status !== 'trial' || !salon.trial_ends_at) return salon;
  const ends = new Date(salon.trial_ends_at);
  if (Number.isNaN(ends.getTime()) || ends >= new Date()) return salon;

  const { data, error } = await supabase
    .from('salons')
    .update({ status: 'expired' })
    .eq('id', salon.id)
    .select(PUBLIC_SALON_SELECT)
    .single();

  if (error) {
    console.error('[expireTrial]', error);
    return salon;
  }
  return data || salon;
}

/** Hämtar salong efter id och kör expire om trial passerat. */
export async function loadSalonMaybeExpire(salonId) {
  const { data, error } = await supabase
    .from('salons')
    .select('id, status, trial_ends_at, contact')
    .eq('id', salonId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const updated = await maybeExpireTrialSalonIfNeeded(data);
  // maybeExpireTrialSalonIfNeeded returns data with contact only when it updated;
  // when no update happened, data lacks contact → re-fetch once if missing
  if (!updated.contact) {
    const { data: refreshed } = await supabase
      .from('salons')
      .select('contact')
      .eq('id', salonId)
      .maybeSingle();
    if (refreshed?.contact) updated.contact = refreshed.contact;
  }
  return updated;
}

export { PUBLIC_SALON_SELECT };
