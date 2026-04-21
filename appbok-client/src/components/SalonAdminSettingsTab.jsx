import { useState, useEffect, useCallback, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { UploadCloud, Palette, MapPin, Clock, Camera, PenLine, CreditCard, X, Loader2, Info } from 'lucide-react';
import ThemeLivePreviewColumn from './ThemeLivePreviewColumn.jsx';
import {
  displaySalonName,
  notifySalonConfigUpdated,
  resolvePrimaryAccentHex,
} from '../lib/salonPublicConfig.js';
import { DEFAULT_PLATFORM_SALON_THEME } from '../lib/themePresets.js';
import { adminApiHeaders as authHeaders, adminApiHeadersForUpload } from '../lib/adminApiHeaders.js';
import { getSalonPublicBookingPreviewUrl, copyTextToClipboard } from '../lib/adminUrls.js';

const DEFAULT_SALON_THEME = DEFAULT_PLATFORM_SALON_THEME;

const SALON_ADMIN_TABS = [
  { id: 'theme',    label: 'Tema',            Icon: Palette },
  { id: 'contact',  label: 'Kontakt & Plats', Icon: MapPin },
  { id: 'hours',    label: 'Öppettider',      Icon: Clock },
  { id: 'instagram', label: 'Instagram & Galleri', Icon: Camera },
  { id: 'texts',    label: 'Texter',          Icon: PenLine },
  { id: 'payments', label: 'Betalningar',     Icon: CreditCard },
];

function contactFromSalon(salon) {
  return typeof salon.contact === 'object' && salon.contact !== null && !Array.isArray(salon.contact)
    ? salon.contact
    : {};
}

function SalonThemePanel({ salon, onSaved }) {
  const t = typeof salon.theme === 'object' && salon.theme ? salon.theme : {};
  const [logoUrl, setLogoUrl] = useState(salon.logo_url || '');
  const [logoPreview, setLogoPreview] = useState(salon.logo_url || '');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadErr, setLogoUploadErr] = useState('');
  const [accent, setAccent] = useState(
    resolvePrimaryAccentHex({
      ...DEFAULT_SALON_THEME,
      ...t,
    }),
  );
  const [background, setBackground] = useState(t.backgroundColor || DEFAULT_SALON_THEME.backgroundColor);
  const [text, setText] = useState(t.textColor || DEFAULT_SALON_THEME.textColor);
  const [secondary, setSecondary] = useState(t.secondaryColor || DEFAULT_SALON_THEME.secondaryColor);
  const [bgImage, setBgImage] = useState(t.backgroundImageUrl || '');
  const [bgImagePreview, setBgImagePreview] = useState(t.backgroundImageUrl || '');
  const [bgImageUploading, setBgImageUploading] = useState(false);
  const [bgImageUploadErr, setBgImageUploadErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLogoUrl(salon.logo_url || '');
    setLogoPreview(salon.logo_url || '');
    const th = typeof salon.theme === 'object' && salon.theme ? salon.theme : {};
    setAccent(resolvePrimaryAccentHex({ ...DEFAULT_SALON_THEME, ...th }));
    setBackground(th.backgroundColor || DEFAULT_SALON_THEME.backgroundColor);
    setText(th.textColor || DEFAULT_SALON_THEME.textColor);
    setSecondary(th.secondaryColor || DEFAULT_SALON_THEME.secondaryColor);
    const bg = th.backgroundImageUrl || '';
    setBgImage(bg);
    setBgImagePreview(bg);
  }, [salon]);

  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploadErr('');
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const lowerName = file.name.toLowerCase();
    const extOk =
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg');
    const typeOk =
      allowedTypes.includes(file.type) ||
      (extOk && (file.type === '' || file.type === 'application/octet-stream'));
    if (!typeOk || !extOk) {
      setLogoUploadErr('Filtypen är inte tillåten. Använd PNG eller JPG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadErr('Filen är för stor. Max 2 MB.');
      return;
    }
    let blobPreviewUrl = null;
    try {
      blobPreviewUrl = URL.createObjectURL(file);
      setLogoPreview(blobPreviewUrl);
    } catch {
      /* ignore blob preview failure */
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file, file.name);
      const res = await fetch('/api/salons/current/logo-upload', {
        method: 'POST',
        headers: adminApiHeadersForUpload(),
        body: fd,
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* non-JSON body e.g. HTML proxy error */
      }
      if (!res.ok) {
        const apiErr = typeof data.error === 'string' ? data.error : '';
        throw new Error(
          apiErr ||
            (text && !text.trimStart().startsWith('<') ? text.slice(0, 240) : '') ||
            `Uppladdning misslyckades (HTTP ${res.status}).`,
        );
      }
      const uploadedUrl = data.logo_url;
      setLogoUrl(uploadedUrl);
      setLogoPreview(uploadedUrl);
      toast.success('Logotypen har sparats!');
      onSaved?.(data);
    } catch (err) {
      setLogoUploadErr(err.message);
      // Revert preview to previous URL on failure
      setLogoPreview(salon.logo_url || '');
    } finally {
      setLogoUploading(false);
      if (blobPreviewUrl) {
        try {
          URL.revokeObjectURL(blobPreviewUrl);
        } catch {
          /* ignore */
        }
      }
      // Clear the file input so same file can be re-selected
      e.target.value = '';
    }
  };

  const handleLogoRemove = async () => {
    setLogoUploadErr('');
    setLogoUploading(true);
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ logo_url: '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort logotypen.');
      setLogoUrl('');
      setLogoPreview('');
      toast.success('Logotypen har tagits bort.');
      onSaved?.(data);
    } catch (err) {
      setLogoUploadErr(err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleBgImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgImageUploadErr('');
    const lowerName = file.name.toLowerCase();
    const extOk =
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.png');
    const allowedTypes = ['image/jpeg', 'image/webp', 'image/png'];
    const typeOk = allowedTypes.includes(file.type) || (extOk && (file.type === '' || file.type === 'application/octet-stream'));
    if (!typeOk || !extOk) {
      setBgImageUploadErr('Filtypen är inte tillåten. Använd JPG, WEBP eller PNG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBgImageUploadErr('Filen är för stor. Max 5 MB.');
      return;
    }
    let blobPreviewUrl = null;
    try {
      blobPreviewUrl = URL.createObjectURL(file);
      setBgImagePreview(blobPreviewUrl);
    } catch {
      /* ignore blob preview failure */
    }
    setBgImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('background', file, file.name);
      const res = await fetch('/api/salons/current/background-upload', {
        method: 'POST',
        headers: adminApiHeadersForUpload(),
        body: fd,
      });
      const responseText = await res.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        /* non-JSON body */
      }
      if (!res.ok) {
        const apiErr = typeof data.error === 'string' ? data.error : '';
        throw new Error(
          apiErr ||
            (responseText && !responseText.trimStart().startsWith('<') ? responseText.slice(0, 240) : '') ||
            `Uppladdning misslyckades (HTTP ${res.status}).`,
        );
      }
      const uploadedUrl = data.background_url || '';
      setBgImage(uploadedUrl);
      setBgImagePreview(uploadedUrl);
      toast.success('Bakgrundsbilden har sparats!');
      onSaved?.(data);
    } catch (err) {
      setBgImageUploadErr(err.message);
      setBgImagePreview(salon.theme?.backgroundImageUrl || '');
    } finally {
      setBgImageUploading(false);
      if (blobPreviewUrl) {
        try {
          URL.revokeObjectURL(blobPreviewUrl);
        } catch {
          /* ignore */
        }
      }
      e.target.value = '';
    }
  };

  const handleBgImageRemove = async () => {
    setBgImageUploadErr('');
    setBgImageUploading(true);
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ theme_background_image_url: '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort bakgrundsbilden.');
      setBgImage('');
      setBgImagePreview('');
      toast.success('Bakgrundsbilden har tagits bort.');
      onSaved?.(data);
    } catch (err) {
      setBgImageUploadErr(err.message);
    } finally {
      setBgImageUploading(false);
    }
  };

  const themeControlsStyle = useMemo(
    () => ({
      '--panel-text': text,
      '--panel-secondary': secondary,
      '--panel-accent': accent,
    }),
    [accent, secondary, text],
  );

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          theme_primary: accent,
          theme_background: background,
          theme_text: text,
          theme_secondary: secondary,
          theme_background_image_url: bgImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card superadmin-theme-grid">
      <form
        className="superadmin-theme-controls superadmin-theme-controls--themed"
        style={themeControlsStyle}
        onSubmit={save}
      >
        <h3 className="admin-card-title">Kontroller</h3>

        <div className="theme-colors-stack">
          <label>
            Bakgrundsfärg
            <span className="admin-hint admin-hint--field theme-hint-subtle">
              Yta bakom &quot;Våra mest populära tjänster&quot;, innehållskortet under hero och Instagram-rutnätet.
            </span>
            <input type="color" className="admin-input color-input" value={background} onChange={(e) => setBackground(e.target.value)} />
          </label>
          <label>
            Sekundärfärg
            <span className="admin-hint admin-hint--field theme-hint-subtle">
              Yta bakom &quot;Träffa vårt team&quot;, kontakt/karta, sidfot och ljusare paneler i bokningsfönstret.
            </span>
            <input type="color" className="admin-input color-input" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
          </label>
          <label>
            Knappfärg
            <span className="admin-hint admin-hint--field theme-hint-subtle">
              Färg på Boka tid, Välj vid tjänster, markerade steg i bokningsflödet och andra tydliga knappar/länkar.
            </span>
            <input type="color" className="admin-input color-input" value={accent} onChange={(e) => setAccent(e.target.value)} />
          </label>
          <label>
            Textfärg
            <span className="admin-hint admin-hint--field theme-hint-subtle">
              Huvudsaklig textfärg på bokningssidan: rubriker, brödtext och etiketter (inte hero-texten ovanför kortet).
            </span>
            <input type="color" className="admin-input color-input" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        </div>

        <hr className="theme-section-hr" />

        <div className="theme-upload-compact-sections">
          <div className="theme-upload-compact-block">
            <span className="theme-upload-field-label">Logotyp</span>
            <span className="admin-hint admin-hint--field theme-hint-subtle">
              PNG eller JPG. Max 2 MB. Visas i hero (ovanför tagline). Förhandsvisning till höger.
            </span>
            <div className="theme-upload-compact-row">
              <label className="theme-upload-btn-upload">
                <UploadCloud className="theme-upload-btn-upload__icon" aria-hidden />
                {logoUploading ? 'Laddar upp…' : 'Ladda upp ny bild'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="theme-upload-file-input"
                  style={{ display: 'none' }}
                  onChange={handleLogoFileChange}
                  disabled={logoUploading}
                />
              </label>
              {(logoUrl || logoPreview) && (
                <button
                  type="button"
                  className="theme-upload-btn-remove-inline"
                  onClick={handleLogoRemove}
                  disabled={logoUploading}
                >
                  Ta bort
                </button>
              )}
            </div>
            {logoUploadErr && <p className="logo-upload-error">{logoUploadErr}</p>}
          </div>

          <div className="theme-upload-compact-block">
            <span className="theme-upload-field-label">Bakgrundsbild</span>
            <span className="admin-hint admin-hint--field theme-hint-subtle">
              Bild som ligger bakom hero (överst på sidan). JPG eller WEBP rekommenderas. Max 5 MB. Förhandsvisning till höger.
            </span>
            <div className="theme-upload-compact-row">
              <label className="theme-upload-btn-upload">
                <UploadCloud className="theme-upload-btn-upload__icon" aria-hidden />
                {bgImageUploading ? 'Laddar upp…' : 'Ladda upp ny bild'}
                <input
                  type="file"
                  accept="image/jpeg,image/webp,image/png"
                  className="theme-upload-file-input"
                  style={{ display: 'none' }}
                  onChange={handleBgImageFileChange}
                  disabled={bgImageUploading}
                />
              </label>
              {(bgImage || bgImagePreview) && (
                <button
                  type="button"
                  className="theme-upload-btn-remove-inline"
                  onClick={handleBgImageRemove}
                  disabled={bgImageUploading}
                >
                  Ta bort
                </button>
              )}
            </div>
            {bgImageUploadErr && <p className="logo-upload-error">{bgImageUploadErr}</p>}
          </div>
        </div>

        <hr className="theme-section-hr" />

        <p className="admin-hint admin-hint--field superadmin-theme-save-hint theme-hint-subtle">
          Knappen Spara skriver alla värden ovan till er salong och uppdaterar bokningssidan för besökare (även andra flikar efter en kort stund).
        </p>
        <button
          type="submit"
          className="superadmin-theme-controls-save"
          disabled={saving}
        >
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>

      <ThemeLivePreviewColumn
        salonName={salon.name}
        tagline={salon.tagline || ''}
        logoUrl={logoUrl}
        accent={accent}
        secondary={secondary}
        background={background}
        text={text}
        bgImage={bgImage}
      />
    </div>
  );
}

