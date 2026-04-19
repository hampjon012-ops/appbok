import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, RESEND_API_KEY, RESEND_FROM } = process.env;

function isPlaceholder(value) {
  if (!value) return false;
  return value.includes('YOUR_') || value.includes('PLACEHOLDER');
}

const hasRequiredFields = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM;
const hasPlaceholderCredentials = isPlaceholder(SMTP_USER) || isPlaceholder(SMTP_PASS);
const isConfigured = hasRequiredFields && !hasPlaceholderCredentials;

let transporter = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
} else {
  if (hasPlaceholderCredentials) {
    console.warn('[email] SMTP credentials are placeholders. Replace SMTP_USER and SMTP_PASS in api/.env.');
  } else {
    console.warn('[email] SMTP is not configured. Email sending is disabled. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env');
  }
}

function buildInviteHtml({ salonName, inviteUrl }) {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#6f4e37; padding:30px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">Appbok</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px; color:#333333; font-size:20px;">Hej!</h2>
              <p style="margin:0 0 16px; color:#555555; font-size:16px; line-height:1.5;">
                Du har blivit inbjuden att gå med i <strong>${salonName}</strong> som personal på Appbok.
              </p>
              <p style="margin:0 0 24px; color:#555555; font-size:16px; line-height:1.5;">
                Klicka på knappen nedan för att skapa ditt konto och komma igång:
              </p>
              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#6f4e37; border-radius:6px;">
                    <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block; padding:14px 32px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600;">
                      Registrera dig här
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0; color:#999999; font-size:13px; line-height:1.5; text-align:center;">
                Länken är giltig i 7 dagar.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9f9f9; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
              <p style="margin:0; color:#aaaaaa; font-size:12px;">
                Detta mail skickades från Appbok.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send an invite email to a new staff member.
 * @param {{ to: string, salonName: string, inviteUrl: string }} options
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendInviteEmail({ to, salonName, inviteUrl }) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping invite email to', to);
    return {
      success: false,
      error: hasPlaceholderCredentials
        ? 'SMTP credentials are placeholders. Update SMTP_USER and SMTP_PASS in api/.env.'
        : 'SMTP not configured',
    };
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `Du är inbjuden till ${salonName} på Appbok!`,
      html: buildInviteHtml({ salonName, inviteUrl }),
    });

    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send invite email to', to, ':', err.message);
    return { success: false, error: err.message };
  }
}

function escapeHtmlEmail(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Resend HTTP API (ingen extra npm-beroende). Kräver RESEND_API_KEY i .env.
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
async function sendViaResend({ from, to, subject, html }) {
  const key = RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: 'RESEND_API_KEY missing' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.message || body?.error || res.statusText || `HTTP ${res.status}`;
      console.error('[email] Resend API error:', msg, body);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    console.error('[email] Resend fetch:', err.message);
    return { ok: false, error: err.message };
  }
}

