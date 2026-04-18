import { useState, useEffect, useMemo } from 'react';

/**
 * Hämtar kategorier+tjänster och stylister från API och faller tillbaka på config.json.
 */
export function useSalonCatalog(salonId, config) {
  const [dbCategories, setDbCategories] = useState(null);
  const [dbStylists, setDbStylists] = useState(null);
  const [popularCombos, setPopularCombos] = useState([]);

  useEffect(() => {
    if (!salonId) return undefined;

    let cancelled = false;

    fetch(`/api/booking-combos?salon_id=${salonId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.combinations) return;
        setPopularCombos(Array.isArray(data.combinations) ? data.combinations : []);
      })
      .catch(() => {
        if (!cancelled) setPopularCombos([]);
      });

    fetch(`/api/services?salon_id=${salonId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const mapped = data.map((cat) => ({
          ...cat,
          services: (cat.services || []).map((svc) => ({
            ...svc,
            price:
              svc.price_label ||
              `Från ${(svc.price_amount / 100).toLocaleString('sv-SE')} kr`,
          })),
        }));
        setDbCategories(mapped);
      })
      .catch(() => {
        if (!cancelled) setDbCategories(null);
      });

    fetch(`/api/staff?salon_id=${salonId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setDbStylists(data.map((st) => ({ ...st, photo: st.photo_url || '' })));
      })
      .catch(() => {
        if (!cancelled) setDbStylists(null);
      });

    return () => {
      cancelled = true;
    };
  }, [salonId]);

  const categories = useMemo(
    () => (dbCategories !== null ? dbCategories : config?.categories || []),
    [dbCategories, config?.categories],
  );
  const stylists = useMemo(
    () => (dbStylists !== null ? dbStylists : config?.stylists || []),
    [dbStylists, config?.stylists],
  );

  return {
    categories,
    stylists,
    popularCombos,
    isLoadingCategories: dbCategories === null,
    isLoadingStylists: dbStylists === null,
  };
}
