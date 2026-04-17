import supabase from './supabase.js';

const PUBLIC_SALON_SELECT =
  'id, name, slug, tagline, logo_url, theme, contact, map_url, instagram, status, plan, trial_ends_at, allow_pay_on_site, stripe_account_id';

/**
 * Om trial löpt ut utan att salongen gått live → uppdatera status till expired.
 * Returnerar uppdaterad rad (eller samma rad om ingen ändring / fel).
 */
export async function maybeExpireTrialSalonIfNeeded(salon) {
  if (!salon || salon.status !== 'trial' || !salon.trial_ends_at) return salon;
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
    .select('id, status, trial_ends_at')
    .eq('id', salonId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return maybeExpireTrialSalonIfNeeded(data);
}

export { PUBLIC_SALON_SELECT };