function buildVerificationWelcomeHtml({ salonName, verifyUrl, adminUrl, demoUrl }) {
  const safeName = escapeHtmlEmail(salonName);
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e5e5e5;">
          <tr>
            <td style="background-color:#171717; padding:28px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.02em;">Appbok</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px; color:#171717; font-size:22px; font-weight:700; letter-spacing:-0.02em;">Välkommen till Appbok!</h2>
              <p style="margin:0 0 16px; color:#404040; font-size:16px; line-height:1.6;">
                Hej! Vi är så glada att du valt Appbok för <strong>${safeName}</strong>. För att aktivera alla funktioner (inklusive SMS-utskick till kunder) behöver vi bara att du bekräftar din e-postadress.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 32px;">
                <tr>
                  <td style="background-color:#171717; border-radius:8px;">
                    <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block; padding:14px 28px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600;">
                      Bekräfta e-postadress
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px; color:#737373; font-size:14px; line-height:1.5;">
                Har du frågor? Svara bara på detta mejl så hjälper vi dig direkt.
              </p>
              <p style="margin:0; color:#a3a3a3; font-size:12px; line-height:1.5;">
                Din bokningssida: <a href="${demoUrl}" style="color:#737373;">${escapeHtmlEmail(demoUrl)}</a><br />
                Admin: <a href="${adminUrl}" style="color:#737373;">${escapeHtmlEmail(adminUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fafafa; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
              <p style="margin:0; color:#a3a3a3; font-size:12px;">Appbok · Bokning som funkar</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Välkomstmejl med bekräftelselänk.
 * Prioriterar SMTP (samma som bokningsmejl) när det är konfigurerat — annars Resend.
 * Tidigare försökte vi Resend först; om RESEND_API_KEY fanns kunde API svara OK utan leverans
 * och SMTP kördes aldrig.
 * @param {{ to: string, salonName: string, verifyUrl: string, adminUrl: string, demoUrl: string }} options
 */
export async function sendWelcomeVerificationEmail({ to, salonName, verifyUrl, adminUrl, demoUrl }) {
  const fromResend = (RESEND_FROM || 'Appbok <hej@appbok.se>').trim();
  const fromSmtp = (SMTP_FROM || fromResend).trim();
  const subject = 'Välkommen till Appbok! Bekräfta din e-post';
  const html = buildVerificationWelcomeHtml({ salonName, verifyUrl, adminUrl, demoUrl });

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromSmtp,
        to,
        subject,
        html,
      });
      console.log('[email] Welcome+verification sent via SMTP to', to);
      return { success: true, via: 'smtp' };
    } catch (err) {
      console.error('[email] Welcome+verification SMTP failed:', err.message, '— trying Resend if configured');
    }
  }

  const resend = await sendViaResend({ from: fromResend, to, subject, html });
  if (resend.ok) {
    console.log('[email] Welcome+verification sent via Resend to', to);
    return { success: true, via: 'resend' };
  }

  if (!transporter) {
    console.warn(
      '[email] No welcome email to',
      to,
      '— SMTP not configured and Resend:',
      resend.error || 'failed',
    );
    return { success: false, error: resend.error || 'SMTP not configured' };
  }

  return { success: false, error: resend.error || 'SMTP failed and Resend failed' };
}

// ─── Välkomstmail (legacy, utan verifiering) ─────────────────────────────────

function buildWelcomeHtml({ salonName, adminUrl, demoUrl }) {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
          <tr>
            <td style="background-color:#A89483; padding:30px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">Appbok</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px; color:#333333; font-size:20px;">Välkommen till Appbok, ${salonName}!</h2>
              <p style="margin:0 0 16px; color:#555555; font-size:16px; line-height:1.5;">
                Din salongsida är nu skapad och redo att användas. Börja med att utforska och anpassa utseendet.
              </p>
              <p style="margin:0 0 24px; color:#555555; font-size:16px; line-height:1.5;">
                Just nu visas din sida i <strong>demoläge</strong> — det betyder att dina kunder kan se sidan, men Boka-knpen är inaktiverad tills du startar din testperiod.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#A89483; border-radius:6px;">
                    <a href="${adminUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block; padding:14px 32px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600;">
                      Öppna din adminpanel
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0; color:#999999; font-size:13px; line-height:1.5; text-align:center;">
                Dina bokningssida: <a href="${demoUrl}" style="color:#A89483;">${demoUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9f9f9; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
              <p style="margin:0; color:#aaaaaa; font-size:12px;">
                Detta mail skickades från Appbok.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Skicka välkomstmail till ny registrerad salongsägare.
 * @param {{ to: string, salonName: string, adminUrl: string, demoUrl: string }} options
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendWelcomeEmail({ to, salonName, adminUrl, demoUrl }) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping welcome email to', to);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `Välkommen till Appbok, ${salonName}!`,
      html: buildWelcomeHtml({ salonName, adminUrl, demoUrl }),
    });
    console.log('[email] Welcome email sent to', to);
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send welcome email to', to, ':', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Bokningsemail-funktioner ────────────────────────────────────────────────