function SalonContactPanel({ salon, onSaved, onSalonNameLive }) {
  const c0 = contactFromSalon(salon);
  const [salonName, setSalonName] = useState(salon.name || '');
  const [address, setAddress] = useState(c0.address || '');
  const [phone, setPhone] = useState(c0.phone || '');
  const [email, setEmail] = useState(c0.email || '');
  const [mapUrl, setMapUrl] = useState(salon.map_url != null ? String(salon.map_url) : '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSalonName(salon.name || '');
    const c = contactFromSalon(salon);
    setAddress(c.address || '');
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setMapUrl(salon.map_url != null ? String(salon.map_url) : '');
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: salonName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          map_url: mapUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      try {
        const stored = JSON.parse(localStorage.getItem('sb_salon') || '{}');
        localStorage.setItem('sb_salon', JSON.stringify({
          ...stored,
          name: data.name,
          slug: data.slug ?? stored.slug,
        }));
      } catch (_) { /* ignore */ }
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card contact-place-card">
      <h3 className="admin-card-title">📍 Kontakt & Plats</h3>
      <p className="admin-hint contact-place-lead">
        Namn, kontakt och karta som visas för kunder på er bokningssida där det är aktiverat.
      </p>
      <form className="contact-place-form" onSubmit={save}>
        <div className="contact-place-section">
          <h4 className="contact-place-section-title">Kontaktuppgifter</h4>
          <label>
            Salongens namn
            <input
              className="admin-input"
              value={salonName}
              onChange={(e) => {
                const v = e.target.value;
                setSalonName(v);
                onSalonNameLive?.(v);
              }}
              required
            />
          </label>
          <label>
            Telefonnummer
            <input className="admin-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            E-postadress
            <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Gatuadress
            <input className="admin-input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
        </div>

        <hr className="contact-place-hr" />

        <div className="contact-place-section">
          <h4 className="contact-place-section-title">Karta & hitta hit</h4>
          <label>
            Google Maps (inbäddningslänk)
            <input
              className="admin-input"
              value={mapUrl}
              onChange={(e) => {
                let val = e.target.value;
                // Auto-extract src from pasted <iframe> tags
                const iframeMatch = val.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                if (iframeMatch) {
                  val = iframeMatch[1];
                }
                setMapUrl(val);
              }}
              placeholder="https://www.google.com/maps/embed?..."
            />
          </label>
          <p className="contact-place-map-hint">
            Klistra in länken till er salong från Google Maps så att kunderna enkelt kan hitta till er. Använd embed-URL:en från Google Maps under Dela → Bädda in karta.
          </p>
        </div>

        <p className="admin-hint contact-place-save-hint">
          Spara skriver kontakt, adress och karta till er salong på en gång.
        </p>
        <button type="submit" className="superadmin-theme-controls-save" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>
    </div>
  );
}