function fmtDateSwedish(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function buildBookingConfirmationHtml({ customerName, serviceName, stylistName, date, time, salonName }) {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
          <tr>
            <td style="background-color:#6f4e37; padding:30px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">${salonName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px; color:#333333; font-size:20px;">Hej ${customerName}!</h2>
              <p style="margin:0 0 16px; color:#555555; font-size:16px; line-height:1.5;">
                Din bokning är nu bekräftad. Här är sammanfattningen:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9; border-radius:8px; padding:20px; margin:20px 0; width:100%;">
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Tjänst:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${serviceName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Stylist:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${stylistName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Datum:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${fmtDateSwedish(date)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <strong style="color:#555555;">Tid:</strong>
                  </td>
                  <td style="padding:12px 0; text-align:right; color:#333333;">
                    ${time}
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 16px; color:#555555; font-size:16px; line-height:1.5;">
                <strong>Viktigt:</strong> Avbokning måste ske senast 24 timmar före din bokningstid.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9f9f9; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
              <p style="margin:0; color:#aaaaaa; font-size:12px;">
                Detta mail skickades från ${salonName} via Appbok.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCancellationHtml({ customerName, serviceName, date, time, salonName }) {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
          <tr>
            <td style="background-color:#6f4e37; padding:30px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">${salonName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px; color:#333333; font-size:20px;">Hej ${customerName}!</h2>
              <p style="margin:0 0 16px; color:#555555; font-size:16px; line-height:1.5;">
                Din bokning har nu avbokats:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9; border-radius:8px; padding:20px; margin:20px 0; width:100%;">
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Tjänst:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${serviceName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Datum:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${fmtDateSwedish(date)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <strong style="color:#555555;">Tid:</strong>
                  </td>
                  <td style="padding:12px 0; text-align:right; color:#333333;">
                    ${time}
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 16px; color:#555555; font-size:16px; line-height:1.5;">
                Du är välkommen att boka en ny tid när det passar dig.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9f9f9; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
              <p style="margin:0; color:#aaaaaa; font-size:12px;">
                Detta mail skickades från ${salonName} via Appbok.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildStylistNotificationHtml({ stylistName, customerName, serviceName, date, time, customerPhone, salonName }) {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
          <tr>
            <td style="background-color:#6f4e37; padding:30px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">Ny bokning — ${salonName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px; color:#333333; font-size:20px;">Hej ${stylistName}!</h2>
              <p style="margin:0 0 16px; color:#555555; font-size:16px; line-height:1.5;">
                Du har fått en ny bokning. Här är detaljerna:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9; border-radius:8px; padding:20px; margin:20px 0; width:100%;">
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Kund:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${customerName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Tjänst:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${serviceName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Datum:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${fmtDateSwedish(date)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
                    <strong style="color:#555555;">Tid:</strong>
                  </td>
                  <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right; color:#333333;">
                    ${time}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <strong style="color:#555555;">Telefon:</strong>
                  </td>
                  <td style="padding:12px 0; text-align:right; color:#333333;">
                    ${customerPhone}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9f9f9; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
              <p style="margin:0; color:#aaaaaa; font-size:12px;">
                Detta mail skickades från ${salonName} via Appbok.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Skicka bokningsbekräftelse till kund.
 * @param {{ to: string, customerName: string, serviceName: string, stylistName: string, date: string, time: string, salonName: string }} options
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendBookingConfirmationEmail({ to, customerName, serviceName, stylistName, date, time, salonName }) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping booking confirmation email to', to);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `Bokningsbekräftelse — ${salonName}`,
      html: buildBookingConfirmationHtml({ customerName, serviceName, stylistName, date, time, salonName }),
    });
    console.log('[email] Booking confirmation sent to', to);
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send booking confirmation to', to, ':', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Skicka avbokningsbekräftelse till kund.
 * @param {{ to: string, customerName: string, serviceName: string, date: string, time: string, salonName: string }} options
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendCancellationEmail({ to, customerName, serviceName, date, time, salonName }) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping cancellation email to', to);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `Avbokning — ${salonName}`,
      html: buildCancellationHtml({ customerName, serviceName, date, time, salonName }),
    });
    console.log('[email] Cancellation confirmation sent to', to);
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send cancellation email to', to, ':', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Skicka notifikation till stylist om ny bokning.
 * @param {{ to: string, stylistName: string, customerName: string, serviceName: string, date: string, time: string, customerPhone: string, salonName: string }} options
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendStylistNotificationEmail({ to, stylistName, customerName, serviceName, date, time, customerPhone, salonName }) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping stylist notification to', to);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `Ny bokning — ${customerName} | ${date} ${time}`,
      html: buildStylistNotificationHtml({ stylistName, customerName, serviceName, date, time, customerPhone, salonName }),
    });
    console.log('[email] Stylist notification sent to', to);
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send stylist notification to', to, ':', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Go-Live bekräftelsemail ─────────────────────────────────────────────────

function buildGoLiveHtml({ salonName, liveUrl }) {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
          <tr>
            <td style="background-color:#16a34a; padding:30px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">🎉 Välkommen till Appbok, ${salonName}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px; color:#333333; font-size:20px;">Din sajt är nu live!</h2>
              <p style="margin:0 0 16px; color:#555555; font-size:16px; line-height:1.5;">
                Grattis, <strong>${salonName}</strong>! Din bokningssida är nu officiellt lanserad och synlig för kunder.
              </p>
              <p style="margin:0 0 24px; color:#555555; font-size:16px; line-height:1.5;">
                Allt är redo — kunder kan nu boka tjänster direkt på er sida med betalning via Stripe.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#16a34a; border-radius:6px;">
                    <a href="${liveUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block; padding:14px 32px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600;">
                      Öppna er bokningssida
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0; color:#999999; font-size:13px; line-height:1.5; text-align:center;">
                Direktlänk: <a href="${liveUrl}" style="color:#16a34a;">${liveUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9f9f9; padding:20px 40px; text-align:center; border-top:1px solid #eeeeee;">
              <p style="margin:0; color:#aaaaaa; font-size:12px;">
                Detta mail skickades från Appbok.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Skicka go-live bekräftelse till salongsägaren.
 * @param {{ to: string, salonName: string, liveUrl: string }} options
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendGoLiveEmail({ to, salonName, liveUrl }) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping go-live email to', to);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `🎉 ${salonName} är nu live på Appbok!`,
      html: buildGoLiveHtml({ salonName, liveUrl }),
    });
    console.log('[email] Go-live email sent to', to);
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send go-live email to', to, ':', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send cancellation notification email to the salon.
 */
export async function sendCancellationNotificationEmail({
  to,
  customerName,
  serviceName,
  date,
  time,
  salonName,
}) {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping cancellation notification email to', to);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `Avbokning: ${serviceName} den ${date} kl ${time}`,
      text: `En kund har avbokat.\n\nKund: ${customerName}\nTid: ${date} kl ${time}.\n\nBokningen är borttagen från systemet och kunden har återbetalats.`,
      html: `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4; padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:white; border-radius:12px; padding:32px;">
        <tr><td style="font-size:24px; font-weight:bold; margin-bottom:16px;">Avbokning</td></tr>
        <tr><td style="color:#666; font-size:15px; line-height:1.6;">
          <p><strong>En kund har avbokat</strong></p>
          <p>Kund: ${customerName}<br>Tid: ${date} kl ${time}<br>Tjänst: ${serviceName}</p>
          <p>Bokningen är borttagen från systemet och kunden har återbetalats.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    console.log('[email] Cancellation notification sent to', to);
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send cancellation notification to', to, ':', err.message);
    return { success: false, error: err.message };
  }
}