function SalonHoursPanel({ salon, onSaved }) {
  const c0 = contactFromSalon(salon);
  const initialText = Array.isArray(c0.hours) && c0.hours.length
    ? c0.hours.join('\n')
    : c0.opening_hours || '';
  const [text, setText] = useState(initialText);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = contactFromSalon(salon);
    const t = Array.isArray(c.hours) && c.hours.length ? c.hours.join('\n') : c.opening_hours || '';
    setText(t);
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ opening_hours: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">⏰ Öppettider</h3>
      <p className="admin-hint">En rad per tidsintervall, t.ex. &quot;Mån–Fre 09–18&quot;.</p>
      <form className="superadmin-modal-form" onSubmit={save}>
        <label>
          Öppettider
          <textarea
            className="admin-input"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Mån–Fre 09–18\nLör 10–15'}
          />
        </label>
        <button type="submit" className="btn-superadmin-gold" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>
    </div>
  );
}

function SalonInstagramPanel({ salon, onSaved }) {
  const c0 = contactFromSalon(salon);
  const [handle, setHandle] = useState(
    c0.instagram_handle != null ? String(c0.instagram_handle).replace(/^@/, '') : ''
  );

  const [images, setImages] = useState(() => {
    if (Array.isArray(salon.portfolio_images)) return salon.portfolio_images;
    if (Array.isArray(salon.instagram)) return salon.instagram;
    return [];
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const c = contactFromSalon(salon);
    setHandle(c.instagram_handle != null ? String(c.instagram_handle).replace(/^@/, '') : '');
    if (Array.isArray(salon.portfolio_images)) {
      setImages(salon.portfolio_images);
    } else if (Array.isArray(salon.instagram)) {
      setImages(salon.instagram);
    }
  }, [salon]);

  const saveAll = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setMsg('');
    const h = handle.trim().replace(/^@/, '');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          contact: { instagram_handle: h },
          portfolio_images: images,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= 6) {
      return setMsg('Max 6 bilder tillåtna.');
    }
    setUploadingImage(true);
    setMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/salons/current/gallery-upload', {
        method: 'POST',
        headers: adminApiHeadersForUpload(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte ladda upp bild.');
      const newImages = [...images, data.gallery_url];
      setImages(newImages);
      const h = handle.trim().replace(/^@/, '');
      const putRes = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          portfolio_images: newImages,
          contact: { instagram_handle: h },
        }),
      });
      if (putRes.ok) {
        const ptq = await putRes.json();
        onSaved?.(ptq);
        setMsg('Bild uppladdad!');
        setTimeout(() => setMsg(''), 2500);
      }
    } catch (err) {
      setMsg(err.message);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const removeImage = async (idx) => {
    const newImages = images.filter((_, i) => i !== idx);
    setImages(newImages);
    setSaving(true);
    try {
      const h = handle.trim().replace(/^@/, '');
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          portfolio_images: newImages,
          contact: { instagram_handle: h },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSaved?.(data);
      }
    } catch (err) {
      setMsg('Kunde inte ta bort: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card ig-panel">
      <h3 className="admin-card-title">Instagram &amp; Galleri</h3>
      <p className="admin-hint ig-panel-lead">
        Länka din Instagram och ladda upp dina bästa bilder för att inspirera kunderna på din bokningssida.
      </p>

      <form className="ig-panel-form" onSubmit={saveAll}>
        <div className="ig-panel-field">
          <label className="ig-panel-label" htmlFor="salon-instagram-handle-input">
            Instagram Användarnamn
          </label>
          <div className="ig-panel-input-addon-wrap">
            <span className="ig-panel-input-addon-prefix" aria-hidden="true">
              @
            </span>
            <input
              id="salon-instagram-handle-input"
              type="text"
              className="ig-panel-input-addon-input"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="dittsalongnamn"
              autoComplete="off"
            />
          </div>
        </div>

        <hr className="ig-panel-section-hr" />

        <h4 className="admin-card-subtitle ig-panel-portfolio-title">Portfolio-bilder</h4>
        <p className="admin-hint ig-panel-portfolio-hint">
          Ladda upp upp till 6 av dina bästa arbeten.
        </p>

        <div
          className="admin-gallery-grid ig-panel-gallery"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}
        >
          {images.map((img, idx) => (
            <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <img src={img} alt={`Portfolio ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title="Ta bort bild"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {images.length < 6 && (
            <label style={{ aspectRatio: '1', border: '2px dashed #d1d5db', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: '#f9fafb', color: '#6b7280' }}>
              {uploadingImage ? <Loader2 className="spinner" size={24} /> : <UploadCloud size={24} />}
              <span style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Ladda upp</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingImage} />
            </label>
          )}
        </div>

        {msg && (
          <p className={msg.includes('Kunde inte') || msg.includes('Max') ? 'superadmin-error' : 'superadmin-success'}>
            {msg}
          </p>
        )}

        <div className="ig-panel-footer">
          <button type="submit" className="superadmin-theme-controls-save" disabled={saving}>
            {saving ? 'Sparar…' : 'Spara ändringar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SalonTextsPanel({ salon, onSaved, onSalonNameLive }) {
  const c0 = contactFromSalon(salon);
  const [salonName, setSalonName] = useState(salon.name || '');
  const [tagline, setTagline] = useState(salon.tagline || '');
  const [about, setAbout] = useState(c0.about || '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = contactFromSalon(salon);
    setSalonName(salon.name || '');
    setTagline(salon.tagline || '');
    setAbout(c.about || '');
  }, [salon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: salonName.trim(),
          tagline: tagline.trim(),
          contact: { about: about.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara.');
      setMsg('Sparat!');
      try {
        const stored = JSON.parse(localStorage.getItem('sb_salon') || '{}');
        localStorage.setItem('sb_salon', JSON.stringify({
          ...stored,
          name: data.name,
          slug: data.slug ?? stored.slug,
        }));
      } catch (_) { /* ignore */ }
      onSaved?.(data);
      setTimeout(() => setMsg(''), 2500);
    } catch (x) {
      setMsg(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 className="admin-card-title">✍️ Texter</h3>
      <p className="admin-hint">Välkomsttext och kort presentation om er salong.</p>
      <form className="superadmin-modal-form" onSubmit={save}>
        <label>
          Salongens namn
          <input
            className="admin-input"
            value={salonName}
            onChange={(e) => {
              const v = e.target.value;
              setSalonName(v);
              onSalonNameLive?.(v);
            }}
            placeholder={displaySalonName('')}
          />
        </label>
        <label>
          Text på startsidan (välkomsttext)
          <input
            className="admin-input"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Välkommen till oss!"
          />
        </label>
        <label>
          Om oss
          <textarea
            className="admin-input"
            rows={5}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Kort presentation av er salong..."
          />
        </label>
        <button type="submit" className="btn-superadmin-gold" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {msg && <p className={msg === 'Sparat!' ? 'superadmin-success' : 'superadmin-error'}>{msg}</p>}
      </form>
    </div>
  );
}

function StripeMark() {
  return (
    <svg className="salon-stripe-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.662l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 3.343 2.086 4.768 5.763 6.051 1.996.688 2.715 1.269 2.715 2.152 0 .9-.697 1.389-1.986 1.389-1.857 0-4.601-1.011-6.62-2.351l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-3.344-2.116-4.956-6.591-6.305z"
      />
    </svg>
  );
}

function SalonPaymentsPanel({ salon, onTrialStarted }) {
  const stripeConnected = Boolean(salon?.stripe_account_id || salon?.contact?.stripe_connected);
  const [requirePayment, setRequirePayment] = useState(false);
  const [allowPayOnSite, setAllowPayOnSite] = useState(salon?.allow_pay_on_site !== false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [trialMsg, setTrialMsg] = useState('');
  const [goLiveBusy, setGoLiveBusy] = useState(false);
  const [goLiveMsg, setGoLiveMsg] = useState('');
  const [previewLinkCopied, setPreviewLinkCopied] = useState(false);
  const [stripeDashBusy, setStripeDashBusy] = useState(false);
  const [stripeDisconnectBusy, setStripeDisconnectBusy] = useState(false);

  useEffect(() => {
    if (!stripeConnected) {
      setRequirePayment(false);
      return;
    }
    const c = contactFromSalon(salon);
    if (typeof c.require_payment_at_booking === 'boolean') {
      setRequirePayment(c.require_payment_at_booking);
    }
  }, [salon, stripeConnected]);

  // Sync allow_pay_on_site from salon prop (only on mount / salon change)
  useEffect(() => {
    if (typeof salon?.allow_pay_on_site === 'boolean') {
      setAllowPayOnSite(salon.allow_pay_on_site);
    }
  }, [salon?.allow_pay_on_site]);

  const saveAllowPayOnSite = async (value) => {
    setAllowPayOnSite(value);
    try {
      const res = await fetch('/api/salons', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_pay_on_site: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Kunde inte spara.');
      }
      // Refresh parent
      if (typeof onTrialStarted === 'function') {
        const updated = await res.json().catch(() => null);
        if (updated) onTrialStarted(updated);
      }
    } catch (err) {
      console.error('[allowPayOnSite]', err);
      // Revert on error
      setAllowPayOnSite(!value);
      alert('Kunde inte spara: ' + err.message);
    }
  };

  const handleStripeConnect = async () => {
    try {
      const res = await fetch('/api/stripe/connect', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta Stripe-anslutning.');
      window.location.href = data.url;
    } catch (err) {
      alert('Stripe-anslutning misslyckades: ' + err.message);
    }
  };

  const handleStripeDashboard = async () => {
    setStripeDashBusy(true);
    try {
      const res = await fetch('/api/stripe/connect-dashboard', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte öppna Stripe.');
      window.location.href = data.url;
    } catch (err) {
      alert(err.message);
    } finally {
      setStripeDashBusy(false);
    }
  };

  const handleStripeDisconnect = async () => {
    if (!confirm('Koppla från Stripe? Kortbetalningar via Appbok pausas tills du ansluter igen.')) return;
    setStripeDisconnectBusy(true);
    try {
      const res = await fetch('/api/stripe/disconnect', { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte koppla från.');
      if (typeof onTrialStarted === 'function') onTrialStarted(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setStripeDisconnectBusy(false);
    }
  };

  // Refresh stripeConnected when returning from Stripe callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_connected') === '1') {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload salon data so stripeConnected badge updates
      if (typeof onTrialStarted === 'function') {
        fetch('/api/salons', { headers: authHeaders() })
          .then(r => r.json())
          .then(data => { if (data && !Array.isArray(data)) onTrialStarted(data); })
          .catch(() => {});
      }
    }
    if (params.get('stripe_error')) {
      window.history.replaceState({}, '', window.location.pathname);
      alert('Stripe-anslutning misslyckades: ' + params.get('stripe_error'));
    }
  }, []);

  const handleStartTrial = async () => {
    if (!confirm('Starta 14 dagars testperiod? Efter 14 dagar behöver du koppla Stripe för att fortsätta.')) return;
    setStartingTrial(true);
    setTrialMsg('');
    try {
      const res = await fetch('/api/salons/current/trial', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta trial.');
      setTrialMsg('✓ Trial-period startad! Nu har du 14 dagar att prova plattformen.');
      // Notify parent to reload salon data
      if (typeof onTrialStarted === 'function') onTrialStarted(data);
    } catch (err) {
      setTrialMsg('✗ ' + err.message);
    } finally {
      setStartingTrial(false);
    }
  };

  const salonStatus = salon?.status;
  const isDraft = salonStatus === 'draft';
  const isDemo = salonStatus === 'demo';
  const isActive = salonStatus === 'active';
  const isTrial = salonStatus === 'trial';
  const isLive = salonStatus === 'live';
  const isPreTrial = isDraft || isDemo || isActive;
  const knownLifecycle = isPreTrial || isTrial || isLive;
  const previewBookingUrl = getSalonPublicBookingPreviewUrl(salon);

  const handleGoLive = async () => {
    if (
      !confirm(
        'Gå live nu? Din bokningssida blir synlig för alla och Stripe-betalningar aktiveras. Du kan alltid avsluta när du vill.',
      )
    ) {
      return;
    }
    setGoLiveBusy(true);
    setGoLiveMsg('');
    try {
      const res = await fetch('/api/salons/current/go-live', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte gå live.');
      setTrialMsg(''); // clear any old trial msg
      // Update parent state
      if (typeof onTrialStarted === 'function') {
        onTrialStarted(data);
      }
      setGoLiveMsg('✓ Grattis! Er sajt är nu live.');
    } catch (err) {
      setGoLiveMsg('✗ ' + err.message);
    } finally {
      setGoLiveBusy(false);
    }
  };

  const handleCopyPreviewLink = async () => {
    if (!previewBookingUrl) return;
    const ok = await copyTextToClipboard(previewBookingUrl);
    setPreviewLinkCopied(ok);
    window.setTimeout(() => setPreviewLinkCopied(false), 2500);
  };

  return (
    <div className="admin-card salon-payments-card">
      {/* Trial / status — alert-stil */}
      <div className="payments-lifecycle-banner">
        {isLive && (
          <div className="payments-alert payments-alert--live" role="status">
            <div className="payments-alert-body">
              <div className="payments-alert-title">Du är live</div>
              <p className="payments-alert-text">Din bokningssida är synlig och du kan ta emot bokningar enligt dina inställningar.</p>
            </div>
          </div>
        )}

        {isTrial && (
          <div className="payments-alert payments-alert--trial" role="status">
            <Clock className="payments-alert-icon" size={18} strokeWidth={2} aria-hidden />
            <div className="payments-alert-body">
              <div className="payments-alert-title">Trial</div>
              {salon?.trial_ends_at && (
                <p className="payments-alert-text payments-alert-text--trial">
                  {(() => {
                    const left = Math.ceil(
                      (new Date(salon.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24),
                    );
                    return left > 0
                      ? `${left} dagar kvar av din testperiod.`
                      : 'Testperioden har gått ut.';
                  })()}
                </p>
              )}
            </div>
          </div>
        )}

        {isPreTrial && (
          <div className="payments-alert payments-alert--muted">
            <div className="payments-alert-body">
              <div className="payments-alert-title">Demo — starta testperiod nedan när du är redo</div>
              {previewBookingUrl ? (
                <div className="payments-preview-url">{previewBookingUrl}</div>
              ) : null}
              <div className="payments-alert-actions">
                <button
                  type="button"
                  className="btn-admin-primary"
                  style={{ fontSize: '0.9rem', padding: '0.55rem 1.1rem' }}
                  disabled={startingTrial}
                  onClick={handleStartTrial}
                >
                  {startingTrial ? 'Startar...' : 'Starta 14 dagars testperiod'}
                </button>
                {previewBookingUrl ? (
                  <button
                    type="button"
                    className="btn-admin-secondary"
                    style={{ fontSize: '0.9rem', padding: '0.55rem 1.1rem' }}
                    onClick={handleCopyPreviewLink}
                  >
                    {previewLinkCopied ? 'Länk kopierad' : 'Dela länk för förhandsvisning'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {!knownLifecycle && (
          <p className="admin-hint payments-lifecycle-unknown">
            Status: {salonStatus || '—'}. Kontakta support om livscykelstatus behöver justeras manuellt.
          </p>
        )}

        {trialMsg ? (
          <p
            className={`payments-trial-feedback ${trialMsg.startsWith('✓') ? 'payments-trial-feedback--ok' : 'payments-trial-feedback--err'}`}
          >
            {trialMsg}
          </p>
        ) : null}
      </div>

      <div className="salon-payments-title-row">
        <h3 className="admin-card-title salon-payments-heading">Stripe-anslutning</h3>
        {stripeConnected ? (
          <span className="salon-payments-status-badge salon-payments-status-badge--ok">Aktiv</span>
        ) : null}
      </div>
      <p className="admin-card-desc salon-payments-desc">
        Aktivera kortbetalningar direkt vid bokning. Genom att ansluta ditt Stripe-konto betalas pengarna ut
        automatiskt till ditt bankkonto. Inga extra serviceavgifter tillkommer från Appbok.
      </p>

      <div className="salon-stripe-actions">
        {!stripeConnected ? (
          <button type="button" className="btn-stripe-connect btn-stripe-connect--inline" onClick={handleStripeConnect}>
            <StripeMark />
            <span>Anslut med Stripe</span>
          </button>
        ) : (
          <div className="salon-stripe-connected-actions">
            <button
              type="button"
              className="btn-stripe-manage"
              onClick={handleStripeDashboard}
              disabled={stripeDashBusy}
            >
              {stripeDashBusy ? 'Öppnar…' : 'Hantera Stripe-konto'}
            </button>
            <button
              type="button"
              className="btn-stripe-disconnect"
              onClick={handleStripeDisconnect}
              disabled={stripeDisconnectBusy}
            >
              {stripeDisconnectBusy ? '…' : 'Koppla från'}
            </button>
          </div>
        )}
      </div>

      <div className="salon-payment-settings-card">
        <label className={`salon-payment-setting-row ${!stripeConnected ? 'salon-payment-setting-row--disabled' : ''}`}>
          <div className="salon-payment-setting-text">
            <span className="salon-payment-toggle-label">Kräv betalning vid bokning</span>
            <span className="salon-payment-setting-desc">
              Kunden måste betala hela beloppet via kort för att slutföra bokningen.
            </span>
          </div>
          <span className="salon-payment-switch-wrap">
            <input
              type="checkbox"
              className="salon-payment-switch-input"
              checked={requirePayment}
              disabled={!stripeConnected}
              onChange={(e) => setRequirePayment(e.target.checked)}
            />
            <span className="salon-payment-switch-track" aria-hidden />
          </span>
        </label>
        <label className="salon-payment-setting-row">
          <div className="salon-payment-setting-text">
            <span className="salon-payment-toggle-label">Tillåt kunder att betala på plats</span>
            <span className="salon-payment-setting-desc">
              Om denna är avstängd måste kunden betala hela beloppet via Stripe vid bokningstillfället.
            </span>
          </div>
          <span className="salon-payment-switch-wrap">
            <input
              type="checkbox"
              className="salon-payment-switch-input"
              checked={allowPayOnSite}
              onChange={(e) => saveAllowPayOnSite(e.target.checked)}
            />
            <span className="salon-payment-switch-track" aria-hidden />
          </span>
        </label>
      </div>
      {!stripeConnected && (
        <p className="admin-hint salon-payment-toggle-hint">Anslut Stripe först för att aktivera krav på kortbetalning.</p>
      )}

      {/* ── GÅ LIVE ── */}
      {isTrial && (
        <div className="salon-go-live-block">
          <p className="salon-go-live-hint">
            <Info className="salon-go-live-hint-icon" size={16} strokeWidth={2} aria-hidden />
            <span>
              Vid live: Stripe måste vara ansluten. Dina kunder kan boka och betala direkt.
            </span>
          </p>
          <div className="salon-go-live-actions">
            <button
              type="button"
              className="btn-admin-primary btn-go-live"
              disabled={goLiveBusy}
              onClick={handleGoLive}
            >
              {goLiveBusy ? 'Startar...' : 'Gå Live'}
            </button>
          </div>
          {goLiveMsg ? (
            <p
              className={`salon-go-live-feedback ${goLiveMsg.startsWith('✓') ? 'salon-go-live-feedback--ok' : 'salon-go-live-feedback--err'}`}
            >
              {goLiveMsg}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SalonAdminSettingsTab() {
  const [salon, setSalon] = useState(null);
  const [tab, setTab] = useState('theme');
  const [loading, setLoading] = useState(true);
  const [salonDeletedBlocked, setSalonDeletedBlocked] = useState(false);

  const load = useCallback((opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setLoading(true);
    return fetch('/api/salons', { headers: authHeaders(), cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 403 && data?.code === 'SALON_DELETED') {
          setSalonDeletedBlocked(true);
          setSalon(null);
          if (!silent) setLoading(false);
          return null;
        }
        setSalonDeletedBlocked(false);
        if (!r.ok) throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${r.status}`);
        if (data && !Array.isArray(data)) setSalon(data);
        else setSalon(null);
        if (!silent) setLoading(false);
        return data;
      })
      .catch(() => {
        setSalon(null);
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Öppna rätt underruta när användaren kommer från t.ex. Översikt → "Inställningar → Betalningar". */
  useEffect(() => {
    try {
      let t = sessionStorage.getItem('salonAdminInitialTab');
      if (t === 'maps') t = 'contact';
      if (t === 'calendar') t = 'theme';
      if (t && SALON_ADMIN_TABS.some((x) => x.id === t)) {
        setTab(t);
      }
      sessionStorage.removeItem('salonAdminInitialTab');
    } catch (_) {
      /* ignore */
    }
  }, []);

  const onSalonNameLive = useCallback((name) => {
    setSalon((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const onSaved = useCallback((patch) => {
    if (patch && typeof patch === 'object' && patch.logo_url !== undefined) {
      setSalon((prev) => (prev ? { ...prev, logo_url: patch.logo_url } : null));
    }
    load({ silent: true }).then(() => notifySalonConfigUpdated());
  }, [load]);

  if (loading) {
    return <div className="admin-loading">Laddar inställningar…</div>;
  }

  if (salonDeletedBlocked) {
    return (
      <div className="admin-section">
        <p className="admin-empty" style={{ maxWidth: '28rem' }}>
          Denna salong är inaktiverad och kan inte redigeras här. Kontakta support om du behöver återställa åtkomst.
        </p>
      </div>
    );
  }

  if (!salon) {
    return <div className="admin-section"><p className="admin-empty">Kunde inte hämta salongsdata.</p></div>;
  }

  return (
    <div className="admin-section superadmin-section salon-admin-settings">
      <div className="superadmin-editor-top salon-admin-editor-top">
        <h2 className="admin-section-title">Redigerar: {displaySalonName(salon.name)}</h2>
        <p className="admin-hint salon-admin-lead">
          Uppdatera er bokningssida och kontakt. Personal, tjänster och Google Kalender per medlem hanterar du via menyn till vänster.
        </p>
      </div>

      <div className="superadmin-subtabs">
        {SALON_ADMIN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`superadmin-subtab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.Icon size={15} strokeWidth={2} aria-hidden />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'theme' && <SalonThemePanel salon={salon} onSaved={onSaved} />}
      {tab === 'contact' && <SalonContactPanel salon={salon} onSaved={onSaved} onSalonNameLive={onSalonNameLive} />}
      {tab === 'hours' && <SalonHoursPanel salon={salon} onSaved={onSaved} />}
      {tab === 'instagram' && <SalonInstagramPanel salon={salon} onSaved={onSaved} />}
      {tab === 'texts' && <SalonTextsPanel salon={salon} onSaved={onSaved} onSalonNameLive={onSalonNameLive} />}
      {tab === 'payments' && (
        <SalonPaymentsPanel
          salon={salon}
          onTrialStarted={(updatedSalon) => {
            setSalon(updatedSalon);
            try {
              localStorage.setItem('sb_salon', JSON.stringify(updatedSalon));
            } catch (_) {
              /* ignore */
            }
            notifySalonConfigUpdated();
          }}
        />
      )}
    </div>
  );
}
